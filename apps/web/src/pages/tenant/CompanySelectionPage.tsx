import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, ArrowRight, CheckCircle2, Shield, Users } from 'lucide-react';

export const CompanySelectionPage: React.FC = () => {
  const { memberships, activeTenantId, switchCompany } = useAuth();
  const navigate = useNavigate();

  const handleSelect = async (tenantId: string) => {
    await switchCompany(tenantId);
    navigate('/dashboard');
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Building2 className="h-7 w-7 text-indigo-400" />
              Company Organizations
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select an organization to switch your active workspace
            </p>
          </div>

          <Link
            to="/company-setup"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create New Company
          </Link>
        </div>

        <div className="space-y-4">
          {memberships.map((m) => {
            const isActive = m.tenantId === activeTenantId;
            return (
              <div
                key={m.id}
                onClick={() => handleSelect(m.tenantId)}
                className={`cursor-pointer rounded-2xl border p-5 sm:p-6 transition-all hover:scale-[1.01] ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-lg">
                      {m.tenant.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-semibold text-white">{m.tenant.name}</h3>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Active Workspace
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="font-mono text-[11px] text-slate-500">ID: {m.tenant.id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-indigo-400 font-medium">
                          <Shield className="h-3 w-3" />
                          Role: {m.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {memberships.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-white">No Companies Found</h3>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                You are not currently enrolled in any company organizations.
              </p>
              <Link
                to="/company-setup"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Create your first company
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
