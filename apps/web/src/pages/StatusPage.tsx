import React, { useState, useEffect } from 'react';
import type { HealthResponse } from '@voicepilot/shared';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Server,
  Zap,
  Code2
} from 'lucide-react';

export const StatusPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    // Try relative endpoint via Vite proxy first, then fallback to direct backend URL
    const urls = ['/api/health', 'http://localhost:3000/health'];
    let lastErr = '';

    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data: HealthResponse = await res.json();
          const duration = Math.round(performance.now() - start);
          setHealth(data);
          setResponseTimeMs(duration);
          setLastChecked(new Date().toLocaleTimeString());
          setLoading(false);
          return;
        } else {
          lastErr = `HTTP ${res.status}: ${res.statusText}`;
        }
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err.message : 'Connection failed';
      }
    }

    setError(lastErr || 'Could not connect to Fastify backend.');
    setLoading(false);
    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <Activity className="h-7 w-7 text-emerald-400" />
              API Service Health Inspector
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Live probe of the Fastify backend <code className="text-indigo-400">GET /health</code> endpoint
            </p>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Probing...' : 'Re-check Endpoint'}
          </button>
        </div>

        {/* Live Status Banner */}
        <div className={`mb-8 rounded-2xl border p-6 transition-all ${
          error
            ? 'border-rose-900/50 bg-rose-950/20'
            : health
            ? 'border-emerald-900/50 bg-emerald-950/20'
            : 'border-slate-800 bg-slate-900/30'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${
              error
                ? 'border-rose-800 bg-rose-900/40 text-rose-400'
                : health
                ? 'border-emerald-800 bg-emerald-900/40 text-emerald-400'
                : 'border-slate-800 bg-slate-800 text-slate-400'
            }`}>
              {error ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <CheckCircle className="h-6 w-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {error ? 'Backend Offline or Unreachable' : health ? 'Backend Service Online' : 'Connecting...'}
                </span>
                {responseTimeMs !== null && !error && (
                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-800">
                    {responseTimeMs} ms
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {error
                  ? `Error: ${error}. Ensure Fastify API is running via 'npm run dev' or 'npm run dev:api'.`
                  : `Last polled at ${lastChecked}. Connected to Fastify on port 3000.`}
              </p>
            </div>
          </div>
        </div>

        {/* Health Metrics Grid */}
        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Server className="h-3.5 w-3.5 text-indigo-400" />
                Service
              </div>
              <div className="text-sm font-semibold text-white">{health.service}</div>
              <div className="text-[10px] text-slate-500 font-mono">v{health.version}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Uptime
              </div>
              <div className="text-sm font-semibold text-white">{health.uptime}s</div>
              <div className="text-[10px] text-slate-500">Continuous operation</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Environment
              </div>
              <div className="text-sm font-semibold text-white uppercase text-amber-400 font-mono text-xs">
                {health.environment}
              </div>
              <div className="text-[10px] text-slate-500">Node.js Runtime</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Health Status
              </div>
              <div className="text-sm font-semibold text-emerald-400 uppercase font-mono text-xs">
                {health.status}
              </div>
              <div className="text-[10px] text-slate-500">HTTP 200 OK</div>
            </div>
          </div>
        )}

        {/* JSON Inspector */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Raw JSON Payload</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500">application/json</span>
          </div>

          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300 border border-slate-800/80">
            {health
              ? JSON.stringify(health, null, 2)
              : error
              ? JSON.stringify({ error, status: 'unreachable', timestamp: new Date().toISOString() }, null, 2)
              : '// Loading health payload...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
