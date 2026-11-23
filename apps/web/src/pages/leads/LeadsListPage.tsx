import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  AlertCircle,
  Phone,
  Building,
  Mail,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import type { Lead, LeadStatus } from '@voicepilot/shared';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { LeadFormModal } from './LeadFormModal';
import { LeadCsvImportModal } from './LeadCsvImportModal';

export const LeadsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeTenantId, activeTenant, getAuthToken } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [filterDnc, setFilterDnc] = useState<boolean | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Delete confirmation
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadLeads = useCallback(async () => {
    if (!activeTenantId) return;
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeads(activeTenantId, token, {
        search: search.trim() || undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as LeadStatus) : undefined,
        isDnc: filterDnc,
        page,
        limit,
      });
      setLeads(res.leads);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, getAuthToken, search, selectedStatus, filterDnc, page, limit]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleDelete = async () => {
    if (!leadToDelete || !activeTenantId) return;
    const token = getAuthToken();
    if (!token) return;

    setDeleting(true);
    try {
      await api.deleteLead(activeTenantId, token, leadToDelete.id);
      setLeadToDelete(null);
      loadLeads();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    const styles: Record<LeadStatus, string> = {
      NEW: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      CONTACTED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      QUALIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      CONVERTED: 'bg-teal-500/10 text-teal-300 border-teal-500/20 font-bold',
      CALLBACK: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      NOT_INTERESTED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      LOST: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const token = getAuthToken() || '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Lead Management</h1>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {total} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage prospects, compliance opt-in consent, and automated calling eligibility for{' '}
            <strong className="text-slate-200">{activeTenant?.name || 'your workspace'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setLeadToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
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
            placeholder="Search leads by name, phone, email, or company..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONVERTED">Converted</option>
            <option value="CALLBACK">Callback</option>
            <option value="NOT_INTERESTED">Not Interested</option>
            <option value="LOST">Lost</option>
          </select>

          <button
            onClick={() => {
              setFilterDnc((prev) => (prev === true ? undefined : true));
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              filterDnc === true
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            DNC Only
          </button>

          <button
            onClick={loadLeads}
            title="Refresh Leads"
            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
        {error && (
          <div className="flex items-center gap-2 border-b border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Contact Name</th>
                <th className="px-5 py-3.5">Phone & Email</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Calling Eligibility</th>
                <th className="px-5 py-3.5">Consent Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-500">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">No leads found</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Get started by adding a single lead or importing a batch via CSV.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-3">
                      <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Import CSV
                      </button>
                      <button
                        onClick={() => {
                          setLeadToEdit(null);
                          setIsFormModalOpen(true);
                        }}
                        className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        Add New Lead
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      <button
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="text-left hover:text-indigo-400 transition-colors"
                      >
                        {lead.fullName}
                      </button>
                      <div className="text-[10px] text-slate-500">
                        {lead.country} • {lead.languagePreference}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-mono text-slate-300 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                        {lead.phoneNumber}
                      </div>
                      {lead.email && (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                          {lead.email}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-slate-300">
                      {lead.companyName ? (
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3 w-3 text-slate-500" />
                          <span>{lead.companyName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">{getStatusBadge(lead.status)}</td>

                    {/* Calling Eligibility Badge */}
                    <td className="px-5 py-3.5">
                      {lead.isDnc ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                          <ShieldAlert className="h-3 w-3" />
                          DNC Blocked
                        </span>
                      ) : lead.isCallable ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                          Callable (Verified)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          Consent Pending
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-[11px] text-slate-400">
                      <div className="font-medium text-slate-300">
                        {lead.consentStatus === 'CONSENT_GRANTED'
                          ? 'Opt-in Granted'
                          : lead.consentStatus === 'LAWFUL_BASIS'
                          ? 'Lawful Basis'
                          : lead.consentStatus === 'CONSENT_REVOKED'
                          ? 'Opt-out / Revoked'
                          : 'Pending'}
                      </div>
                      {lead.consentSource && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                          {lead.consentSource}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          title="View Lead Details"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setLeadToEdit(lead);
                            setIsFormModalOpen(true);
                          }}
                          title="Edit Lead"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setLeadToDelete(lead)}
                          title="Delete Lead"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
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

      {/* Add / Edit Modal */}
      {isFormModalOpen && activeTenantId && (
        <LeadFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setLeadToEdit(null);
          }}
          onSuccess={loadLeads}
          tenantId={activeTenantId}
          token={token}
          leadToEdit={leadToEdit}
        />
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && activeTenantId && (
        <LeadCsvImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={loadLeads}
          tenantId={activeTenantId}
          token={token}
        />
      )}

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete Lead</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{leadToDelete.fullName}</strong> ({leadToDelete.phoneNumber})?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setLeadToDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
