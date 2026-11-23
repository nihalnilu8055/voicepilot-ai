import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface VoiceWaveformProps {
  isAiSpeaking: boolean;
  isCustomerSpeaking: boolean;
  audioStream: MediaStream | null;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isAiSpeaking,
  isCustomerSpeaking,
  audioStream,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioStream) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      // Draw idle static flat bars
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#334155';
          for (let x = 0; x < canvas.width; x += 8) {
            ctx.fillRect(x, canvas.height / 2 - 1, 4, 2);
          }
        }
      }
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(audioStream);
      source.connect(analyser);
      analyser.fftSize = 64;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteFrequencyData(dataArray);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          let barHeight = (dataArray[i] / 255) * (canvas.height / 1.15);
          if (barHeight < 2) barHeight = 2; // minimum height
          ctx.fillStyle = isAiSpeaking
            ? '#818cf8' // indigo-400
            : isCustomerSpeaking
            ? '#34d399' // emerald-400
            : '#475569'; // slate-600
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch {
      // Audio capture fallback
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [audioStream, isAiSpeaking, isCustomerSpeaking]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-4 text-white space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          Real-Time Audio Spectrum
        </span>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isAiSpeaking
              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
              : isCustomerSpeaking
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'text-slate-500'
          }`}
        >
          {isAiSpeaking ? 'AI Speaking' : isCustomerSpeaking ? 'Customer Speaking' : 'Listening'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={56}
        className="w-full h-14 bg-slate-950/80 rounded-xl border border-slate-800/80"
      />
    </div>
  );
};
