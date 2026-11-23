import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PhoneCall, Activity, Layers, LogOut, Building2, Users, Megaphone, LayoutDashboard, Mic } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const location = useLocation();
  const { user, profile, activeTenant, signOut, memberships } = useAuth();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <PhoneCall className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">VoicePilot</span>
              <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">AI</span>
            </div>
            <p className="text-[11px] text-slate-400">Multilingual Outbound Sales Calling SaaS</p>
          </div>
        </Link>

        {/* Navigation & Auth Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Overview
            </Link>

            {user && (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    location.pathname === '/dashboard'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
                <Link
                  to="/leads"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/leads')
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Leads
                </Link>
                <Link
                  to="/campaigns"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/campaigns')
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Campaigns
                </Link>
                <Link
                  to="/voice-studio"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/voice-studio')
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  Voice Studio
                </Link>
              </>
            )}

            <Link
              to="/status"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                location.pathname === '/status'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              API Health
            </Link>
          </nav>

          <div className="h-4 w-px bg-slate-800" />

          {/* User state / Auth CTA */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {activeTenant && (
                <Link
                  to="/companies"
                  title="Switch Company Workspace"
                  className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-slate-700"
                >
                  <Building2 className="h-3 w-3 text-indigo-400" />
                  <span className="max-w-[120px] truncate">{activeTenant.name}</span>
                  <span className="rounded bg-indigo-950 px-1 text-[9px] text-indigo-300 font-mono">
                    {memberships.length}
                  </span>
                </Link>
              )}

              <div className="flex items-center gap-2">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
                    {profile?.fullName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                    {user.email}
                  </div>
                </div>

                <button
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-rose-950/40 hover:border-rose-900 hover:text-rose-300 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
