import React, { useState } from 'react';
import { Sparkles, Globe, Cpu, Key, ChevronDown, ChevronUp, ShieldCheck, Volume2, Play } from 'lucide-react';
import type { VoiceLanguage } from '@voicepilot/shared';

interface VoiceSettingsProps {
  mode: 'GEMINI_LIVE' | 'BROWSER_SPEECH';
  onModeChange: (mode: 'GEMINI_LIVE' | 'BROWSER_SPEECH') => void;
  selectedLanguage: VoiceLanguage;
  onLanguageChange: (lang: VoiceLanguage) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  geminiApiKey: string;
  onGeminiApiKeyChange: (key: string) => void;
  disabled: boolean;
  onTestVoice?: (voice: string, lang: VoiceLanguage) => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  mode,
  onModeChange,
  selectedLanguage,
  onLanguageChange,
  selectedVoice,
  onVoiceChange,
  geminiApiKey,
  onGeminiApiKeyChange,
  disabled,
  onTestVoice,
}) => {
  const [showKeyInput, setShowKeyInput] = useState<boolean>(Boolean(geminiApiKey));

  const voicePersonas = [
    { id: 'Priya (Warm)', label: 'Priya — Warm & Empathetic', gender: 'Female', pitch: 'Warm female' },
    { id: 'Ananya (Professional)', label: 'Ananya — Professional Advisor', gender: 'Female', pitch: 'Executive female' },
    { id: 'Rahul (Deep)', label: 'Rahul — Deep Consultative', gender: 'Male', pitch: 'Deep masculine' },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Voice Engine & Localization
        </h2>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          Consultative
        </span>
      </div>

      {/* Engine Mode Switcher */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          Engine Pipeline
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange('GEMINI_LIVE')}
            className={`p-3 rounded-xl border text-left transition-all ${
              mode === 'GEMINI_LIVE'
                ? 'border-indigo-500 bg-indigo-500/15 text-white ring-1 ring-indigo-500'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            } disabled:opacity-50`}
          >
            <div className="text-xs font-bold flex items-center justify-between">
              Gemini Live API
              <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-semibold">
                WebSocket
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Bidirectional 16k PCM audio streaming (gemini-3.8-live)
            </p>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange('BROWSER_SPEECH')}
            className={`p-3 rounded-xl border text-left transition-all ${
              mode === 'BROWSER_SPEECH'
                ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            } disabled:opacity-50`}
          >
            <div className="text-xs font-bold flex items-center justify-between">
              Browser Engine
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-semibold">
                ₹0 Local
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Zero-cost Web Speech API STT + SpeechSynthesis TTS
            </p>
          </button>
        </div>
      </div>

      {/* Language Selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          Spoken Language & Dialect
        </label>
        <select
          disabled={disabled}
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value as VoiceLanguage)}
          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 p-2.5 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        >
          <option value="en-IN">Indian English (en-IN) — Natural Indian Accent</option>
          <option value="ml-IN">Malayalam (മലയാളം - ml-IN) — Native Spoken Malayalam</option>
        </select>
        <p className="text-[11px] text-slate-400 mt-1">
          Supports natural Malayalam-English code-switching and bilingual audio.
        </p>
      </div>

      {/* Voice Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Voice Persona
          </label>
          {onTestVoice && (
            <button
              type="button"
              onClick={() => onTestVoice(selectedVoice, selectedLanguage)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test Current Voice
            </button>
          )}
        </div>
        <select
          disabled={disabled}
          value={selectedVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 p-2.5 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        >
          <option value="Priya (Warm)">Priya / Aoede — Warm & Empathetic (Female)</option>
          <option value="Ananya (Professional)">Ananya / Kore — Professional Advisor (Female)</option>
          <option value="Rahul (Deep)">Rahul / Charon — Consultative Specialist (Male)</option>
        </select>
      </div>

      {/* Voice & Language Audio Showcase (Interactive Audio Tester) */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            Test All Voices in All Languages
          </span>
          <span className="text-[10px] text-slate-400">Click to listen</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {voicePersonas.map((vp) => (
            <div
              key={vp.id}
              className={`rounded-lg border p-2 text-xs space-y-1.5 ${
                selectedVoice === vp.id
                  ? 'border-indigo-500/50 bg-indigo-950/30'
                  : 'border-slate-800/80 bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-[11px]">{vp.id.split(' ')[0]}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {vp.gender}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onTestVoice && onTestVoice(vp.id, 'en-IN')}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-[10px] text-slate-200 hover:text-white transition-colors"
                  title={`Test ${vp.id} in Indian English`}
                >
                  <Play className="w-2.5 h-2.5" /> en-IN
                </button>

                <button
                  type="button"
                  onClick={() => onTestVoice && onTestVoice(vp.id, 'ml-IN')}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-[10px] text-slate-200 hover:text-white transition-colors"
                  title={`Test ${vp.id} in Malayalam`}
                >
                  <Play className="w-2.5 h-2.5" /> ml-IN
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Gemini API Key Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            Gemini API Key (Optional for Cloud Live Engine)
          </span>
          {showKeyInput ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showKeyInput && (
          <div className="pt-2 space-y-1.5 border-t border-slate-800/80">
            <input
              type="password"
              placeholder="Paste Google AI Studio Gemini API Key (e.g. AIzaSy...)"
              value={geminiApiKey}
              onChange={(e) => onGeminiApiKeyChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 leading-normal">
              If left blank, the prototype uses the built-in ₹0 consultative dialogue engine with browser speech recognition and synthesis. No paid key required.
            </p>
          </div>
        )}
      </div>

      {/* Anti-Hallucination Safe Badge */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-300 font-medium leading-tight">
          Grounding: Strictly constrained to approved company knowledge. Zero invented pricing.
        </span>
      </div>
    </div>
  );
};
