import React from 'react';
import { Link } from 'react-router-dom';
import {
  Globe2,
  Server,
  Layout,
  Package,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const architectures = [
    {
      title: 'apps/web',
      type: 'Frontend Application',
      description: 'React 18, Vite 6, TypeScript, Tailwind CSS and React Router with responsive UI.',
      icon: Layout,
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      title: 'apps/api',
      type: 'Backend Service',
      description: 'High-performance Fastify REST service with Zod schema validation and GET /health endpoint.',
      icon: Server,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      title: 'packages/shared',
      type: 'Shared Monorepo Package',
      description: 'Shared TypeScript contracts, API types, language definitions, and utility schemas.',
      icon: Package,
      color: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
    },
    {
      title: 'Supabase Online',
      type: 'Database & Auth Layer',
      description: 'Pre-configured cloud database with zero local PostgreSQL footprint.',
      icon: Database,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
  ];

  const languages = [
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  ];

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            Phase 1 Completed — Project Foundation Active
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
            Autonomous Multilingual
            <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Outbound Sales Calling SaaS
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-400 mb-8 leading-relaxed">
            Welcome to the robust foundation for VoicePilot AI. Engineered with an npm-workspaces monorepo, Fastify backend, Vite + React frontend, and cloud-hosted Supabase integration.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/status"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
            >
              Verify Backend Health
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <FileCode className="h-4 w-4 text-slate-400" />
              Explore Monorepo Modules
            </a>
          </div>
        </div>

        {/* Phase 1 Verification Checklist */}
        <div className="mt-16 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 backdrop-blur">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            Phase 1 Foundation Deliverables
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'npm-workspaces Monorepo Architecture',
              'React 18 + Vite + TypeScript + Tailwind CSS',
              'Node.js + Fastify + TypeScript API',
              'Zod Environment Variable Validation',
              'GET /health Endpoint with System Metrics',
              'Shared Type Contracts (@voicepilot/shared)',
              'Root Concurrent Dev & Build Pipeline',
              'Secure .env.example with Placeholders Only',
              'Online Supabase Database Readiness',
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Grid */}
        <div id="architecture" className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">Monorepo Package Structure</h2>
            <p className="text-xs text-slate-400 mt-1">Modular, strictly-typed, and ready for Phase 2 scaling</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {architectures.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl border bg-gradient-to-br ${item.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-base font-semibold text-white">{item.title}</h3>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                          {item.type}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multilingual Support Roadmap Teaser */}
        <div className="mt-16 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/50 to-slate-950 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Globe2 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">VoicePilot Multilingual Engine (Planned Dialects)</h2>
          </div>
          <p className="text-xs text-slate-400 mb-6 max-w-xl">
            Targeted for real-time speech-to-speech AI calls in subsequent phases. Language types are defined in @voicepilot/shared.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {languages.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center gap-2.5 rounded-lg border border-slate-800/60 bg-slate-950/80 px-3 py-2 text-xs"
              >
                <span className="text-lg">{lang.flag}</span>
                <div>
                  <div className="font-semibold text-slate-200">{lang.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">{lang.code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
