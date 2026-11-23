import { z } from 'zod';

export type VoiceSessionStatus = 'INITIALIZING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type ConversationSender = 'USER' | 'AI' | 'SYSTEM';
export type QualificationOutcome = 'QUALIFIED' | 'CALLBACK_REQUESTED' | 'NOT_INTERESTED' | 'NEEDS_FOLLOW_UP';
export type VoiceLanguage = 'en-IN' | 'ml-IN';
export type VoiceGender = 'MALE' | 'FEMALE';
export type VoicePersonality = 'CONSULTATIVE';

export interface VoiceConfig {
  id: string;
  tenantId: string;
  campaignId?: string | null;
  defaultLanguage: VoiceLanguage;
  supportedLanguages: VoiceLanguage[];
  voiceGender: VoiceGender;
  voiceName: string;
  personality: VoicePersonality;
  pitch: number;
  speakingRate: number;
  systemPromptOverride?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  tenantId: string;
  sender: ConversationSender;
  text: string;
  language?: VoiceLanguage | string;
  audioUrl?: string | null;
  confidence?: number | null;
  timestamp: string;
  latencyMs?: number | null;
}

export interface ConversationEvaluation {
  id: string;
  sessionId: string;
  tenantId: string;
  leadId?: string | null;
  leadScore: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  objectionsRaised: string[];
  customerInterest: 'HIGH' | 'MEDIUM' | 'LOW';
  qualificationSummary: string;
  suggestedNextStep: string;
  createdAt: string;
}

export interface VoiceSession {
  id: string;
  tenantId: string;
  campaignId?: string | null;
  leadId?: string | null;
  initiatedById: string;
  language: VoiceLanguage | string;
  voiceName: string;
  status: VoiceSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  qualificationOutcome?: QualificationOutcome | null;
  callbackTime?: string | null;
  notes?: string | null;
  messages?: ConversationMessage[];
  evaluation?: ConversationEvaluation | null;
  createdAt: string;
  updatedAt: string;
}

// Zod Schemas
export const createVoiceSessionSchema = z.object({
  campaignId: z.string().optional(),
  leadId: z.string().optional(),
  language: z.enum(['en-IN', 'ml-IN']).default('en-IN'),
  voiceName: z.string().default('Priya (Warm)'),
  personality: z.enum(['CONSULTATIVE']).default('CONSULTATIVE'),
});

export type CreateVoiceSessionInput = z.infer<typeof createVoiceSessionSchema>;

export const sendVoiceMessageSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1, 'Message text cannot be empty'),
  language: z.enum(['en-IN', 'ml-IN']).optional(),
  clientTimestamp: z.string().optional(),
});

export type SendVoiceMessageInput = z.infer<typeof sendVoiceMessageSchema>;

export const endVoiceSessionSchema = z.object({
  sessionId: z.string().min(1),
  qualificationOutcome: z.enum(['QUALIFIED', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'NEEDS_FOLLOW_UP']).optional(),
  callbackTime: z.string().optional(),
  notes: z.string().optional(),
});

export type EndVoiceSessionInput = z.infer<typeof endVoiceSessionSchema>;

export const updateVoiceConfigSchema = z.object({
  defaultLanguage: z.enum(['en-IN', 'ml-IN']).optional(),
  supportedLanguages: z.array(z.enum(['en-IN', 'ml-IN'])).optional(),
  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),
  voiceName: z.string().min(1).optional(),
  personality: z.enum(['CONSULTATIVE']).optional(),
  pitch: z.number().min(0.5).max(2.0).optional(),
  speakingRate: z.number().min(0.5).max(2.0).optional(),
  systemPromptOverride: z.string().max(2000).optional(),
});

export type UpdateVoiceConfigInput = z.infer<typeof updateVoiceConfigSchema>;
