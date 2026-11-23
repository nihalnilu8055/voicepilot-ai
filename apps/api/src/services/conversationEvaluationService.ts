import { prisma } from '../db/prisma.js';
import type {
  ConversationEvaluation,
  QualificationOutcome,
  ConversationMessage,
} from '@voicepilot/shared';

const memoryEvaluations = new Map<string, ConversationEvaluation>();
let isMemoryMode = false;

export const conversationEvaluationService = {
  setMemoryMode(enabled: boolean) {
    isMemoryMode = enabled;
  },

  clearMemoryState() {
    memoryEvaluations.clear();
  },

  async evaluateTranscript(
    tenantId: string,
    sessionId: string,
    leadId: string | null | undefined,
    messages: ConversationMessage[],
    explicitOutcome?: QualificationOutcome | null
  ): Promise<ConversationEvaluation> {
    const userMessages = messages.filter((m) => m.sender === 'USER');
    const combinedUserText = userMessages.map((m) => m.text.toLowerCase()).join(' ');

    // Sentiment analysis with regex word boundaries to avoid substring false positives (e.g. "now" containing "no")
    let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
    const positiveTriggers = [
      /\binterested\b/i,
      /\byes\b/i,
      /\bsounds good\b/i,
      /\bgreat\b/i,
      /\bshare\b/i,
      /\bdemo\b/i,
      /\bpricing\b/i,
      /\bsend\b/i,
      /\bhelp\b/i,
      /sheriyanu/i,
      /istam/i,
      /nanni/i,
      /valare nallath/i,
    ];

    const negativeTriggers = [
      /\bnot interested\b/i,
      /\bdont call\b/i,
      /\bno\b/i,
      /\bstop\b/i,
      /\bexpensive\b/i,
      /\bvenda\b/i,
      /thalparyamilla/i,
    ];

    let posScore = 0;
    let negScore = 0;

    for (const pattern of positiveTriggers) {
      if (pattern.test(combinedUserText)) posScore++;
    }
    for (const pattern of negativeTriggers) {
      if (pattern.test(combinedUserText)) negScore++;
    }

    if (posScore > negScore) sentiment = 'POSITIVE';
    else if (negScore > posScore) sentiment = 'NEGATIVE';

    // Objections detection
    const objections: string[] = [];
    if (/expensive|price|cost|budget|kooduthal/i.test(combinedUserText)) {
      objections.push('Pricing / Budget considerations');
    }
    if (/busy|later|not now|call next week|samayamilla/i.test(combinedUserText)) {
      objections.push('Timing / Availability');
    }
    if (/manager|partner|team|boss|choyikatte/i.test(combinedUserText)) {
      objections.push('Decision Maker / Authority Approval');
    }
    if (/competitor|already have|using another/i.test(combinedUserText)) {
      objections.push('Existing Competitor Solution');
    }

    // Lead scoring (0 - 100)
    let leadScore = 50; // standard consultative baseline
    if (userMessages.length >= 2) leadScore += 15;
    if (userMessages.length >= 3) leadScore += 10;
    if (sentiment === 'POSITIVE') leadScore += 15;
    if (sentiment === 'NEGATIVE') leadScore = Math.max(10, leadScore - 25);

    if (explicitOutcome === 'QUALIFIED') {
      leadScore = Math.max(leadScore, 75);
    } else if (explicitOutcome === 'CALLBACK_REQUESTED') {
      leadScore = Math.max(leadScore, 60);
    } else if (explicitOutcome === 'NOT_INTERESTED') {
      leadScore = Math.min(leadScore, 30);
    }

    leadScore = Math.min(100, Math.max(0, leadScore));

    // Interest level
    let customerInterest: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (leadScore >= 70) customerInterest = 'HIGH';
    else if (leadScore < 45) customerInterest = 'LOW';

    // Summary & Next step
    let qualificationSummary = 'Customer engaged in exploratory consultative dialogue.';
    let suggestedNextStep = 'Follow up with standard product overview.';

    if (customerInterest === 'HIGH') {
      qualificationSummary = 'High purchase intent demonstrated. Customer asked relevant questions and engaged positively.';
      suggestedNextStep = 'Schedule deep-dive product demo with Senior Sales Specialist.';
    } else if (objections.includes('Timing / Availability')) {
      qualificationSummary = 'Customer is interested but currently constrained by time.';
      suggestedNextStep = 'Log callback reminder for next week as agreed during call.';
    } else if (sentiment === 'NEGATIVE') {
      qualificationSummary = 'Customer showed reluctance or lack of current need.';
      suggestedNextStep = 'Nurture via low-frequency email updates or respect non-contact preference.';
    }

    const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const evaluation: ConversationEvaluation = {
      id: evaluationId,
      sessionId,
      tenantId,
      leadId: leadId || null,
      leadScore,
      sentiment,
      objectionsRaised: objections,
      customerInterest,
      qualificationSummary,
      suggestedNextStep,
      createdAt: new Date().toISOString(),
    };

    if (isMemoryMode) {
      memoryEvaluations.set(sessionId, evaluation);
      return evaluation;
    }

    try {
      await prisma.conversationEvaluation.upsert({
        where: { sessionId },
        create: {
          id: evaluationId,
          sessionId,
          tenantId,
          leadId: leadId || null,
          leadScore,
          sentiment,
          objectionsRaised: objections,
          customerInterest,
          qualificationSummary,
          suggestedNextStep,
        },
        update: {
          leadScore,
          sentiment,
          objectionsRaised: objections,
          customerInterest,
          qualificationSummary,
          suggestedNextStep,
        },
      });
      return evaluation;
    } catch {
      memoryEvaluations.set(sessionId, evaluation);
      return evaluation;
    }
  },

  async getEvaluationBySession(
    tenantId: string,
    sessionId: string
  ): Promise<ConversationEvaluation | null> {
    if (isMemoryMode) {
      const evalItem = memoryEvaluations.get(sessionId);
      if (evalItem && evalItem.tenantId === tenantId) return evalItem;
      return null;
    }

    try {
      const record = await prisma.conversationEvaluation.findFirst({
        where: { sessionId, tenantId },
      });
      if (!record) return memoryEvaluations.get(sessionId) || null;
      return {
        id: record.id,
        sessionId: record.sessionId,
        tenantId: record.tenantId,
        leadId: record.leadId,
        leadScore: record.leadScore,
        sentiment: record.sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
        objectionsRaised: (record.objectionsRaised as string[]) || [],
        customerInterest: record.customerInterest as 'HIGH' | 'MEDIUM' | 'LOW',
        qualificationSummary: record.qualificationSummary,
        suggestedNextStep: record.suggestedNextStep,
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      return memoryEvaluations.get(sessionId) || null;
    }
  },
};
