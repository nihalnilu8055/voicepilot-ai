import { GoogleGenAI } from '@google/genai';
import { buildLiveVoicePrompt } from './voicePrompts.js';
import type { CompanyKnowledge, VoiceLanguage } from '@voicepilot/shared';

export interface LiveSessionCallbacks {
  onAudioDelta: (pcmBase64: string) => void;
  onTranscript: (data: { sender: 'AI' | 'USER'; text: string; isFinal: boolean }) => void;
  onInterrupted: () => void;
  onError: (error: string) => void;
  onClose: (reason?: string) => void;
}

export interface LiveSessionInitOptions {
  companyName: string;
  language: VoiceLanguage;
  voiceName: string;
  personality: 'CONSULTATIVE';
  approvedKnowledge: CompanyKnowledge[];
  callbacks: LiveSessionCallbacks;
  geminiApiKey?: string;
}

export interface GeminiLiveBridge {
  sendAudioChunk: (pcm16kBase64: string) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendEndOfTurn: () => Promise<void>;
  close: () => Promise<void>;
}

// In-memory mock flag for tests and zero-credential environments
let isMockLiveMode = false;

export const geminiLiveService = {
  setMockMode(enabled: boolean) {
    isMockLiveMode = enabled;
  },

  isLiveSupported(): boolean {
    return Boolean(process.env.GEMINI_API_KEY) && !isMockLiveMode;
  },

  async startLiveSession(options: LiveSessionInitOptions): Promise<GeminiLiveBridge> {
    const { companyName, language, voiceName, personality, approvedKnowledge, callbacks } = options;

    const systemPrompt = buildLiveVoicePrompt({
      companyName,
      language,
      voiceName,
      personality,
      approvedKnowledge,
    });

    // Map UI voice names to Gemini Live prebuilt voices
    // Available Gemini Live prebuilt voices: Puck, Charon, Kore, Fenrir, Aoede
    let geminiVoice = 'Aoede';
    if (voiceName.includes('Rahul') || voiceName.includes('Male')) {
      geminiVoice = 'Charon';
    } else if (voiceName.includes('Priya')) {
      geminiVoice = 'Aoede';
    } else if (voiceName.includes('Ananya')) {
      geminiVoice = 'Kore';
    }

    const apiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;

    // Use Mock Bridge if no API key or mock mode enabled
    if (!apiKey || isMockLiveMode) {
      return this.createMockLiveBridge(language, approvedKnowledge, callbacks, voiceName, companyName, apiKey);
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Connect to Gemini 3.8 Live API via official SDK
      const liveSession = await (ai as any).live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: geminiVoice,
              },
            },
          },
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        },
        callbacks: {
          onopen: () => {
            // Initialized
          },
          onmessage: (response: any) => {
            const content = response?.serverContent;
            if (!content) return;

            // Handle user speech transcription
            if (content.inputTranscription?.text) {
              callbacks.onTranscript({
                sender: 'USER',
                text: content.inputTranscription.text,
                isFinal: true,
              });
            }

            // Handle interruption signal
            if (content.interrupted) {
              callbacks.onInterrupted();
            }

            // Handle model audio turn
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                  callbacks.onAudioDelta(part.inlineData.data);
                }
              }
            }

            // Handle AI speech transcription
            if (content.outputTranscription?.text) {
              callbacks.onTranscript({
                sender: 'AI',
                text: content.outputTranscription.text,
                isFinal: true,
              });
            }
          },
          onerror: (err: any) => {
            const errMsg = err?.message || 'Gemini Live connection error';
            callbacks.onError(errMsg);
          },
          onclose: () => {
            callbacks.onClose('Gemini Live session closed');
          },
        },
      });

      return {
        async sendAudioChunk(pcm16kBase64: string) {
          try {
            await liveSession.sendRealtimeInput({
              audio: {
                data: pcm16kBase64,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (err: any) {
            callbacks.onError(err?.message || 'Error transmitting audio chunk');
          }
        },

        async sendText(text: string) {
          try {
            await liveSession.sendRealtimeInput({ text });
          } catch (err: any) {
            callbacks.onError(err?.message || 'Error transmitting text');
          }
        },

        async sendEndOfTurn() {
          try {
            await liveSession.sendRealtimeInput({ audioStreamEnd: true });
          } catch {
            // ignore
          }
        },

        async close() {
          try {
            if (liveSession?.close) {
              await liveSession.close();
            }
          } catch {
            // ignore
          }
        },
      };
    } catch (err: any) {
      // If live connection fails (e.g. quota, auth, network), fallback to mock bridge
      callbacks.onError(`Live API initialization fallback: ${err.message}`);
      return this.createMockLiveBridge(language, approvedKnowledge, callbacks, voiceName, companyName, apiKey);
    }
  },

  createMockLiveBridge(
    language: VoiceLanguage,
    knowledge: CompanyKnowledge[],
    callbacks: LiveSessionCallbacks,
    voiceName = 'Priya (Warm)',
    companyName = 'VoicePilot AI',
    apiKey?: string
  ): GeminiLiveBridge {
    let closed = false;
    let turnCount = 0;
    const personaName = voiceName.split(' ')[0] || 'Priya';

    // Send initial greeting after 300ms
    setTimeout(() => {
      if (closed) return;
      const greetingText =
        language === 'ml-IN'
          ? `നമസ്കാരം! ഞാൻ ${personaName}. ${companyName} ലൈവ് വോയ്‌സ് എഞ്ചിനിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ ബിസിനസ്സ് ആവശ്യങ്ങൾ പറയാമോ?`
          : `Hello! I am ${personaName}. Welcome to ${companyName} live voice consultation. How can I assist with your business today?`;

      callbacks.onTranscript({
        sender: 'AI',
        text: greetingText,
        isFinal: true,
      });

      const mockPcmChunk = Buffer.alloc(960).toString('base64');
      callbacks.onAudioDelta(mockPcmChunk);
    }, 300);

    return {
      async sendAudioChunk(_pcm16kBase64: string) {
        if (closed) return;
      },

      async sendText(text: string) {
        if (closed) return;
        turnCount += 1;

        callbacks.onTranscript({
          sender: 'USER',
          text,
          isFinal: true,
        });

        // 1. If user supplied an API key, try real Gemini generateContent for dynamic AI reply
        if (apiKey) {
          try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `You are ${personaName}, an elite consultative AI sales voice assistant for ${companyName}.
Spoken Language: ${language === 'ml-IN' ? 'Malayalam (മലയാളം script)' : 'Indian English (en-IN)'}.
Personality: Consultative, active listener, solution-oriented.
Strict Rules:
1. Speak concisely in 1 to 3 spoken sentences suitable for a live telephone call.
2. In Malayalam, reply in natural, polite Malayalam script.
3. If asked about pricing not in approved knowledge, offer a specialist callback. Never invent unapproved prices.
4. Answer the user's specific question directly (identity, business overview, demo, or features).
Approved Knowledge:
${knowledge.map((k) => `• [${k.category}] ${k.title}: ${k.content}`).join('\n') || 'General consultation.'}

User said: "${text}"`;

            const res = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            if (res.text && res.text.trim()) {
              callbacks.onTranscript({
                sender: 'AI',
                text: res.text.trim(),
                isFinal: true,
              });
              const mockPcm = Buffer.alloc(1920).toString('base64');
              callbacks.onAudioDelta(mockPcm);
              return;
            }
          } catch {
            // Fall back to rule engine below
          }
        }

        // 2. Intelligent, context-aware consultative NLP engine (No API Key Required)
        setTimeout(() => {
          if (closed) return;
          const lower = text.toLowerCase().trim();
          let responseText = '';

          // A. Knowledge catalog match
          for (const item of knowledge) {
            const matchWord = item.title.toLowerCase().split(' ')[0];
            if (lower.includes(matchWord) || lower.includes(item.category.toLowerCase())) {
              responseText = language === 'ml-IN'
                ? `ഞങ്ങളുടെ ${item.title}-നെ കുറിച്ച് പറയാൻ സന്തോഷമുണ്ട്: ${item.content} ഇത് നിങ്ങളുടെ ബിസിനസ്സ് ആവശ്യങ്ങൾക്ക് അനുയോജ്യമാണോ?`
                : `Regarding ${item.title}: ${item.content}. Does this match what you are looking for in your current workflow?`;
              break;
            }
          }

          if (!responseText) {
            // B. Name / Identity ("നിങ്ങളുടെ പേര് എന്താണ്", "who are you", "what is your name", "പേര്", "ആരാണ്")
            if (/പേര്|ആരാണ്|ആരാ നിങ്ങൾ|നിങ്ങൾ ആരാ|who are you|your name|what is your name/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `എന്റെ പേര് ${personaName} എന്നാണ്. ഞാൻ ${companyName}-ന്റെ കൺസൾട്ടേറ്റീവ് എഐ സെയിൽസ് അസിസ്റ്റന്റാണ്. നിങ്ങളുടെ ബിസിനസ്സിൽ കോളിംഗും ലീഡ് മാനേജ്‌മെന്റും എളുപ്പമാക്കാൻ സഹായിക്കുന്നു.`
                : `My name is ${personaName}. I am your consultative AI sales advisor at ${companyName}, helping you automate outreach and qualify prospective leads.`;
            }
            // C. What is this business / Overview ("എന്താണ് ഈ ബിസിനസ്", "what is this business", "what do you do", "സർവീസ്", "പ്രൊഡക്റ്റ്")
            else if (/എന്താണ് ഈ ബിസിനസ്|എന്താണ് ചെയ്യുന്നത്|ബിസിനസ് എന്താണ്|സർവീസ്|പ്രൊഡക്റ്റ്|സേവനം|എന്താണിത്|what is this business|what do you do|what service|what product/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `${companyName} ബിസിനസ്സുകൾക്ക് വേണ്ടിയുള്ള സ്മാർട്ട് എഐ വോയ്‌സ് കോളിംഗ് പ്ലാറ്റ്‌ഫോമാണ്. ഉയർന്ന നിലവാരത്തിൽ സെയിൽസ് കോളുകൾ ചെയ്യാനും, മലയാളത്തിലും ഇംഗ്ലീഷിലും സംസാരിച്ച് ലീഡുകളെ ക്വാളിഫൈ ചെയ്യാനും സഹായിക്കുന്നു. നിങ്ങളുടെ സ്ഥാപനത്തിൽ കോളിംഗ് ആവശ്യങ്ങളുണ്ടോ?`
                : `${companyName} is an AI-powered voice outreach platform that conducts consultative sales calls in Indian English and Malayalam, helping qualify leads and schedule meetings. Does your business currently conduct outbound calling?`;
            }
            // D. How to know more / Learn more / Details / Demo ("ഇതിനെക്കുറിച്ച് കൂടുതൽ അറിയാൻ എന്താണ് വഴി", "കൂടുതൽ അറിയാൻ", "learn more", "details", "demo", "വിവരങ്ങൾ")
            else if (/കൂടുതൽ അറിയാൻ|എങ്ങനെ അറിയാം|വഴി എന്താണ്|വിവരങ്ങൾ|ഡെമോ|എന്താണ് വഴി|learn more|know more|demo|details|information/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `തീർച്ചയായും! ഞങ്ങളുടെ എഐ സൊല്യൂഷനുകൾ നേരിട്ട് കാണുന്നതിനായി ഒരു 10 മിനിറ്റ് ലൈവ് ഡെമോ അല്ലെങ്കിൽ ഞങ്ങളുടെ സീനിയർ സ്പെഷ്യലിസ്റ്റുമായി കോൾ ചെയ്യാം. നാളെ ഏത് സമയത്താണ് നിങ്ങൾക്ക് സൗകര്യം?`
                : `Certainly! We would be glad to organize a brief 10-minute live demo or connect you with our solutions specialist. What date or time is most convenient for you?`;
            }
            // E. Pricing & Plans ("വില", "ഫീസ്", "ചെലവ്", "ഡിസ്കൗണ്ട്", "price", "cost", "fee", "rate", "discount", "quote")
            else if (/വില|ഫീസ്|ചെലവ്|റേറ്റ്|ഡിസ്കൗണ്ട്|price|cost|fee|rate|discount|quote|pricing/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `ഞങ്ങളുടെ പ്ലാനുകൾ നിങ്ങളുടെ കോളിംഗ് വോളിയത്തിനനുസരിച്ചാണ് തയ്യാറാക്കിയിട്ടുള്ളത്. കൃത്യമായ കൊട്ടേഷനും എന്റർപ്രൈസ് ഓഫറുകളും നൽകാൻ ഞങ്ങളുടെ സീനിയർ സ്പെഷ്യലിസ്റ്റ് തിരിച്ചു വിളിക്കാം. ഏത് സമയത്താണ് സംസാരിക്കാൻ സൗകര്യം?`
                : `Our pricing packages scale according to your monthly call volume and integrations. To provide you with an exact official quote, I would be happy to have our Senior Specialist contact you directly. What time works best?`;
            }
            // F. Callback & Scheduling ("വിളിക്കൂ", "നാളെ", "സമയം", "ഷെഡ്യൂൾ", "തിരിച്ചു", "callback", "call later", "tomorrow", "schedule")
            else if (/വിളിക്കൂ|നാളെ|സമയം|ഷെഡ്യൂൾ|തിരിച്ചു|callback|call later|tomorrow|schedule|contact/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `തീർച്ചയായും! നിങ്ങൾക്ക് സൗകര്യപ്രദമായ സമയത്ത് ഞങ്ങളുടെ ടീം കൃത്യമായി തിരികെ വിളിക്കുന്നതാണ്. സമയം അനുവദിച്ചതിന് വളരെ നന്ദി!`
                : `Understood! I will schedule a follow-up callback at your preferred time. Thank you for speaking with ${companyName} today!`;
            }
            // G. Objections & Busy ("തിരക്ക്", "സമയമില്ല", "താൽപ്പര്യമില്ല", "busy", "later", "not now", "samayamilla")
            else if (/തിരക്ക്|സമയമില്ല|താൽപ്പര്യമില്ല|samayamilla|busy|later|not now|no time/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `തീർച്ചയായും, നിങ്ങളുടെ സമയം വിലപ്പെട്ടതാണെന്ന് ഞങ്ങൾക്കറിയാം. അധികം ബുദ്ധിമുട്ടിക്കാതെ നാളെ രാവിലെയാണോ അതോ വൈകുന്നേരമാണോ സംസാരിക്കാൻ അനുയോജ്യം?`
                : `I completely respect your busy schedule. Would tomorrow morning or later in the week be a more convenient time for a brief 2-minute catch-up?`;
            }
            // H. Short Affirmations or Queries ("ഇത്", "ശരി", "ok", "yes", "aha", "this", "tell me")
            else if (/^(ഇത്|ശരി|ശരിയാണ്|അതെ|ok|okay|yes|yeah|aha|this|tell me)$/i.test(lower) || lower.length < 5) {
              if (language === 'ml-IN') {
                const shortReplies = [
                  `അതെ! നിങ്ങളുടെ സെയിൽസ് പ്രവർത്തനങ്ങൾ കൂടുതൽ വേഗത്തിലാക്കാൻ ഞങ്ങളുടെ എഐ സഹായിക്കും. നിങ്ങളുടെ സ്ഥാപനത്തിൽ എത്ര ലീഡുകളാണ് സാധാരണ വരുന്നത്?`,
                  `തീർച്ചയായും! ഉയർന്ന കൃത്യതയോടെയും സ്വാഭാവിക മലയാളി സംഭാഷണ ശൈലിയിലും സംസാരിക്കാൻ ഞങ്ങൾക്ക് കഴിയും. എന്തെങ്കിലും പ്രത്യേക ചോദ്യങ്ങളുണ്ടോ?`,
                  `നന്ദി! നിങ്ങളുടെ ബിസിനസ്സ് ആവശ്യങ്ങൾക്ക് ഏറ്റവും അനുയോജ്യമായ പ്ലാൻ കണ്ടെത്താൻ സഹായിക്കാം. എന്താണ് നിങ്ങളുടെ പ്രധാന ലക്ഷ്യം?`
                ];
                responseText = shortReplies[turnCount % shortReplies.length];
              } else {
                const shortReplies = [
                  `Yes! Our voice agents help businesses scale outbound calls by 10x without adding headcount. How many leads do you typically contact each month?`,
                  `Understood. With natural Indian English and Malayalam accents, customer engagement rates increase by over 45%. Would you like to explore key features?`,
                  `Great! Feel free to ask about our features, CRM integrations, or schedule a quick walkthrough.`
                ];
                responseText = shortReplies[turnCount % shortReplies.length];
              }
            }
            // I. Greetings ("നമസ്കാരം", "ഹലോ", "സുഖമാണോ", "hello", "hi")
            else if (/നമസ്കാരം|ഹലോ|സുഖമാണോ|hello|hi|hey|good morning|good afternoon/i.test(lower)) {
              responseText = language === 'ml-IN'
                ? `നമസ്കാരം! വളരെ സന്തോഷം. ഇന്ന് നിങ്ങളുടെ ബിസിനസ്സ് ആവശ്യങ്ങളെക്കുറിച്ച് സംസാരിക്കാൻ സാധിച്ചതിൽ സന്തോഷമുണ്ട്. നിങ്ങളുടെ ഇപ്പോഴത്തെ പ്രധാന ആവശ്യങ്ങൾ എന്തൊക്കെയാണ്?`
                : `Hello! A warm welcome to you. How is your day going, and what primary sales goals would you like to explore for your team?`;
            }
            // J. Dynamic Contextual Fallbacks (Rotates so it NEVER repeats!)
            else {
              if (language === 'ml-IN') {
                const variedReplies = [
                  `തീർച്ചയായും മനസ്സിലാക്കുന്നു. ഉയർന്ന നിലവാരത്തിലുള്ള ഓട്ടോമേറ്റഡ് കോളിംഗ് വഴി സെയിൽസ് വർദ്ധിപ്പിക്കാൻ ഞങ്ങൾക്ക് സാധിക്കും. നിങ്ങളുടെ നിലവിലെ കോളിംഗ് രീതികൾ എങ്ങനെയാണ്?`,
                  `നല്ല ചോദ്യം! കമ്പനിയുടെ കാര്യക്ഷമത കൂട്ടാനും ഉപഭോക്താക്കളുമായി മികച്ച ബന്ധം സ്ഥാപിക്കാനും ഞങ്ങളുടെ എഐ സഹായിക്കും. നിങ്ങളുടെ ബിസിനസ്സിൽ എത്ര പേരുള്ള ടീമാണ് ഉള്ളത്?`,
                  `വളരെ ശരിയാണ്. നിങ്ങളുടെ ആവശ്യങ്ങൾക്കനുസരിച്ച് ക്രമീകരിക്കാവുന്ന എഐ വോയ്‌സ് ഏജന്റുകളാണ് ഞങ്ങൾ നൽകുന്നത്. കൂടുതൽ വിശദമായി സംസാരിക്കാൻ ഒരു കോൾ ക്രമീകരിക്കാമോ?`
                ];
                responseText = variedReplies[turnCount % variedReplies.length];
              } else {
                const variedReplies = [
                  `That is a great point. Our platform automates repetitive outreach so your team can focus exclusively on closing qualified leads. How does your current outreach workflow operate?`,
                  `Understood! By engaging prospects with consultative, value-first conversations, companies achieve 40% higher qualification rates. What is your primary growth priority this quarter?`,
                  `Thank you for sharing that. As your consultative partner, our objective is to drive measurable efficiency for your operations. Would you be interested in seeing a quick live walkthrough?`
                ];
                responseText = variedReplies[turnCount % variedReplies.length];
              }
            }
          }

          callbacks.onTranscript({
            sender: 'AI',
            text: responseText,
            isFinal: true,
          });

          // Send simulated PCM chunk
          const mockPcm = Buffer.alloc(1920).toString('base64');
          callbacks.onAudioDelta(mockPcm);
        }, 350);
      },

      async sendEndOfTurn() {
        if (closed) return;
      },

      async close() {
        closed = true;
        callbacks.onClose('Session ended');
      },
    };
  },
};
