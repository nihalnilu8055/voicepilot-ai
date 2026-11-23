import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center px-4">
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6">
        <AlertCircle className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-sm">
        The route you requested does not exist in the VoicePilot AI application.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
      >
        <Home className="h-4 w-4" />
        Return to Home
      </Link>
    </div>
  );
};
