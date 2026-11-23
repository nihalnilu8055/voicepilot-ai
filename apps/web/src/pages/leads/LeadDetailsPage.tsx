import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  Building,
  Globe,
  ShieldAlert,
  ShieldCheck,
  Edit,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { Lead, LeadStatus } from '@voicepilot/shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { LeadFormModal } from './LeadFormModal';

export const LeadDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeTenantId, getAuthToken } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const token = getAuthToken() || '';

  const loadLead = useCallback(async () => {
    if (!activeTenantId || !id) return;
    const authToken = getAuthToken();
    if (!authToken) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.getLeadById(activeTenantId, authToken, id);
      setLead(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, id, getAuthToken]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  const handleQuickStatusChange = async (newStatus: LeadStatus) => {
    if (!lead || !activeTenantId) return;
    try {
      const updated = await api.updateLead(activeTenantId, token, lead.id, {
        status: newStatus,
      });
      setLead(updated);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleToggleDnc = async () => {
    if (!lead || !activeTenantId) return;
    const newDnc = !lead.isDnc;
    try {
      const updated = await api.updateLead(activeTenantId, token, lead.id, {
        isDnc: newDnc,
        dncReason: newDnc ? 'Marked via Lead Details page' : null,
      });
      setLead(updated);
    } catch (err: any) {
      alert(`DNC toggle failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Lead Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'The requested contact could not be loaded.'}</p>
        <Link
          to="/leads"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/leads"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-700"
          >
            <Edit className="h-3.5 w-3.5" /> Edit Lead
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{lead.fullName}</h1>
              {lead.isDnc ? (
                <span className="flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> DNC Blocked
                </span>
              ) : lead.isCallable ? (
                <span className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Callable (Verified)
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Missing Consent
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1 text-indigo-300 font-mono">
                <Phone className="h-3.5 w-3.5 text-slate-500" /> {lead.phoneNumber}
              </span>
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" /> {lead.email}
                </span>
              )}
              {lead.companyName && (
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-500" /> {lead.companyName}
                </span>
              )}
            </div>
          </div>

          {/* Quick Status Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={lead.status}
              onChange={(e) => handleQuickStatusChange(e.target.value as LeadStatus)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="CONVERTED">CONVERTED</option>
              <option value="CALLBACK">CALLBACK</option>
              <option value="NOT_INTERESTED">NOT_INTERESTED</option>
              <option value="LOST">LOST</option>
            </select>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Compliance & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Regulatory & Telecom Compliance Card */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 border-b border-indigo-500/20 pb-3">
            <ShieldAlert className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">
              Telecom Regulatory & Calling Compliance
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Lawful Calling Basis</span>
              <span className="font-semibold text-slate-200">
                {lead.consentStatus === 'CONSENT_GRANTED'
                  ? 'Express Opt-in Granted'
                  : lead.consentStatus === 'LAWFUL_BASIS'
                  ? 'Verified Lawful Basis'
                  : lead.consentStatus === 'CONSENT_REVOKED'
                  ? 'Opt-out Revoked'
                  : 'Pending Verification'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Opt-in Source / Evidence</span>
              <span className="text-slate-300">{lead.consentSource || 'None specified'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Consent Timestamp</span>
              <span className="font-mono text-slate-300">
                {lead.consentDate ? new Date(lead.consentDate).toLocaleDateString() : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">National DND / DNC Registry</span>
              <span className={lead.isDnc ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                {lead.isDnc ? 'FLAGGED (Do Not Call)' : 'Clear (Not Listed)'}
              </span>
            </div>

            {lead.isDnc && lead.dncReason && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <strong>DNC Reason:</strong> {lead.dncReason}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleToggleDnc}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  lead.isDnc
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                }`}
              >
                {lead.isDnc ? 'Remove from Do Not Call List' : 'Mark as Do Not Call (DNC)'}
              </button>
            </div>
          </div>
        </div>

        {/* Contact Metadata Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Contact & Localization Profile</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Country / Jurisdiction</span>
              <span className="font-semibold text-slate-200">{lead.country}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Language Preference</span>
              <span className="font-semibold text-slate-200">{lead.languagePreference}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Acquisition Source</span>
              <span className="text-slate-300">{lead.leadSource}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Created At</span>
              <span className="font-mono text-slate-400">
                {new Date(lead.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Notes */}
            <div className="pt-2">
              <span className="block text-slate-400 mb-1">Notes & Context:</span>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300 text-xs min-h-[60px]">
                {lead.notes || <span className="text-slate-500 italic">No notes added.</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && activeTenantId && (
        <LeadFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadLead}
          tenantId={activeTenantId}
          token={token}
          leadToEdit={lead}
        />
      )}
    </div>
  );
};
