import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Eye,
  Trash2,
  Calendar,
  Clock,
  Globe,
  Mic,
  Users,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { Campaign, CampaignStatus } from '@voicepilot/shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export const CampaignsListPage: React.FC = () => {
  const { activeTenantId, activeTenant, getAuthToken } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = getAuthToken() || '';

  const loadCampaigns = useCallback(async () => {
    if (!activeTenantId) return;
    const authToken = getAuthToken();
    if (!authToken) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.getCampaigns(activeTenantId, authToken, {
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as CampaignStatus) : undefined,
        page,
        limit,
      });
      setCampaigns(res.campaigns);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, getAuthToken, search, statusFilter, page, limit]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleStatusToggle = async (campaign: Campaign, newStatus: CampaignStatus) => {
    if (!activeTenantId) return;
    try {
      await api.updateCampaignStatus(activeTenantId, token, campaign.id, newStatus);
      loadCampaigns();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!activeTenantId || !window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await api.deleteCampaign(activeTenantId, token, campaignId);
      loadCampaigns();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

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
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${b.class}`}>
        {b.label}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Campaign Management</h1>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {total} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure sales objectives, AI voices, lead batches, and approval workflows for{' '}
            <strong className="text-slate-200">{activeTenant?.name || 'your workspace'}</strong>.
          </p>
        </div>

        <Link
          to="/campaigns/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Campaign
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search campaigns by name..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            onClick={loadCampaigns}
            title="Refresh Campaigns"
            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Campaign List */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {loading && campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No campaigns created yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Launch outbound campaigns, assign leads, customize consultative AI voices, and route through approval workflows.
            </p>
          </div>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Create First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      <Link to={`/campaigns/${c.id}`} className="hover:text-indigo-400 transition-colors">
                        {c.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {c.description || 'No description provided.'}
                    </p>
                  </div>
                  <div>{getStatusBadge(c.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Globe className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{c.preferredLanguage}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Mic className="h-3.5 w-3.5 text-violet-400" />
                    <span className="truncate">{c.voicePreference}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Calendar className="h-3 w-3 text-slate-500" />
                    <span>{c.startDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span>{c.startTime}</span>
                  </div>
                </div>

                {/* Lead Stats */}
                <div className="flex items-center justify-between text-xs rounded-xl bg-slate-950 p-3">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>Leads:</span>
                    <strong className="text-white">{c.totalLeadsCount}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-400 font-semibold" title="Callable verified leads">
                      {c.callableLeadsCount} Callable
                    </span>
                    {c.dncBlockedCount > 0 && (
                      <span className="text-rose-400" title="Excluded due to DNC or unverified consent">
                        • {c.dncBlockedCount} Excluded
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  {c.status === 'APPROVED' && (
                    <button
                      onClick={() => handleStatusToggle(c, 'PAUSED')}
                      className="flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/20"
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </button>
                  )}
                  {c.status === 'PAUSED' && (
                    <button
                      onClick={() => handleStatusToggle(c, 'APPROVED')}
                      className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <Play className="h-3 w-3" /> Resume
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to={`/campaigns/${c.id}`}
                    title="View Campaign Details"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteCampaign(c.id)}
                    title="Delete Campaign"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
          <div>
            Showing page <strong className="text-slate-200">{page}</strong> of{' '}
            <strong className="text-slate-200">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
