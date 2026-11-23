import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Building2, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

export const CompanySetupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createCompany, profile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await createCompany(name.trim());
      if (res?.id) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('Failed to create company organization. Please try again.');
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Company creation failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-xl shadow-indigo-500/25">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Set up your Company Organization
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Welcome{profile?.fullName ? `, ${profile.fullName}` : ''}! Create your company tenant to isolate sales data, team members, and calling campaigns.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 backdrop-blur">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Company / Organization Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Global Telephony Corp"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-10 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                You will be automatically provisioned as the <span className="text-indigo-400 font-semibold">OWNER</span> of this organization with full administrative and billing privileges.
              </p>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                Multi-Tenant Data Isolation Guaranteed
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                VoicePilot AI strictly separates campaign data, speech audio recordings, lead pipelines, and AI agent prompts at both the application level and database layer.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all hover:scale-[1.01]"
            >
              {submitting ? 'Creating Company...' : 'Create Company & Proceed'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
