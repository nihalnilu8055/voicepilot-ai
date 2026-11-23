import React from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, Clock, Wifi } from 'lucide-react';

interface ConversationStatusProps {
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  micStatus: 'IDLE' | 'LISTENING' | 'ERROR' | 'UNSUPPORTED';
  isAiSpeaking: boolean;
  isCustomerSpeaking: boolean;
  durationSeconds: number;
  maxSeconds?: number;
  mode: 'GEMINI_LIVE' | 'BROWSER_SPEECH';
}

export const ConversationStatus: React.FC<ConversationStatusProps> = ({
  connectionStatus,
  micStatus,
  isAiSpeaking,
  isCustomerSpeaking,
  durationSeconds,
  maxSeconds = 600,
  mode,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-4 space-y-3 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-indigo-400" />
          Channel Status
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            connectionStatus === 'CONNECTED'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : connectionStatus === 'CONNECTING'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : connectionStatus === 'ERROR'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-400 animate-pulse'
                : connectionStatus === 'CONNECTING'
                ? 'bg-amber-400 animate-ping'
                : 'bg-slate-500'
            }`}
          />
          {mode === 'GEMINI_LIVE' ? `Live WS: ${connectionStatus}` : `Browser: ${connectionStatus}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Mic Indicator */}
        <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-slate-400 flex items-center gap-1">
            {micStatus === 'LISTENING' ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            Mic:
          </span>
          <span
            className={`font-semibold ${
              isCustomerSpeaking
                ? 'text-emerald-400'
                : micStatus === 'LISTENING'
                ? 'text-slate-300'
                : 'text-slate-500'
            }`}
          >
            {isCustomerSpeaking ? 'Speaking...' : micStatus === 'LISTENING' ? 'Listening' : 'Idle'}
          </span>
        </div>

        {/* AI Audio Output Indicator */}
        <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-slate-400 flex items-center gap-1">
            <Volume2 className={`w-3.5 h-3.5 ${isAiSpeaking ? 'text-indigo-400 animate-bounce' : 'text-slate-500'}`} />
            AI Audio:
          </span>
          <span className={`font-semibold ${isAiSpeaking ? 'text-indigo-400' : 'text-slate-500'}`}>
            {isAiSpeaking ? 'Speaking...' : 'Silent'}
          </span>
        </div>
      </div>

      {/* Free Tier Session Timer */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
        <span className="text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Call Duration:
        </span>
        <div className="flex items-center gap-1 font-mono font-bold text-slate-200">
          <span>{formatTime(durationSeconds)}</span>
          <span className="text-slate-500 text-[10px]">/ {formatTime(maxSeconds)} (Free limit)</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        <span>Anti-hallucination guardrail active (Verified company catalog only)</span>
      </div>
    </div>
  );
};
