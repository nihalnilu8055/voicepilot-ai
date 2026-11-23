import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PhoneCall, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, isMockMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('sales.lead@voicepilot.ai');
    setPassword('DemoPass123!');
  };

  return (
    <div className="flex flex-1 items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/25">
            <PhoneCall className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Sign in to VoicePilot AI
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Multilingual Outbound Sales Calling Platform
          </p>
        </div>

        {isMockMode && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-indigo-300">
              <span className="font-semibold">Local Dev Demo Mode:</span> Connect your Supabase keys in <code className="bg-indigo-950 px-1 py-0.5 rounded text-[11px]">.env</code> for online Supabase Auth, or test now using any email.
              <button
                type="button"
                onClick={handleDemoFill}
                className="mt-1 block text-indigo-400 hover:text-indigo-200 underline font-medium"
              >
                Auto-fill demo test credentials
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
