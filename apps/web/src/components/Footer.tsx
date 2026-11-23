import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} VoicePilot AI. Phase 1 — Project Foundation Active.</p>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Monorepo Online
          </span>
          <span>•</span>
          <span>Fastify + Vite + React</span>
        </div>
      </div>
    </footer>
  );
};
