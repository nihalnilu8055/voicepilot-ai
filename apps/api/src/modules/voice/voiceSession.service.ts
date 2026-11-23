import { prisma } from '../../db/prisma.js';
import { conversationEvaluationService } from '../../services/conversationEvaluationService.js';
import type {
  VoiceSession,
  VoiceSessionStatus,
  ConversationMessage,
  ConversationSender,
  VoiceLanguage,
  QualificationOutcome,
} from '@voicepilot/shared';

const MAX_FREE_TIER_SESSION_SECONDS = 600; // 10 minutes cap to prevent quota exhaustion

const memorySessions = new Map<string, VoiceSession>();
const memoryMessages = new Map<string, ConversationMessage[]>();
let isMemoryMode = false;

export const voiceSessionService = {
  setMemoryMode(enabled: boolean) {
    isMemoryMode = enabled;
  },

  clearMemoryState() {
    memorySessions.clear();
    memoryMessages.clear();
  },

  async createLiveSession(
    tenantId: string,
    userId: string,
    options: {
      language: VoiceLanguage;
      voiceName: string;
      campaignId?: string | null;
      leadId?: string | null;
    }
  ): Promise<VoiceSession> {
    const sessionId = `vses_live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const session: VoiceSession = {
      id: sessionId,
      tenantId,
      campaignId: options.campaignId || null,
      leadId: options.leadId || null,
      initiatedById: userId,
      language: options.language,
      voiceName: options.voiceName,
      status: 'ACTIVE',
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    if (isMemoryMode) {
      memorySessions.set(sessionId, session);
      memoryMessages.set(sessionId, []);
      return session;
    }

    try {
      await prisma.voiceSession.create({
        data: {
          id: sessionId,
          tenantId,
          campaignId: options.campaignId || null,
          leadId: options.leadId || null,
          initiatedById: userId,
          language: options.language,
          voiceName: options.voiceName,
          status: 'ACTIVE',
          startedAt: new Date(now),
        },
      });
      return session;
    } catch {
      memorySessions.set(sessionId, session);
      memoryMessages.set(sessionId, []);
      return session;
    }
  },

  async appendTranscriptMessage(
    tenantId: string,
    sessionId: string,
    sender: ConversationSender,
    text: string,
    language?: VoiceLanguage
  ): Promise<ConversationMessage> {
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const message: ConversationMessage = {
      id: msgId,
      sessionId,
      tenantId,
      sender,
      text,
      language,
      timestamp: now,
    };

    const sessionMsgs = memoryMessages.get(sessionId) || [];
    sessionMsgs.push(message);
    memoryMessages.set(sessionId, sessionMsgs);

    if (isMemoryMode) {
      return message;
    }

    try {
      await prisma.conversationMessage.create({
        data: {
          id: msgId,
          sessionId,
          tenantId,
          sender,
          text,
          language,
          timestamp: new Date(now),
        },
      });
    } catch {
      // Memory state retained
    }

    return message;
  },

  async endLiveSession(
    tenantId: string,
    sessionId: string,
    outcome?: QualificationOutcome
  ): Promise<VoiceSession | null> {
    const now = new Date();
    const session = memorySessions.get(sessionId);

    let startedAt = now.getTime();
    if (session) {
      startedAt = new Date(session.startedAt).getTime();
    }

    const durationSeconds = Math.min(
      MAX_FREE_TIER_SESSION_SECONDS,
      Math.max(1, Math.round((now.getTime() - startedAt) / 1000))
    );

    const messages = memoryMessages.get(sessionId) || [];

    // Trigger AI evaluation
    const evaluation = await conversationEvaluationService.evaluateTranscript(
      tenantId,
      sessionId,
      session?.leadId,
      messages,
      outcome || 'QUALIFIED'
    );

    if (session) {
      session.status = 'COMPLETED';
      session.endedAt = now.toISOString();
      session.durationSeconds = durationSeconds;
      session.qualificationOutcome = outcome || 'QUALIFIED';
      session.evaluation = evaluation;
      session.messages = messages;
    }

    if (isMemoryMode) {
      return session || null;
    }

    try {
      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          durationSeconds,
          qualificationOutcome: outcome || 'QUALIFIED',
        },
      });

      if (session?.leadId && outcome) {
        let newLeadStatus = 'CONTACTED';
        if (outcome === 'QUALIFIED') newLeadStatus = 'QUALIFIED';
        else if (outcome === 'CALLBACK_REQUESTED') newLeadStatus = 'CALLBACK';
        else if (outcome === 'NOT_INTERESTED') newLeadStatus = 'NOT_INTERESTED';

        await prisma.lead.update({
          where: { id: session.leadId },
          data: { status: newLeadStatus as any },
        });
      }

      return session || null;
    } catch {
      return session || null;
    }
  },

  getMaxSessionLimitSeconds(): number {
    return MAX_FREE_TIER_SESSION_SECONDS;
  },
};
