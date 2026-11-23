import React from 'react';
import { PhoneCall, PhoneOff, Mic, MicOff, Info } from 'lucide-react';

interface VoiceControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isStarting: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isActive,
  onStart,
  onStop,
  isMuted,
  onToggleMute,
  isStarting,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {!isActive ? (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-white font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <PhoneCall className="w-5 h-5" />
            {isStarting ? 'Connecting to Voice Engine...' : 'Start Voice Conversation'}
          </button>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              className={`p-3.5 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-amber-400" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-white font-semibold text-sm bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all"
            >
              <PhoneOff className="w-5 h-5" />
              End Conversation & Evaluate
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
        <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>
          {isActive
            ? 'Conversation active: Speak into your microphone, or use quick test prompts.'
            : 'Click Start to open microphone connection and begin live consultation.'}
        </span>
      </div>
    </div>
  );
};
