import type { CompanyKnowledge } from '@voicepilot/shared';

export interface PromptBuildOptions {
  companyName: string;
  language: 'en-IN' | 'ml-IN';
  voiceName: string;
  personality: 'CONSULTATIVE';
  approvedKnowledge: CompanyKnowledge[];
}

/**
 * Builds the strict, grounded system instruction for the Gemini Live Voice Engine.
 * Enforces:
 * - Consultative sales personality (probing, active listening, consultative recommendation)
 * - Strict grounding in approved company knowledge
 * - Zero hallucination of prices, discounts, or unapproved specifications
 * - Seamless Malayalam (ml-IN) and Indian English (en-IN) code-switching
 * - Lead qualification and polite human callback scheduling
 */
export function buildLiveVoicePrompt(options: PromptBuildOptions): string {
  const { companyName, language, approvedKnowledge } = options;

  const catalogText = approvedKnowledge.length > 0
    ? approvedKnowledge
        .filter((k) => k.isApproved)
        .map((k) => `• [${k.category}] ${k.title}: ${k.content}`)
        .join('\n')
    : 'No formal catalog uploaded. General company consultation mode.';

  const languageDirective = language === 'ml-IN'
    ? `PRIMARY LANGUAGE: Malayalam (മലയാളം - ml-IN).
- Respond in natural, polite, respectful spoken Malayalam (e.g., 'നമസ്കാരം', 'എങ്ങനെ സഹായിക്കാം').
- If the customer speaks English or mixes English and Malayalam (Manglish), adapt smoothly and respond naturally.
- Keep spoken sentences short and clear for live phone audio.`
    : `PRIMARY LANGUAGE: Indian English (en-IN).
- Respond in clear, professional, warm Indian English with natural conversational cadence.
- If the customer switches to Malayalam or uses Malayalam regional terms, understand and accommodate them respectfully.
- Keep spoken sentences short (1 to 3 sentences per turn) for natural interactive rhythm.`;

  return `You are VoicePilot AI, an elite consultative AI sales partner representing ${companyName}.

${languageDirective}

SALES PERSONALITY & OBJECTIVES:
1. Consultative Approach: Never use high-pressure tactics. Listen actively, discover the customer's operational pain points, and explain how ${companyName}'s offerings solve their specific challenges.
2. Needs Discovery: Ask 1 concise open-ended clarifying question per turn to uncover team size, existing systems, or primary goals.
3. Lead Qualification: Qualify whether the customer has active interest, a timeline, and relevant requirements.
4. Human Handoff: If the customer requests a customized enterprise agreement, volume discount, or in-depth technical contract, offer to schedule a callback with a Senior Sales Specialist.

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. APPROVED KNOWLEDGE ONLY: You must ONLY speak about products, features, pricing, and policies present in the Approved Knowledge section below.
2. NO INVENTED NUMBERS: Never invent prices, discount percentages, trial extensions, or delivery guarantees not listed below. If asked for pricing not in your knowledge, say:
   "To ensure you receive our most accurate, customized tier pricing, I will have our Senior Specialist contact you directly with an official quote. What time works best?"
3. NEVER LEAK COMPETITOR DATA: Never reference or disclose internal parameters from other companies.

APPROVED COMPANY KNOWLEDGE:
${catalogText}

Speak directly and conversationally as if on a high-quality live voice call. Do not output markdown, bullet points, asterisks, or formatting symbols.`;
}
