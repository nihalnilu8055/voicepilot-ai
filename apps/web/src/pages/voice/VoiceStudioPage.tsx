import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type {
  VoiceSession,
  ConversationMessage,
  ConversationEvaluation,
  CompanyKnowledge,
  VoiceLanguage,
} from '@voicepilot/shared';
import { VoiceSettings } from '../../components/voice/VoiceSettings';
import { VoiceWaveform } from '../../components/voice/VoiceWaveform';
import { ConversationStatus } from '../../components/voice/ConversationStatus';
import { VoiceControls } from '../../components/voice/VoiceControls';
import { TranscriptPanel } from '../../components/voice/TranscriptPanel';
import {
  Mic,
  BookOpen,
  History,
  CheckCircle2,
  Plus,
  AlertTriangle,
  Building2,
} from 'lucide-react';

export const VoiceStudioPage: React.FC = () => {
  const { activeTenant, getAuthToken } = useAuth();
  const token = getAuthToken();

  // Engine Mode
  const [engineMode, setEngineMode] = useState<'GEMINI_LIVE' | 'BROWSER_SPEECH'>('GEMINI_LIVE');

  // Voice Config State
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>('en-IN');
  const [selectedVoice, setSelectedVoice] = useState<string>('Priya (Warm)');

  // Optional Gemini API Key (stored locally for direct testing)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('voicepilot_gemini_api_key') || '';
    } catch {
      return '';
    }
  });

  const handleApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    try {
      localStorage.setItem('voicepilot_gemini_api_key', key);
    } catch {
      // ignore
    }
  };

  // Session State
  const [activeSession, setActiveSession] = useState<VoiceSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionEvaluation, setSessionEvaluation] = useState<ConversationEvaluation | null>(null);
  const [recentSessions, setRecentSessions] = useState<VoiceSession[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio / Speech State
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isCustomerSpeaking, setIsCustomerSpeaking] = useState<boolean>(false);
  const [micStatus, setMicStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'STUDIO' | 'KNOWLEDGE' | 'HISTORY'>('STUDIO');

  // Knowledge base state
  const [knowledgeList, setKnowledgeList] = useState<CompanyKnowledge[]>([]);
  const [showAddKnowledge, setShowAddKnowledge] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'PRODUCTS' | 'PRICING' | 'POLICIES' | 'FAQ'>('PRODUCTS');

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const isSessionActiveRef = useRef<boolean>(false);
  const hasRealPcmStreamingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!activeTenant || !token) return;
    loadSessions();
    loadKnowledge();
  }, [activeTenant, token]);

  // Duration Timer
  useEffect(() => {
    if (activeSession && activeSession.status === 'ACTIVE') {
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeSession]);

  const loadSessions = async () => {
    if (!activeTenant || !token) return;
    try {
      const res = await api.listVoiceSessions(activeTenant.id, token);
      setRecentSessions(res.sessions);
    } catch {
      // Graceful fallback
    }
  };

  const loadKnowledge = async () => {
    if (!activeTenant || !token) return;
    try {
      const res = await api.listKnowledge(activeTenant.id, token);
      setKnowledgeList(res.items);
    } catch {
      // Graceful fallback
    }
  };

  // Convert Float32 buffer to 16-bit PCM Int16 ArrayBuffer
  const convertFloat32ToInt16 = (buffer: Float32Array): ArrayBuffer => {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return buf.buffer;
  };

  // Play PCM 24kHz Audio chunk from Gemini Live
  const playPcm24kChunk = (base64Data: string) => {
    try {
      if (!audioContextOutRef.current || audioContextOutRef.current.state === 'closed') {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      const ctx = audioContextOutRef.current;
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      if (len === 0) return;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      if (int16.length === 0) return;

      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      audioQueueRef.current.push(source);
      setIsAiSpeaking(true);

      source.onended = () => {
        audioQueueRef.current = audioQueueRef.current.filter((s) => s !== source);
        if (audioQueueRef.current.length === 0) {
          setIsAiSpeaking(false);
        }
      };
    } catch {
      // Audio playback buffer error
    }
  };

  // Browser Text-to-Speech Output (Speaks AI response out loud with persona tuning)
  const speakBrowserUtterance = useCallback(
    (text: string, overrideLang?: VoiceLanguage, overrideVoice?: string) => {
      if (!('speechSynthesis' in window) || !text) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = overrideLang || selectedLanguage;
        const targetVoice = overrideVoice || selectedVoice;

        utterance.lang = targetLang === 'ml-IN' ? 'ml-IN' : 'en-IN';

        // Persona Pitch & Cadence Tuning:
        // Rahul = Deep masculine consultative tone
        // Priya = Warm empathetic female tone
        // Ananya = Executive crisp professional tone
        if (targetVoice.includes('Rahul') || targetVoice.includes('Deep')) {
          utterance.pitch = 0.78; // Deep masculine resonance
          utterance.rate = 0.90;  // Measured consultative delivery
        } else if (targetVoice.includes('Priya') || targetVoice.includes('Warm')) {
          utterance.pitch = 1.08; // Warm empathetic female tone
          utterance.rate = 0.96;
        } else if (targetVoice.includes('Ananya') || targetVoice.includes('Professional')) {
          utterance.pitch = 1.00; // Crisp professional female tone
          utterance.rate = 1.02;
        }

        // Voice matching from browser speech synthesis voices
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          if (targetLang === 'ml-IN') {
            const mlVoice = voices.find((v) =>
              v.lang.toLowerCase().includes('ml') || v.name.toLowerCase().includes('malayalam')
            );
            if (mlVoice) {
              utterance.voice = mlVoice;
            } else {
              const inVoice = voices.find(
                (v) => v.lang.toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india')
              );
              if (inVoice) utterance.voice = inVoice;
            }
          } else {
            const isMale = targetVoice.includes('Rahul');
            const matching = voices.find((v) => {
              const n = v.name.toLowerCase();
              const l = v.lang.toLowerCase();
              const isEnIn = l.includes('en-in') || n.includes('india');
              if (isMale) {
                return (
                  (isEnIn && (n.includes('male') || n.includes('ravi') || n.includes('david'))) ||
                  n.includes('david') ||
                  n.includes('george') ||
                  n.includes('mark')
                );
              } else {
                return (
                  (isEnIn && (n.includes('female') || n.includes('heera') || n.includes('veena') || n.includes('priya'))) ||
                  n.includes('zira') ||
                  n.includes('susan')
                );
              }
            });
            if (matching) utterance.voice = matching;
          }
        }

        utterance.onstart = () => setIsAiSpeaking(true);
        utterance.onend = () => setIsAiSpeaking(false);
        utterance.onerror = () => setIsAiSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch {
        setIsAiSpeaking(false);
      }
    },
    [selectedLanguage, selectedVoice]
  );

  const handleTestVoicePersona = (voice: string, lang: VoiceLanguage) => {
    setSelectedVoice(voice);
    setSelectedLanguage(lang);

    let sampleText = '';
    if (lang === 'ml-IN') {
      if (voice.includes('Rahul')) {
        sampleText = 'നമസ്കാരം! ഞാൻ രാഹുൽ. നിങ്ങളുടെ ബിസിനസ്സിന് ഏറ്റവും അനുയോജ്യമായ എഐ കോളിംഗ് സൊല്യൂഷനുകൾ ചർച്ച ചെയ്യാം.';
      } else if (voice.includes('Ananya')) {
        sampleText = 'നമസ്കാരം! ഞാൻ അനന്യ. നിങ്ങളുടെ പ്രൊഫഷണൽ എന്റർപ്രൈസ് സൊല്യൂഷനുകൾക്കായി ഞങ്ങൾ സദാ തയ്യാറാണ്.';
      } else {
        sampleText = 'നമസ്കാരം! ഞാൻ പ്രിയ. വോയ്‌സ്പൈലറ്റ് എഐ-ലേക്ക് സ്വാഗതം. നിങ്ങളുടെ ബിസിനസ്സ് ആവശ്യങ്ങൾ പറയാമോ?';
      }
    } else {
      if (voice.includes('Rahul')) {
        sampleText = 'Hello! I am Rahul, your consultative sales partner at VoicePilot AI. How can I assist with your workflow?';
      } else if (voice.includes('Ananya')) {
        sampleText = 'Hello! I am Ananya, your professional enterprise specialist at VoicePilot AI.';
      } else {
        sampleText = 'Hello! I am Priya, your warm consultative sales advisor at VoicePilot AI.';
      }
    }

    speakBrowserUtterance(sampleText, lang, voice);
  };

  // Clear Audio playback queue on user interruption
  const stopAudioPlayback = () => {
    for (const source of audioQueueRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore
      }
    }
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    setIsAiSpeaking(false);
  };

  // SETUP CONTINUOUS SPEECH RECOGNITION (BROWSER MIC STT)
  const initSpeechRecognition = (onTranscriptResult: (text: string) => void) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicStatus('UNSUPPORTED');
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage === 'ml-IN' ? 'ml-IN' : 'en-IN';

      recognition.onstart = () => {
        setMicStatus('LISTENING');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalized += chunk;
          } else {
            interim += chunk;
          }
        }

        setInterimTranscript(interim);

        if (finalized.trim().length > 0) {
          setInterimTranscript('');
          onTranscriptResult(finalized.trim());
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          setMicStatus('ERROR');
          setErrorMessage('Microphone access denied. Please allow microphone permissions in your browser.');
        }
      };

      recognition.onend = () => {
        if (isSessionActiveRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognition.start();
      return recognition;
    } catch {
      return null;
    }
  };

  // START GEMINI LIVE WEBSOCKET SESSION
  const startGeminiLiveSession = async () => {
    if (!activeTenant || !token) return;

    setIsStarting(true);
    setErrorMessage(null);
    setConnectionStatus('CONNECTING');
    setDurationSeconds(0);
    setSessionEvaluation(null);
    setMessages([]);
    hasRealPcmStreamingRef.current = false;
    isSessionActiveRef.current = true;

    try {
      // 1. Capture microphone audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      setAudioStream(stream);

      // 2. Open WebSocket to Fastify Gemini Live Gateway
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/tenants/${activeTenant.id}/voice/live?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('CONNECTED');
        setIsStarting(false);
        setMicStatus('LISTENING');

        // Send auth handshake with optional API key
        ws.send(
          JSON.stringify({
            type: 'auth',
            token,
            language: selectedLanguage,
            voiceName: selectedVoice,
            geminiApiKey: geminiApiKey.trim() || undefined,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setActiveSession({
              id: msg.sessionId,
              tenantId: activeTenant.id,
              initiatedById: '',
              language: msg.language,
              voiceName: msg.voiceName,
              status: 'ACTIVE',
              startedAt: new Date().toISOString(),
              durationSeconds: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else if (msg.type === 'audio') {
            hasRealPcmStreamingRef.current = true;
            playPcm24kChunk(msg.data);
          } else if (msg.type === 'transcript') {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg_${Date.now()}_${Math.random()}`,
                sessionId: activeSession?.id || '',
                tenantId: activeTenant.id,
                sender: msg.sender,
                text: msg.text,
                language: selectedLanguage,
                timestamp: new Date().toISOString(),
              },
            ]);

            // When AI responds in simulated mode, speak it out loud!
            if (msg.sender === 'AI' && !hasRealPcmStreamingRef.current) {
              speakBrowserUtterance(msg.text);
            }
          } else if (msg.type === 'interrupted') {
            stopAudioPlayback();
          } else if (msg.type === 'session_completed') {
            setActiveSession(msg.session);
            if (msg.session?.evaluation) {
              setSessionEvaluation(msg.session.evaluation);
            }
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || 'Gemini Live error occurred');
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setConnectionStatus('ERROR');
        setErrorMessage('WebSocket connection error. Verify backend server is running on port 3000.');
      };

      ws.onclose = () => {
        setConnectionStatus('DISCONNECTED');
        setMicStatus('IDLE');
        cleanupAudio();
      };

      // 3. AudioContext & ScriptProcessor for 16kHz PCM streaming
      const audioCtxIn = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const source = audioCtxIn.createMediaStreamSource(stream);
      const processor = audioCtxIn.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Detect speaking level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const rms = Math.sqrt(sum / inputData.length);
        setIsCustomerSpeaking(rms > 0.02);

        // Interruption handling
        if (rms > 0.04 && isAiSpeaking) {
          stopAudioPlayback();
        }

        const pcm16 = convertFloat32ToInt16(inputData);
        const bytes = new Uint8Array(pcm16);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = window.btoa(binary);

        ws.send(JSON.stringify({ type: 'audio', data: base64Audio }));
      };

      source.connect(processor);
      processor.connect(audioCtxIn.destination);

      audioContextInRef.current = audioCtxIn;
      scriptProcessorRef.current = processor;

      // 4. Initialize Speech Recognition so user voice is converted to text
      const rec = initSpeechRecognition((spokenText) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'text', text: spokenText }));
        }
      });
      recognitionRef.current = rec;
    } catch (err: any) {
      isSessionActiveRef.current = false;
      setIsStarting(false);
      setConnectionStatus('ERROR');
      setErrorMessage(`Could not access microphone: ${err.message}. Please verify permissions.`);
    }
  };

  // STOP GEMINI LIVE WEBSOCKET SESSION
  const stopGeminiLiveSession = () => {
    isSessionActiveRef.current = false;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'end_session',
          outcome: 'QUALIFIED',
        })
      );
    }
    cleanupAudio();
    loadSessions();
  };

  // Audio Cleanup
  const cleanupAudio = () => {
    isSessionActiveRef.current = false;
    stopAudioPlayback();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach((t) => t.stop());
      setAudioStream(null);
    }
    setIsCustomerSpeaking(false);
    setIsAiSpeaking(false);
    setInterimTranscript('');
  };

  // START BROWSER PROTOTYPE MODE (₹0 Local Fallback)
  const startBrowserPrototypeSession = async () => {
    if (!activeTenant || !token) return;

    setIsStarting(true);
    setErrorMessage(null);
    setMessages([]);
    isSessionActiveRef.current = true;

    try {
      const session = await api.createVoiceSession(activeTenant.id, token, {
        language: selectedLanguage,
        voiceName: selectedVoice,
        personality: 'CONSULTATIVE',
      });

      setActiveSession(session);
      setMessages(session.messages || []);
      setSessionEvaluation(null);
      setConnectionStatus('CONNECTED');
      setIsStarting(false);

      // Play welcome greeting via speech synthesis
      if (session.messages && session.messages.length > 0) {
        speakBrowserUtterance(session.messages[0].text);
      }

      // Audio stream for visualizer
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      // Speech recognition
      const rec = initSpeechRecognition((spokenText) => {
        sendBrowserMessageTurn(spokenText);
      });
      recognitionRef.current = rec;
    } catch (err: any) {
      isSessionActiveRef.current = false;
      setIsStarting(false);
      setConnectionStatus('ERROR');
      setErrorMessage(`Browser prototype error: ${err.message}`);
    }
  };

  const stopBrowserPrototypeSession = async () => {
    if (!activeTenant || !token || !activeSession) return;
    isSessionActiveRef.current = false;

    cleanupAudio();
    setConnectionStatus('DISCONNECTED');
    setMicStatus('IDLE');

    try {
      const ended = await api.endVoiceSession(activeTenant.id, token, activeSession.id, {
        sessionId: activeSession.id,
        qualificationOutcome: 'QUALIFIED',
      });
      setActiveSession(ended);
      if (ended.evaluation) {
        setSessionEvaluation(ended.evaluation);
      }
      loadSessions();
    } catch (err: any) {
      setErrorMessage(`Error concluding session: ${err.message}`);
    }
  };

  const sendBrowserMessageTurn = async (text: string) => {
    if (!activeTenant || !token || !activeSession || !text.trim()) return;
    setManualInput('');

    try {
      const res = await api.sendVoiceMessage(activeTenant.id, token, activeSession.id, {
        text,
        language: selectedLanguage,
      });
      setMessages((prev) => [...prev, res.userMessage, res.aiResponse]);
      speakBrowserUtterance(res.aiResponse.text);
    } catch (err: any) {
      setErrorMessage(`Turn error: ${err.message}`);
    }
  };

  // Unified Start/Stop Handlers
  const handleStartSession = () => {
    if (engineMode === 'GEMINI_LIVE') {
      startGeminiLiveSession();
    } else {
      startBrowserPrototypeSession();
    }
  };

  const handleStopSession = () => {
    if (engineMode === 'GEMINI_LIVE') {
      stopGeminiLiveSession();
    } else {
      stopBrowserPrototypeSession();
    }
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    if (engineMode === 'GEMINI_LIVE') {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'text', text: text.trim() }));
        setManualInput('');
      } else {
        setErrorMessage('Voice WebSocket is not connected. Click Start Voice Conversation.');
      }
    } else {
      sendBrowserMessageTurn(text.trim());
    }
  };

  const handleCreateKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !token || !newTitle || !newContent) return;

    try {
      await api.createKnowledge(activeTenant.id, token, {
        title: newTitle,
        content: newContent,
        category: newCategory,
        tags: [newCategory],
        isApproved: true,
      });

      setNewTitle('');
      setNewContent('');
      setShowAddKnowledge(false);
      loadKnowledge();
    } catch (err: any) {
      alert(`Failed to save knowledge: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="h-7 w-7 text-indigo-400" />
              AI Voice Studio
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Gemini Live 3.8
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time interactive voice consultation engine powered by Google Gemini Live over WebSockets with Malayalam & Indian English.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 p-1">
          <button
            onClick={() => setActiveTab('STUDIO')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'STUDIO'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Live Studio
          </button>
          <button
            onClick={() => setActiveTab('KNOWLEDGE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'KNOWLEDGE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base ({knowledgeList.length})
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Session History
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-bold ml-2 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: LIVE STUDIO */}
      {activeTab === 'STUDIO' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Settings, Waveform, Status, Controls */}
          <div className="lg:col-span-1 space-y-4">
            <VoiceSettings
              mode={engineMode}
              onModeChange={setEngineMode}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              geminiApiKey={geminiApiKey}
              onGeminiApiKeyChange={handleApiKeyChange}
              disabled={Boolean(activeSession && activeSession.status === 'ACTIVE')}
              onTestVoice={handleTestVoicePersona}
            />

            <VoiceWaveform
              isAiSpeaking={isAiSpeaking}
              isCustomerSpeaking={isCustomerSpeaking}
              audioStream={audioStream}
            />

            <ConversationStatus
              connectionStatus={connectionStatus}
              micStatus={micStatus}
              isAiSpeaking={isAiSpeaking}
              isCustomerSpeaking={isCustomerSpeaking}
              durationSeconds={durationSeconds}
              maxSeconds={600}
              mode={engineMode}
            />

            <VoiceControls
              isActive={Boolean(activeSession && activeSession.status === 'ACTIVE')}
              onStart={handleStartSession}
              onStop={handleStopSession}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              isStarting={isStarting}
            />
          </div>

          {/* Right Column: Live Transcript Panel */}
          <div className="lg:col-span-2">
            <TranscriptPanel
              messages={messages}
              isAiSpeaking={isAiSpeaking}
              isCustomerSpeaking={isCustomerSpeaking}
              interimTranscript={interimTranscript}
              manualInput={manualInput}
              onManualInputChange={setManualInput}
              onSendMessage={handleSendMessage}
              onQuickPrompt={handleSendMessage}
              isActive={Boolean(activeSession && activeSession.status === 'ACTIVE')}
              mode={engineMode}
              isListening={micStatus === 'LISTENING'}
            />
          </div>
        </div>
      )}

      {/* Post-Call Evaluation Card */}
      {sessionEvaluation && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-6 space-y-4 text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Automated Lead Evaluation & Next Step Recommendation
            </h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-medium border border-slate-700">
              Session ID: {sessionEvaluation.sessionId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead Score</span>
              <div className="text-3xl font-extrabold text-indigo-400 mt-1">
                {sessionEvaluation.leadScore}/100
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sentiment</span>
              <div
                className={`text-lg font-bold mt-2 ${
                  sessionEvaluation.sentiment === 'POSITIVE'
                    ? 'text-emerald-400'
                    : sessionEvaluation.sentiment === 'NEGATIVE'
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {sessionEvaluation.sentiment}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interest Level</span>
              <div className="text-lg font-bold text-slate-200 mt-2">
                {sessionEvaluation.customerInterest}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Objections Raised</span>
              <div className="text-xs font-semibold text-slate-300 mt-2">
                {sessionEvaluation.objectionsRaised.length > 0
                  ? sessionEvaluation.objectionsRaised.join(', ')
                  : 'None detected'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50">
              <span className="text-xs font-bold text-indigo-300 uppercase">Qualification Summary</span>
              <p className="text-xs text-indigo-200 mt-1 leading-relaxed">{sessionEvaluation.qualificationSummary}</p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/50">
              <span className="text-xs font-bold text-emerald-300 uppercase">Suggested Next Step</span>
              <p className="text-xs text-emerald-200 mt-1 leading-relaxed">{sessionEvaluation.suggestedNextStep}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY KNOWLEDGE BASE */}
      {activeTab === 'KNOWLEDGE' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Approved Company Knowledge Base</h2>
              <p className="text-xs text-slate-400">
                Ground the AI voice representative on authorized products, pricing, and policies. Strict anti-hallucination safeguards prevent fabricating unapproved details.
              </p>
            </div>

            <button
              onClick={() => setShowAddKnowledge(!showAddKnowledge)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Knowledge Article
            </button>
          </div>

          {showAddKnowledge && (
            <form onSubmit={handleCreateKnowledge} className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-3">
              <h3 className="text-sm font-semibold text-white">Add New Knowledge Article</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Article Title (e.g. ERP Sync Pro)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="sm:col-span-2 text-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="text-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PRODUCTS">Products</option>
                  <option value="PRICING">Pricing & Plans</option>
                  <option value="POLICIES">Policies & Terms</option>
                  <option value="FAQ">FAQ</option>
                </select>
              </div>
              <textarea
                placeholder="Approved content, specifications, and details the AI may speak..."
                rows={3}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddKnowledge(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-500"
                >
                  Save to Knowledge Base
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledgeList.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No knowledge articles saved yet.</p>
              </div>
            ) : (
              knowledgeList.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SESSION HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Voice Session History</h2>
          <div className="divide-y divide-slate-800">
            {recentSessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recorded voice sessions found.</p>
            ) : (
              recentSessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{s.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {s.language}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                          s.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Started: {new Date(s.startedAt).toLocaleString()} • Duration: {s.durationSeconds}s
                    </p>
                  </div>
                  {s.qualificationOutcome && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      {s.qualificationOutcome}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
