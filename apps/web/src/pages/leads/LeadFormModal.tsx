import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Lead, CreateLeadDto, UpdateLeadDto, LeadStatus, ConsentStatus, LeadSource } from '@voicepilot/shared';
import { api } from '../../lib/api';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  token: string;
  leadToEdit?: Lead | null;
}

const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'NOT_INTERESTED',
  'CALLBACK',
  'CONVERTED',
  'LOST',
];

const CONSENT_STATUSES: Array<{ value: ConsentStatus; label: string; desc: string }> = [
  { value: 'CONSENT_GRANTED', label: 'Consent Granted (Opt-in Verified)', desc: 'Explicit express written/digital consent obtained' },
  { value: 'LAWFUL_BASIS', label: 'Verified Lawful Basis', desc: 'Legitimate business inquiry, existing transactional relationship' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification', desc: 'Consent unverified (Cannot be called automatically)' },
  { value: 'CONSENT_REVOKED', label: 'Consent Revoked / Opt-out', desc: 'Contact requested removal or withdrew permission' },
];

const LEAD_SOURCES: LeadSource[] = [
  'WEBSITE',
  'INBOUND',
  'COLD_OUTREACH',
  'REFERRAL',
  'EVENT',
  'PAID_ADS',
  'OTHER',
];

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  token,
  leadToEdit,
}) => {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('IN');
  const [languagePreference, setLanguagePreference] = useState('en-US');
  const [leadSource, setLeadSource] = useState<LeadSource>('WEBSITE');
  const [status, setStatus] = useState<LeadStatus>('NEW');
  const [notes, setNotes] = useState('');

  // Regulatory & Telecom Compliance
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('PENDING_VERIFICATION');
  const [consentSource, setConsentSource] = useState('');
  const [isDnc, setIsDnc] = useState(false);
  const [dncReason, setDncReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leadToEdit) {
      setFullName(leadToEdit.fullName);
      setPhoneNumber(leadToEdit.phoneNumber);
      setEmail(leadToEdit.email || '');
      setCompanyName(leadToEdit.companyName || '');
      setCountry(leadToEdit.country || 'IN');
      setLanguagePreference(leadToEdit.languagePreference || 'en-US');
      setLeadSource(leadToEdit.leadSource);
      setStatus(leadToEdit.status);
      setNotes(leadToEdit.notes || '');
      setConsentStatus(leadToEdit.consentStatus);
      setConsentSource(leadToEdit.consentSource || '');
      setIsDnc(leadToEdit.isDnc);
      setDncReason(leadToEdit.dncReason || '');
    } else {
      setFullName('');
      setPhoneNumber('');
      setEmail('');
      setCompanyName('');
      setCountry('IN');
      setLanguagePreference('en-US');
      setLeadSource('WEBSITE');
      setStatus('NEW');
      setNotes('');
      setConsentStatus('PENDING_VERIFICATION');
      setConsentSource('');
      setIsDnc(false);
      setDncReason('');
    }
    setError(null);
  }, [leadToEdit, isOpen]);

  if (!isOpen) return null;

  // Real-time evaluation of calling eligibility
  const willBeCallable = !isDnc && (consentStatus === 'CONSENT_GRANTED' || consentStatus === 'LAWFUL_BASIS');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Phone number is required.');
      return;
    }

    setLoading(true);
    try {
      if (leadToEdit) {
        const updateData: UpdateLeadDto = {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || null,
          companyName: companyName.trim() || null,
          country,
          languagePreference,
          leadSource,
          status,
          notes: notes.trim() || null,
          consentStatus,
          consentSource: consentSource.trim() || null,
          isDnc,
          dncReason: isDnc ? dncReason.trim() || 'User specified' : null,
        };
        await api.updateLead(tenantId, token, leadToEdit.id, updateData);
      } else {
        const createData: CreateLeadDto = {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || null,
          companyName: companyName.trim() || null,
          country,
          languagePreference,
          leadSource,
          status,
          notes: notes.trim() || null,
          consentStatus,
          consentSource: consentSource.trim() || null,
          isDnc,
          dncReason: isDnc ? dncReason.trim() || 'User specified' : null,
        };
        await api.createLead(tenantId, token, createData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {leadToEdit ? 'Edit Lead Details' : 'Add New Lead'}
            </h2>
            <p className="text-xs text-slate-400">
              Manage contact information and documented calling consent compliance.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+919876543210"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-slate-500">Include country code (e.g. +91 for India)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Company / Organization</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Sharma Tech"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Preferred Language</label>
              <select
                value={languagePreference}
                onChange={(e) => setLanguagePreference(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="en-IN">Indian English (en-IN)</option>
                <option value="hi-IN">Hindi (हिंदी)</option>
                <option value="ml-IN">Malayalam (മലയാളം)</option>
                <option value="ta-IN">Tamil (ta-IN)</option>
                <option value="te-IN">Telugu (te-IN)</option>
                <option value="bn-IN">Bengali (bn-IN)</option>
                <option value="mr-IN">Marathi (mr-IN)</option>
                <option value="gu-IN">Gujarati (gu-IN)</option>
                <option value="kn-IN">Kannada (kn-IN)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Lead Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {LEAD_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Lead Source</label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="IN">India (IN - TRAI Regulations Apply)</option>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="AE">United Arab Emirates (AE)</option>
                <option value="SG">Singapore (SG)</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Lead Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key context, budget, requirements, or meeting history..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Regulatory & Telecom Compliance Section */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-indigo-400" />
                <h3 className="text-xs font-semibold text-white">
                  Regulatory & Calling Consent Verification
                </h3>
              </div>
              {/* Callability preview badge */}
              {willBeCallable ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Eligible for Calling
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Excluded from Calling
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Under TRAI UCC guidelines and outbound telemarketing compliance, contacts without
              explicit consent or flagged on Do-Not-Call registries cannot be dialed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Consent Status</label>
                <select
                  value={consentStatus}
                  onChange={(e) => setConsentStatus(e.target.value as ConsentStatus)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  {CONSENT_STATUSES.map((cs) => (
                    <option key={cs.value} value={cs.value}>
                      {cs.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Consent Source / Documentation</label>
                <input
                  type="text"
                  value={consentSource}
                  onChange={(e) => setConsentSource(e.target.value)}
                  placeholder="e.g. Inbound Demo Request Form, Contract Ref #402"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* DNC Toggle */}
            <div className="flex items-start gap-3 pt-1 border-t border-indigo-500/10">
              <input
                id="dnc_toggle"
                type="checkbox"
                checked={isDnc}
                onChange={(e) => setIsDnc(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900"
              />
              <div className="flex-1">
                <label htmlFor="dnc_toggle" className="text-xs font-medium text-slate-200 cursor-pointer">
                  Do Not Call (DNC / National DND)
                </label>
                <p className="text-[11px] text-slate-400">
                  Mark if the contact is listed on the national Do-Not-Disturb registry or has requested not to be called.
                </p>

                {isDnc && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={dncReason}
                      onChange={(e) => setDncReason(e.target.value)}
                      placeholder="Reason for DNC (e.g. Customer requested opt-out on call)"
                      className="w-full rounded-lg border border-rose-500/30 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving Lead...' : leadToEdit ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
