import { GoogleGenAI } from '@google/genai';
import { prisma } from '../db/prisma.js';
import { companyKnowledgeService } from './companyKnowledgeService.js';
import { conversationEvaluationService } from './conversationEvaluationService.js';
import type {
  VoiceSession,
  VoiceSessionStatus,
  ConversationMessage,
  ConversationSender,
  CreateVoiceSessionInput,
  EndVoiceSessionInput,
  VoiceLanguage,
  QualificationOutcome,
} from '@voicepilot/shared';

// In-memory session and message caches for fast lookups and unit test mocking
const memorySessions = new Map<string, VoiceSession>();
const memoryMessages = new Map<string, ConversationMessage[]>();
let isMemoryMode = false;

// Optional Gemini Client initialized if GEMINI_API_KEY is available
let geminiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch {
    geminiClient = null;
  }
}

export const voiceEngineService = {
  setMemoryMode(enabled: boolean) {
    isMemoryMode = enabled;
  },

  clearMemoryState() {
    memorySessions.clear();
    memoryMessages.clear();
  },

  async createSession(
    tenantId: string,
    userId: string,
    input: CreateVoiceSessionInput
  ): Promise<VoiceSession> {
    const sessionId = `vses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const session: VoiceSession = {
      id: sessionId,
      tenantId,
      campaignId: input.campaignId || null,
      leadId: input.leadId || null,
      initiatedById: userId,
      language: input.language || 'en-IN',
      voiceName: input.voiceName || 'Priya (Warm)',
      status: 'ACTIVE',
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    // System welcome greeting based on language
    const welcomeGreeting: ConversationMessage = {
      id: `msg_${Date.now()}_init`,
      sessionId,
      tenantId,
      sender: 'AI',
      text:
        input.language === 'ml-IN'
          ? 'നമസ്കാരം! വോയ്‌സ്പൈലറ്റ് എഐ-ലേക്ക് സ്വാഗതം. ഞാൻ എങ്ങനെയാണ് നിങ്ങളെ സഹായിക്കേണ്ടത്?'
          : 'Hello! Thank you for connecting with us today. How can I assist you with your business goals?',
      language: input.language || 'en-IN',
      timestamp: now,
      latencyMs: 120,
    };

    if (isMemoryMode) {
      memorySessions.set(sessionId, session);
      memoryMessages.set(sessionId, [welcomeGreeting]);
      session.messages = [welcomeGreeting];
      return session;
    }

    try {
      await prisma.voiceSession.create({
        data: {
          id: sessionId,
          tenantId,
          campaignId: input.campaignId || null,
          leadId: input.leadId || null,
          initiatedById: userId,
          language: input.language || 'en-IN',
          voiceName: input.voiceName || 'Priya (Warm)',
          status: 'ACTIVE',
          startedAt: new Date(now),
        },
      });

      await prisma.conversationMessage.create({
        data: {
          id: welcomeGreeting.id,
          sessionId,
          tenantId,
          sender: 'AI',
          text: welcomeGreeting.text,
          language: welcomeGreeting.language,
          timestamp: new Date(now),
          latencyMs: 120,
        },
      });

      session.messages = [welcomeGreeting];
      return session;
    } catch {
      memorySessions.set(sessionId, session);
      memoryMessages.set(sessionId, [welcomeGreeting]);
      session.messages = [welcomeGreeting];
      return session;
    }
  },

  async getSession(
    tenantId: string,
    sessionId: string
  ): Promise<VoiceSession | null> {
    if (isMemoryMode) {
      const session = memorySessions.get(sessionId);
      if (!session || session.tenantId !== tenantId) return null;
      session.messages = memoryMessages.get(sessionId) || [];
      return session;
    }

    try {
      const record = await prisma.voiceSession.findFirst({
        where: { id: sessionId, tenantId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
          },
          evaluation: true,
        },
      });

      if (!record) {
        const mem = memorySessions.get(sessionId);
        if (mem && mem.tenantId === tenantId) {
          mem.messages = memoryMessages.get(sessionId) || [];
          return mem;
        }
        return null;
      }

      return {
        id: record.id,
        tenantId: record.tenantId,
        campaignId: record.campaignId,
        leadId: record.leadId,
        initiatedById: record.initiatedById,
        language: record.language as VoiceLanguage,
        voiceName: record.voiceName,
        status: record.status as VoiceSessionStatus,
        startedAt: record.startedAt.toISOString(),
        endedAt: record.endedAt ? record.endedAt.toISOString() : null,
        durationSeconds: record.durationSeconds,
        qualificationOutcome: record.qualificationOutcome as QualificationOutcome | null,
        callbackTime: record.callbackTime ? record.callbackTime.toISOString() : null,
        notes: record.notes,
        messages: record.messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          tenantId: m.tenantId,
          sender: m.sender as ConversationSender,
          text: m.text,
          language: m.language as VoiceLanguage | undefined,
          timestamp: m.timestamp.toISOString(),
          latencyMs: m.latencyMs,
        })),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    } catch {
      const mem = memorySessions.get(sessionId);
      if (mem && mem.tenantId === tenantId) {
        mem.messages = memoryMessages.get(sessionId) || [];
        return mem;
      }
      return null;
    }
  },

  async listSessions(
    tenantId: string,
    limit = 20
  ): Promise<VoiceSession[]> {
    if (isMemoryMode) {
      return Array.from(memorySessions.values())
        .filter((s) => s.tenantId === tenantId)
        .slice(0, limit);
    }

    try {
      const records = await prisma.voiceSession.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: {
          messages: {
            take: 2,
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      return records.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        campaignId: r.campaignId,
        leadId: r.leadId,
        initiatedById: r.initiatedById,
        language: r.language as VoiceLanguage,
        voiceName: r.voiceName,
        status: r.status as VoiceSessionStatus,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt ? r.endedAt.toISOString() : null,
        durationSeconds: r.durationSeconds,
        qualificationOutcome: r.qualificationOutcome as QualificationOutcome | null,
        callbackTime: r.callbackTime ? r.callbackTime.toISOString() : null,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      return Array.from(memorySessions.values())
        .filter((s) => s.tenantId === tenantId)
        .slice(0, limit);
    }
  },

  async processUserMessage(
    tenantId: string,
    sessionId: string,
    userText: string,
    detectedLang?: VoiceLanguage
  ): Promise<{ userMessage: ConversationMessage; aiResponse: ConversationMessage }> {
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    // 1. Detect language / Switch naturally
    let language: VoiceLanguage = detectedLang || 'en-IN';
    const isMalayalamScript = /[\u0D00-\u0D7F]/.test(userText);
    const malayalamKeywords = ['namaskaram', 'sugham', 'enthanu', 'kure', 'enthokke', 'njan', 'ariyamo', 'nanni', 'valare'];
    const isMalayalamTranslit = malayalamKeywords.some((kw) =>
      userText.toLowerCase().includes(kw)
    );

    if (isMalayalamScript || isMalayalamTranslit) {
      language = 'ml-IN';
    }

    // 2. Fetch tenant-approved knowledge (Strict Tenant Isolation)
    const knowledgeItems = await companyKnowledgeService.listKnowledge(tenantId);
    const approvedKnowledge = knowledgeItems
      .filter((k) => k.isApproved)
      .map((k) => `[Category: ${k.category}] ${k.title}: ${k.content}`)
      .join('\n');

    // 3. Generate AI Response
    let aiText = '';

    if (geminiClient && process.env.GEMINI_API_KEY) {
      try {
        const systemPrompt = `You are an AI consultative sales representative for VoicePilot AI representing this company.
Current Language: ${language === 'ml-IN' ? 'Malayalam (ml-IN)' : 'Indian English (en-IN)'}.
Personality: Consultative, professional, warm, solution-oriented.
Strict Tenant Grounding Rules:
1. ONLY discuss products, pricing, discounts, and features explicitly present in the Approved Company Knowledge below.
2. If the customer asks for a price, discount, or custom specification NOT in the knowledge base, DO NOT INVENT IT. Politely explain that you will arrange a callback from a human specialist to give them exact details.
3. Keep spoken replies concise (1 to 3 sentences) suitable for a real-time voice call.
4. Speak naturally in ${language === 'ml-IN' ? 'polite conversational Malayalam' : 'natural Indian English'}.

Approved Company Knowledge:
${approvedKnowledge || 'No specific product catalog uploaded yet.'}`;

        const response = await geminiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nCustomer: ${userText}` }] },
          ],
        });

        aiText = response.text || '';
      } catch {
        // Fall back to consultative rule-engine below
      }
    }

    // Consultative Fallback / Zero-cost rule engine if Gemini API is offline or unconfigured
    if (!aiText) {
      aiText = this.generateConsultativeResponse(
        userText,
        language,
        knowledgeItems
      );
    }

    const latencyMs = Date.now() - startTime;

    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_usr`,
      sessionId,
      tenantId,
      sender: 'USER',
      text: userText,
      language,
      timestamp: nowIso,
    };

    const aiResponse: ConversationMessage = {
      id: `msg_${Date.now()}_ai`,
      sessionId,
      tenantId,
      sender: 'AI',
      text: aiText,
      language,
      timestamp: new Date().toISOString(),
      latencyMs,
    };

    // Store in memory
    const existingMessages = memoryMessages.get(sessionId) || [];
    existingMessages.push(userMessage, aiResponse);
    memoryMessages.set(sessionId, existingMessages);

    if (isMemoryMode) {
      return { userMessage, aiResponse };
    }

    // Persist to Supabase DB if available
    try {
      await prisma.conversationMessage.createMany({
        data: [
          {
            id: userMessage.id,
            sessionId,
            tenantId,
            sender: 'USER',
            text: userMessage.text,
            language: userMessage.language,
            timestamp: new Date(userMessage.timestamp),
          },
          {
            id: aiResponse.id,
            sessionId,
            tenantId,
            sender: 'AI',
            text: aiResponse.text,
            language: aiResponse.language,
            timestamp: new Date(aiResponse.timestamp),
            latencyMs,
          },
        ],
      });
    } catch {
      // Memory state retained
    }

    return { userMessage, aiResponse };
  },

  generateConsultativeResponse(
    userText: string,
    language: VoiceLanguage,
    knowledge: Array<{ title: string; content: string; category: string }>
  ): string {
    const lower = userText.toLowerCase();

    // Check against approved knowledge
    for (const item of knowledge) {
      const matchWord = item.title.toLowerCase().split(' ')[0];
      if (lower.includes(matchWord) || lower.includes(item.category.toLowerCase())) {
        if (language === 'ml-IN') {
          return `ഞങ്ങളുടെ ${item.title}-നെ കുറിച്ച് പറയാൻ സന്തോഷമുണ്ട്: ${item.content} ഇത് നിങ്ങളുടെ ബിസിനസ് ആവശ്യങ്ങൾക്ക് അനുയോജ്യമാണോ?`;
        }
        return `Regarding our ${item.title}: ${item.content}. Does this address what you are looking for in your current workflow?`;
      }
    }

    // Pricing or discount inquiries without specific catalog match -> Guardrail: Do not hallucinate
    if (/price|cost|discount|rate|fees|vila/i.test(lower)) {
      if (language === 'ml-IN') {
        return 'വില വിവരങ്ങളെയും പ്രത്യേക ഓഫറുകളെയും കുറിച്ച് കൃത്യമായ വിവരങ്ങൾ നൽകാൻ ഞങ്ങളുടെ സീനിയർ സെയിൽസ് സ്പെഷ്യലിസ്റ്റിനെക്കൊണ്ട് തിരിച്ചു വിളിപ്പിക്കാം. ഏത് സമയത്താണ് നിങ്ങൾക്ക് സൗകര്യം?';
      }
      return 'To ensure you receive our most accurate, customized pricing and applicable volume tier discounts, I would be happy to schedule a quick call with our Senior Specialist. What time works best for you?';
    }

    // Objection handling: Time / Busy
    if (/busy|later|samayamilla|not now/i.test(lower)) {
      if (language === 'ml-IN') {
        return 'തീർച്ചയായും മനസ്സിലാക്കുന്നു. നിങ്ങളുടെ വിലപ്പെട്ട സമയം നഷ്ടപ്പെടുത്താൻ ആഗ്രഹിക്കുന്നില്ല. നാളെ രാവിലെയാണോ അതോ വൈകുന്നേരമാണോ സംസാരിക്കാൻ അനുയോജ്യം?';
      }
      return 'I completely understand your schedule is tight right now. Would tomorrow morning or later this week be a more convenient time for a brief 5-minute catch-up?';
    }

    // Objection handling: Already have solution / Competitor
    if (/already have|competitor|using another/i.test(lower)) {
      if (language === 'ml-IN') {
        return 'വളരെ നല്ലത്. നിങ്ങളുടെ നിലവിലെ സംവിധാനം മാറ്റാൻ ഞങ്ങൾ നിർബന്ധിക്കുന്നില്ല; എങ്കിലും ഞങ്ങളുടെ ഓട്ടോമേഷൻ ഫീച്ചറുകൾ എങ്ങനെ അധികമൂല്യം നൽകുമെന്ന് കാണാൻ താൽപ്പര്യമുണ്ടോ?';
      }
      return 'That is great that you already have an active process in place. Many of our clients also had existing systems before finding our automated multilingual workflows saved them 40% more operational time. Would you be open to comparing notes?';
    }

    // Malayalam greeting or general inquiry
    if (language === 'ml-IN') {
      return 'നമസ്കാരം! നിങ്ങളുടെ ബിസിനസ് ആവശ്യങ്ങൾ മനസ്സിലാക്കി ഏറ്റവും മികച്ച പരിഹാരം നിർദ്ദേശിക്കാൻ എനിക്ക് സാധിക്കും. നിങ്ങളുടെ പ്രധാന ലക്ഷ്യം എന്താണെന്ന് പറയാമോ?';
    }

    // General English consultative greeting / qualification
    return 'Thank you for sharing that. As a consultative partner, our goal is to understand your specific workflow needs and deliver measurable ROI. Could you share what challenges you are currently facing with your outreach?';
  },

  async endSession(
    tenantId: string,
    sessionId: string,
    input: EndVoiceSessionInput
  ): Promise<VoiceSession | null> {
    const now = new Date();
    const session = await this.getSession(tenantId, sessionId);
    if (!session) return null;

    const started = new Date(session.startedAt).getTime();
    const durationSeconds = Math.max(1, Math.round((now.getTime() - started) / 1000));

    session.status = 'COMPLETED';
    session.endedAt = now.toISOString();
    session.durationSeconds = durationSeconds;
    session.qualificationOutcome = input.qualificationOutcome || 'NEEDS_FOLLOW_UP';
    session.callbackTime = input.callbackTime || null;
    session.notes = input.notes || null;

    // Trigger AI evaluation
    const messages = session.messages || memoryMessages.get(sessionId) || [];
    const evaluation = await conversationEvaluationService.evaluateTranscript(
      tenantId,
      sessionId,
      session.leadId,
      messages,
      session.qualificationOutcome
    );
    session.evaluation = evaluation;

    if (isMemoryMode) {
      memorySessions.set(sessionId, session);
      return session;
    }

    try {
      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          durationSeconds,
          qualificationOutcome: session.qualificationOutcome,
          callbackTime: input.callbackTime ? new Date(input.callbackTime) : null,
          notes: input.notes,
        },
      });

      // If lead is attached and outcome was decided, update lead status
      if (session.leadId && input.qualificationOutcome) {
        let newLeadStatus = 'CONTACTED';
        if (input.qualificationOutcome === 'QUALIFIED') newLeadStatus = 'QUALIFIED';
        else if (input.qualificationOutcome === 'CALLBACK_REQUESTED') newLeadStatus = 'CALLBACK';
        else if (input.qualificationOutcome === 'NOT_INTERESTED') newLeadStatus = 'NOT_INTERESTED';

        await prisma.lead.update({
          where: { id: session.leadId },
          data: { status: newLeadStatus as any },
        });
      }

      return session;
    } catch {
      memorySessions.set(sessionId, session);
      return session;
    }
  },
};
