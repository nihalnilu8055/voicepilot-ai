import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Users,
  Shield,
  Layers,
  Copy,
  Check,
  Megaphone,
  Plus,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type { DashboardStatsResponse } from '@voicepilot/shared';
import { api } from '../../lib/api';

export const DashboardPage: React.FC = () => {
  const { profile, activeTenant, memberships, activeTenantId, getAuthToken, isMockMode } = useAuth();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const currentMembership = memberships.find((m) => m.tenantId === activeTenantId);
  const currentRole = currentMembership?.role || activeTenant?.currentUserRole || 'OWNER';

  const copyTenantId = () => {
    if (activeTenant?.id) {
      navigator.clipboard.writeText(activeTenant.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchStats = async () => {
    if (!activeTenantId) return;
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    try {
      const data = await api.getDashboardStats(activeTenantId, token);
      setStats(data);
    } catch (e) {
      console.warn('Dashboard stats load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeTenantId]);

  return (
    <div className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Header / Active Workspace Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 p-6 sm:p-8 backdrop-blur shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Phase 3: Lead & Campaign Management Active
              </span>
              {isMockMode && (
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
                  Local Dev Mode
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Building2 className="h-8 w-8 text-indigo-400" />
              {activeTenant?.name || 'Your Company Workspace'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Signed in as <strong className="text-slate-200">{profile?.email}</strong></span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                Tenant UUID: {activeTenant?.id}
                <button
                  onClick={copyTenantId}
                  title="Copy Tenant ID"
                  className="hover:text-indigo-400 p-0.5"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-indigo-300">
              <Shield className="h-4 w-4 text-indigo-400" />
              Role: {currentRole}
            </span>
            <Link
              to="/companies"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Layers className="h-4 w-4 text-indigo-400" />
              Switch Company
            </Link>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/leads"
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:border-indigo-500/40 hover:bg-slate-900/70 transition-all group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Lead Management</div>
                <div className="text-[11px] text-slate-400">View, add, and import contacts</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </Link>

          <Link
            to="/campaigns/new"
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:border-indigo-500/40 hover:bg-slate-900/70 transition-all group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:scale-105 transition-transform">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">New Campaign</div>
                <div className="text-[11px] text-slate-400">Create & schedule outbound calls</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
          </Link>

          <Link
            to="/campaigns"
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:border-indigo-500/40 hover:bg-slate-900/70 transition-all group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">All Campaigns</div>
                <div className="text-[11px] text-slate-400">Review status & approvals</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </Link>
        </div>

        {/* Lead Statistics Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Lead Pipeline Analytics</h2>
            <Link to="/leads" className="text-xs text-indigo-400 hover:text-indigo-300">
              Manage Leads →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-slate-400">Total Leads</div>
              <div className="text-3xl font-bold text-white">
                {loading ? '—' : stats?.leads.total ?? 0}
              </div>
              <div className="text-[11px] text-slate-500">Across company workspace</div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-blue-400">New Leads</div>
              <div className="text-3xl font-bold text-blue-400">
                {loading ? '—' : stats?.leads.new ?? 0}
              </div>
              <div className="text-[11px] text-blue-300/80">Awaiting contact</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-emerald-400">Qualified Leads</div>
              <div className="text-3xl font-bold text-emerald-400">
                {loading ? '—' : stats?.leads.qualified ?? 0}
              </div>
              <div className="text-[11px] text-emerald-300/80">Meets sales criteria</div>
            </div>

            <div className="rounded-2xl border border-teal-500/20 bg-teal-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-teal-300">Converted Leads</div>
              <div className="text-3xl font-bold text-teal-300">
                {loading ? '—' : stats?.leads.converted ?? 0}
              </div>
              <div className="text-[11px] text-teal-300/80">Closed / Won deals</div>
            </div>
          </div>
        </div>

        {/* Campaign Statistics Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Campaign Operations</h2>
            <Link to="/campaigns" className="text-xs text-indigo-400 hover:text-indigo-300">
              Manage Campaigns →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-slate-400">Total Campaigns</div>
              <div className="text-3xl font-bold text-white">
                {loading ? '—' : stats?.campaigns.total ?? 0}
              </div>
              <div className="text-[11px] text-slate-500">Configured campaigns</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-emerald-400">Active / Approved</div>
              <div className="text-3xl font-bold text-emerald-400">
                {loading ? '—' : stats?.campaigns.active ?? 0}
              </div>
              <div className="text-[11px] text-emerald-300/80">Ready to execute</div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-amber-300">Pending Approvals</div>
              <div className="text-3xl font-bold text-amber-300">
                {loading ? '—' : stats?.campaigns.pendingApproval ?? 0}
              </div>
              <div className="text-[11px] text-amber-300/80">Requires Owner/Admin review</div>
            </div>

            <div className="rounded-2xl border border-orange-500/20 bg-orange-950/10 p-5 space-y-2 shadow-lg">
              <div className="text-xs font-medium text-orange-400">Paused Campaigns</div>
              <div className="text-3xl font-bold text-orange-400">
                {loading ? '—' : stats?.campaigns.paused ?? 0}
              </div>
              <div className="text-[11px] text-orange-300/80">Temporarily paused</div>
            </div>
          </div>
        </div>

        {/* Regulatory & Compliance Health */}
        <div className="rounded-3xl border border-indigo-500/20 bg-indigo-950/10 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Regulatory Calling Restrictions & Compliance Engine
                </h3>
                <p className="text-[11px] text-slate-400">
                  TRAI UCC & Indian Telemarketing Guidelines Enforced
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
              ACTIVE ENFORCEMENT
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] text-slate-400">Consent Verification Rate</div>
              <div className="text-2xl font-bold text-white mt-1">
                {stats?.compliance.consentVerifiedPercentage ?? 100}%
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats?.compliance.consentVerifiedPercentage ?? 100}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] text-slate-400">Do Not Call (DNC) Blocked</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {stats?.compliance.dncBlockedTotal ?? 0} contacts
              </div>
              <div className="text-[10px] text-slate-500 mt-2">Excluded from outbound dialer</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] text-slate-400">Telephony Guardrail</div>
              <div className="text-xs font-bold text-emerald-400 mt-1">
                Zero Unauthorized Dialing
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Documented consent or lawful basis strictly required
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Audit Log Feed */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Recent Audit Activity</h2>
            </div>
            <button
              onClick={fetchStats}
              title="Refresh Stats"
              className="rounded p-1 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No recent activity recorded for this workspace.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto text-xs">
              {stats.recentActivity.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200">
                      {log.action.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      By {log.userEmail || 'System'} • Entity: {log.entityType}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
