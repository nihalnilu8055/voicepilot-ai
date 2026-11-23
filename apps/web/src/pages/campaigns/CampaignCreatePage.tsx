import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  Mic,
  Calendar,
  Users,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import type { Lead, SalesObjective, SalesPersonality, CreateCampaignDto } from '@voicepilot/shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

const SALES_OBJECTIVES: Array<{ value: SalesObjective; label: string; desc: string }> = [
  {
    value: 'LEAD_GENERATION',
    label: 'Lead Generation & Qualification',
    desc: 'Identify decision-makers, gauge interest, and schedule discovery meetings.',
  },
  {
    value: 'DIRECT_SALES',
    label: 'Direct Sales & Checkout',
    desc: 'Pitch specific offerings, address objections, and drive immediate purchase intent.',
  },
  {
    value: 'BOTH',
    label: 'Hybrid / Nurture & Convert',
    desc: 'Qualify inbound interest and offer direct promotion or scheduling depending on fit.',
  },
];

const VOICE_PREFERENCES = [
  { id: 'Priya (Warm)', label: 'Priya — Warm & Consultative', gender: 'Female', pitch: 'Warm, natural cadence, consultative tone' },
  { id: 'Aarav (Authoritative)', label: 'Aarav — Authoritative & Executive', gender: 'Male', pitch: 'Deep, crisp, confident B2B executive delivery' },
  { id: 'Neha (Friendly)', label: 'Neha — Friendly & Energetic', gender: 'Female', pitch: 'Lively, friendly customer engagement style' },
  { id: 'Rohan (Professional)', label: 'Rohan — Professional & Calm', gender: 'Male', pitch: 'Measured, corporate, technical advisor persona' },
];

const INDIAN_LANGUAGES = [
  { code: 'en-IN', label: 'Indian English (en-IN)' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'en-US', label: 'English (US / Global accent)' },
];

export const CampaignCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeTenantId, getAuthToken } = useAuth();

  // Step state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [salesObjective, setSalesObjective] = useState<SalesObjective>('LEAD_GENERATION');
  const [salesPersonality] = useState<SalesPersonality>('CONSULTATIVE');
  const [preferredLanguage, setPreferredLanguage] = useState('en-US');
  const [voicePreference, setVoicePreference] = useState('Priya (Warm)');

  // Scheduling
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Lead selection
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [loadingLeads, setLoadingLeads] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = getAuthToken() || '';

  useEffect(() => {
    async function fetchLeads() {
      if (!activeTenantId || !token) return;
      try {
        setLoadingLeads(true);
        const res = await api.getLeads(activeTenantId, token, { limit: 100 });
        setAvailableLeads(res.leads);

        // Auto-select callable leads by default
        const callableIds = new Set(res.leads.filter((l) => l.isCallable).map((l) => l.id));
        setSelectedLeadIds(callableIds);
      } catch (err: any) {
        console.error('Error fetching leads for campaign:', err);
      } finally {
        setLoadingLeads(false);
      }
    }
    fetchLeads();
  }, [activeTenantId, token]);

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCallable = () => {
    const callableIds = new Set(availableLeads.filter((l) => l.isCallable).map((l) => l.id));
    setSelectedLeadIds(callableIds);
  };

  const clearLeadSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }

    if (!activeTenantId || !token) {
      setError('Active workspace session required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: CreateCampaignDto = {
        name: name.trim(),
        description: description.trim() || null,
        salesObjective,
        salesPersonality,
        preferredLanguage,
        voicePreference,
        startDate,
        startTime,
        timezone,
        leadIds: Array.from(selectedLeadIds),
      };

      const campaign = await api.createCampaign(activeTenantId, token, payload);
      navigate(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Create New Campaign</h1>
        <p className="text-xs text-slate-400">
          Configure AI outbound parameters, multi-lingual voice synthesis, and select eligible leads.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Campaign Fundamentals */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Megaphone className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">1. Campaign Fundamentals</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Campaign Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 B2B Enterprise SaaS Outbound"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description & Goal</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly state target customer profile, value proposition, and intended conversion goal..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Sales Objective Radio Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Sales Objective</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SALES_OBJECTIVES.map((obj) => (
                  <div
                    key={obj.value}
                    onClick={() => setSalesObjective(obj.value)}
                    className={`rounded-xl border p-3.5 cursor-pointer transition-all ${
                      salesObjective === obj.value
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{obj.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{obj.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Personality - Fixed to CONSULTATIVE */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">Sales Personality Persona</div>
                <div className="text-[11px] text-slate-400">
                  Fixed to <strong>CONSULTATIVE</strong> — respectful, value-focused inquiry rather than high-pressure cold calling.
                </div>
              </div>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                Consultative
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Voice & Localization */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Mic className="h-5 w-5 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">2. Language & AI Voice Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Campaign Primary Language
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {INDIAN_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">AI Voice Persona</label>
              <select
                value={voicePreference}
                onChange={(e) => setVoicePreference(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {VOICE_PREFERENCES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.gender})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Scheduling */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Calendar className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">3. Campaign Schedule & Calling Window</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Time Zone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Lead Selection & Compliance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-indigo-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">4. Select Leads for Campaign</h2>
                <p className="text-[11px] text-slate-400">
                  {selectedLeadIds.size} leads selected of {availableLeads.length} available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllCallable}
                className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20"
              >
                Select Verified Callable
              </button>
              <button
                type="button"
                onClick={clearLeadSelection}
                className="rounded border border-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 space-y-1">
              <div className="font-semibold text-amber-300">
                TRAI & Telemarketing Regulatory Restriction
              </div>
              <p className="text-[11px] text-amber-200/80">
                Contacts on the National Do Not Call (DNC) registry or without verified consent will be
                automatically marked as <strong>EXCLUDED</strong> from calling.
              </p>
            </div>
          </div>

          {/* Leads Checklist Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden max-h-72 overflow-y-auto">
            {loadingLeads ? (
              <div className="text-center py-8 text-xs text-slate-400">Loading leads...</div>
            ) : availableLeads.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No leads found in this workspace. Add or import leads first!
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400">
                  <tr>
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Calling Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {availableLeads.map((lead) => {
                    const isSelected = selectedLeadIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => toggleLead(lead.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/20 hover:bg-indigo-950/30' : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-200">
                          {lead.fullName}
                          {lead.companyName && (
                            <span className="block text-[10px] text-slate-500">{lead.companyName}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">{lead.phoneNumber}</td>
                        <td className="p-3">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {lead.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {lead.isDnc ? (
                            <span className="text-[10px] font-semibold text-rose-400">
                              DNC (Excluded)
                            </span>
                          ) : lead.isCallable ? (
                            <span className="text-[10px] font-semibold text-emerald-400">
                              Callable
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-400">
                              Consent Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link
            to="/campaigns"
            className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating Campaign...' : 'Create Campaign (Draft)'}
          </button>
        </div>
      </form>
    </div>
  );
};
