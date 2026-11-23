import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  Pause,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Send,
  AlertCircle,
} from 'lucide-react';
import type { Campaign, CampaignStatus } from '@voicepilot/shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const CampaignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTenantId, activeTenant, getAuthToken } = useAuth();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const token = getAuthToken() || '';
  const userRole = activeTenant?.currentUserRole;
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

  const loadCampaign = useCallback(async () => {
    if (!activeTenantId || !id) return;
    const authToken = getAuthToken();
    if (!authToken) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.getCampaignById(activeTenantId, authToken, id);
      setCampaign(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, id, getAuthToken]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  const handleApprove = async () => {
    if (!activeTenantId || !campaign) return;
    setActionLoading(true);
    try {
      const updated = await api.approveCampaign(activeTenantId, token, campaign.id);
      setCampaign(updated);
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    if (!activeTenantId || !campaign) return;
    setActionLoading(true);
    try {
      const updated = await api.updateCampaignStatus(activeTenantId, token, campaign.id, newStatus);
      setCampaign(updated);
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeTenantId || !campaign || !window.confirm('Delete this campaign permanently?')) return;
    try {
      await api.deleteCampaign(activeTenantId, token, campaign.id);
      navigate('/campaigns');
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Campaign Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'The requested campaign could not be loaded.'}</p>
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: CampaignStatus) => {
    const badges: Record<CampaignStatus, { label: string; class: string }> = {
      DRAFT: { label: 'Draft', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
      PENDING_APPROVAL: { label: 'Pending Approval', class: 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold' },
      APPROVED: { label: 'Approved & Active', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold' },
      PAUSED: { label: 'Paused', class: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      COMPLETED: { label: 'Completed', class: 'bg-teal-500/10 text-teal-300 border-teal-500/20' },
      CANCELLED: { label: 'Cancelled', class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    };
    const b = badges[status] || { label: status, class: 'bg-slate-800 text-slate-300' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${b.class}`}>
        {b.label}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/campaigns"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>

        {isOwnerOrAdmin && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Campaign
          </button>
        )}
      </div>

      {/* Main Campaign Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              {campaign.description || 'No description provided.'}
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            {campaign.status === 'APPROVED' && (
              <button
                onClick={() => handleStatusChange('PAUSED')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-400 hover:bg-orange-500/20"
              >
                <Pause className="h-3.5 w-3.5" /> Pause Campaign
              </button>
            )}

            {campaign.status === 'PAUSED' && (
              <button
                onClick={() => handleStatusChange('APPROVED')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
              >
                <Play className="h-3.5 w-3.5" /> Resume Campaign
              </button>
            )}
          </div>
        </div>

        {/* Campaign Approval Workflow Card */}
        {campaign.status === 'DRAFT' && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-white">Campaign in Draft Mode</div>
              <p className="text-[11px] text-slate-400">
                Ready to launch? Submit for review or approve directly if you have Owner/Admin privileges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('PENDING_APPROVAL')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Send className="h-3.5 w-3.5 text-indigo-400" /> Submit for Approval
              </button>

              {isOwnerOrAdmin && (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Activate
                </button>
              )}
            </div>
          </div>
        )}

        {campaign.status === 'PENDING_APPROVAL' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-amber-300">Campaign Pending Approval</div>
              <p className="text-[11px] text-slate-400">
                {isOwnerOrAdmin
                  ? 'Review lead pool & voice configuration below and grant approval to activate.'
                  : 'Submitted for review. A Company Owner or Administrator must approve before dialing begins.'}
              </p>
            </div>

            {isOwnerOrAdmin ? (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 shrink-0"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve Campaign
              </button>
            ) : (
              <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-[11px] font-semibold text-amber-300">
                Awaiting Owner/Admin Approval
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stat Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="text-xs text-slate-400">Total Leads</div>
          <div className="text-2xl font-bold text-white">{campaign.totalLeadsCount}</div>
          <div className="text-[10px] text-slate-500">Assigned contacts</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-1">
          <div className="text-xs text-emerald-400">Callable Leads</div>
          <div className="text-2xl font-bold text-emerald-400">{campaign.callableLeadsCount}</div>
          <div className="text-[10px] text-emerald-300/80">Consent verified & ready</div>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-4 space-y-1">
          <div className="text-xs text-rose-400">Excluded Contacts</div>
          <div className="text-2xl font-bold text-rose-400">{campaign.dncBlockedCount}</div>
          <div className="text-[10px] text-rose-300/80">DNC / Unverified opt-in</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="text-xs text-slate-400">Language & Voice</div>
          <div className="text-sm font-bold text-white truncate">{campaign.preferredLanguage}</div>
          <div className="text-[10px] text-slate-400 truncate">{campaign.voicePreference}</div>
        </div>
      </div>

      {/* Assigned Leads Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Campaign Leads & Eligibility</h2>
            <p className="text-[11px] text-slate-400">
              Only verified contacts are eligible for automated dialer workflows.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {campaign.campaignLeads?.length || 0} leads attached
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400">
              <tr>
                <th className="p-3">Contact</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3">Calling Eligibility</th>
                <th className="p-3">Exclusion Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {!campaign.campaignLeads || campaign.campaignLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No leads attached to this campaign.
                  </td>
                </tr>
              ) : (
                campaign.campaignLeads.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-medium text-slate-200">
                      {item.lead?.fullName || 'Lead #' + item.leadId.substring(0, 8)}
                      {item.lead?.companyName && (
                        <span className="block text-[10px] text-slate-500">{item.lead.companyName}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-300">{item.lead?.phoneNumber || '—'}</td>
                    <td className="p-3">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.isCallable ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/20">
                          <ShieldCheck className="h-3 w-3" /> Ready (Callable)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-400 px-2 py-0.5 text-[10px] font-semibold border border-rose-500/20">
                          <ShieldAlert className="h-3 w-3" /> Excluded
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-slate-400">
                      {item.unfitReason || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
