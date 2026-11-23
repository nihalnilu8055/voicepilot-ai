import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { tenantRoutes } from './routes/tenants.js';
import { leadRoutes } from './routes/leads.js';
import { campaignRoutes } from './routes/campaigns.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { voiceModuleRoutes } from './modules/voice/voice.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'info',
    },
  });

  // Enable CORS for frontend application (supports localhost and Vercel preview/production domains)
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const allowedOrigins = [...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'];

  app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);
      if (
        env.CORS_ORIGIN === '*' ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return cb(null, true);
      }
      return cb(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });

  // Register WebSocket support for Gemini Live bidirectional audio streaming
  app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB max audio buffer
    },
  });

  // Register API routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(tenantRoutes);
  app.register(leadRoutes);
  app.register(campaignRoutes);
  app.register(dashboardRoutes);
  app.register(knowledgeRoutes, { prefix: '/tenants/:tenantId/knowledge' });
  app.register(voiceModuleRoutes, { prefix: '/tenants/:tenantId/voice' });

  // Root endpoint info
  app.get('/', async () => {
    return {
      message: 'Welcome to VoicePilot AI API',
      status: 'online',
      phase: 'Phase 4.2: Gemini Live Voice Engine',
      endpoints: {
        health: '/health',
        authMe: 'GET /auth/me (Protected)',
        createTenant: 'POST /tenants (Protected)',
        listTenants: 'GET /tenants (Protected)',
        leads: '/tenants/:tenantId/leads (Protected)',
        campaigns: '/tenants/:tenantId/campaigns (Protected)',
        dashboard: '/tenants/:tenantId/dashboard/stats (Protected)',
        voiceSessions: '/tenants/:tenantId/voice/sessions (Protected)',
        voiceLiveWebSocket: 'WS /tenants/:tenantId/voice/live (Protected)',
        companyKnowledge: '/tenants/:tenantId/knowledge (Protected)',
      },
    };
  });

  return app;
}
