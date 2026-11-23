import React, { useRef, useEffect } from 'react';
import { Bot, User, Send, Mic, Sparkles, Volume2 } from 'lucide-react';
import type { ConversationMessage } from '@voicepilot/shared';

interface TranscriptPanelProps {
  messages: ConversationMessage[];
  isAiSpeaking: boolean;
  isCustomerSpeaking: boolean;
  interimTranscript?: string;
  manualInput: string;
  onManualInputChange: (val: string) => void;
  onSendMessage: (text: string) => void;
  isActive: boolean;
  mode: 'GEMINI_LIVE' | 'BROWSER_SPEECH';
  onQuickPrompt?: (promptText: string) => void;
  isListening?: boolean;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  messages,
  isAiSpeaking,
  isCustomerSpeaking,
  interimTranscript,
  manualInput,
  onManualInputChange,
  onSendMessage,
  isActive,
  mode,
  onQuickPrompt,
  isListening,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiSpeaking, interimTranscript]);

  const quickPrompts = [
    { label: '👋 Hello / Intro', text: 'Hello! I would like to know more about VoicePilot AI.' },
    { label: '📦 Product Features', text: 'What core features and CRM integrations do you support?' },
    { label: '💰 Pricing & Plans', text: 'What are your enterprise subscription pricing plans?' },
    { label: '📞 Book Callback', text: 'Can you schedule a callback with your sales specialist for tomorrow?' },
    { label: 'മലയാളം: നമസ്കാരം', text: 'നമസ്കാരം! നിങ്ങളുടെ പ്രൊഡക്റ്റുകൾ എന്തൊക്കെയാണ് എന്ന് പറയാമോ?' },
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl h-[640px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {isActive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isActive ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            ></span>
          </span>
          <span className="text-sm font-semibold text-white">
            Live Consultation Transcript
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isListening && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 animate-pulse">
              <Mic className="w-3 h-3 text-emerald-400" /> Mic Active
            </span>
          )}
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {mode === 'GEMINI_LIVE' ? 'Gemini 3.8 Live WebSocket' : 'Browser Engine (₹0)'}
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Mic className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Voice Conversation Ready</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Click <strong className="text-emerald-400">&quot;Start Voice Conversation&quot;</strong> on the left, then speak into your microphone or click any quick prompt below to test voice consultation.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`flex items-start gap-3 ${
                msg.sender === 'USER' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  msg.sender === 'USER'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                }`}
              >
                {msg.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md text-sm ${
                  msg.sender === 'USER'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 opacity-80">
                  <span className="text-[11px] font-semibold">
                    {msg.sender === 'USER' ? 'Customer (You)' : 'VoicePilot AI'}
                  </span>
                  {msg.language && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/25 font-mono">
                      {msg.language}
                    </span>
                  )}
                  {msg.latencyMs !== undefined && (
                    <span className="text-[10px] opacity-70">{msg.latencyMs}ms</span>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))
        )}

        {/* Live Interim Speech Preview */}
        {interimTranscript && (
          <div className="flex items-start gap-3 flex-row-reverse animate-pulse">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Mic className="w-4 h-4" />
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-indigo-900/60 border border-indigo-500/30 text-indigo-100 text-sm rounded-tr-none italic">
              <span className="text-[10px] font-semibold text-emerald-400 block mb-0.5">Speaking into mic...</span>
              {interimTranscript}
            </div>
          </div>
        )}

        {isAiSpeaking && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse pl-11">
            <Volume2 className="w-4 h-4" />
            <span>AI is speaking...</span>
          </div>
        )}

        {isCustomerSpeaking && !interimTranscript && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse pl-11">
            <Mic className="w-4 h-4" />
            <span>Customer microphone audio streaming...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Test Voice Prompts Bar */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Test Voice:
        </span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!isActive}
            onClick={() => onQuickPrompt ? onQuickPrompt(qp.text) : onSendMessage(qp.text)}
            className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-indigo-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 text-[11px]"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
        <input
          type="text"
          disabled={!isActive}
          placeholder={
            isActive
              ? 'Speak into your microphone or type a message...'
              : 'Click "Start Voice Conversation" to begin...'
          }
          value={manualInput}
          onChange={(e) => onManualInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualInput.trim()) {
              onSendMessage(manualInput);
            }
          }}
          className="flex-1 text-xs rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        />
        <button
          disabled={!isActive || !manualInput.trim()}
          onClick={() => {
            if (manualInput.trim()) onSendMessage(manualInput);
          }}
          className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          title="Send Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
