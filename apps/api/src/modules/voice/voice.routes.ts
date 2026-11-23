import type { FastifyPluginAsync } from 'fastify';
import { voiceGateway } from './voice.gateway.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenantAccess } from '../../middleware/tenant.js';
import { voiceEngineService } from '../../services/voiceEngineService.js';
import { conversationEvaluationService } from '../../services/conversationEvaluationService.js';
import {
  createVoiceSessionSchema,
  sendVoiceMessageSchema,
  endVoiceSessionSchema,
} from '@voicepilot/shared';

export const voiceModuleRoutes: FastifyPluginAsync = async (app) => {
  // Register Real-time WebSocket Gateway
  app.register(voiceGateway);

  // Authenticated REST Endpoints
  // POST /tenants/:tenantId/voice/sessions
  app.post(
    '/sessions',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const userId = request.user!.id;

      const validation = createVoiceSessionSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: validation.error.errors.map((e) => e.message).join(', '),
        });
      }

      const session = await voiceEngineService.createSession(
        tenantId,
        userId,
        validation.data
      );

      return reply.status(201).send(session);
    }
  );

  // GET /tenants/:tenantId/voice/sessions
  app.get(
    '/sessions',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const sessions = await voiceEngineService.listSessions(tenantId);
      return reply.send({ sessions, total: sessions.length });
    }
  );

  // GET /tenants/:tenantId/voice/sessions/:id
  app.get(
    '/sessions/:id',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const session = await voiceEngineService.getSession(tenantId, id);
      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Voice session not found',
        });
      }
      return reply.send(session);
    }
  );

  // POST /tenants/:tenantId/voice/sessions/:id/messages
  app.post(
    '/sessions/:id/messages',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const session = await voiceEngineService.getSession(tenantId, id);
      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Voice session not found',
        });
      }

      const validation = sendVoiceMessageSchema.safeParse({
        sessionId: id,
        ...(request.body as any),
      });

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: validation.error.errors.map((e) => e.message).join(', '),
        });
      }

      const turn = await voiceEngineService.processUserMessage(
        tenantId,
        id,
        validation.data.text,
        validation.data.language
      );

      return reply.status(200).send(turn);
    }
  );

  // POST /tenants/:tenantId/voice/sessions/:id/end
  app.post(
    '/sessions/:id/end',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const validation = endVoiceSessionSchema.safeParse({
        sessionId: id,
        ...(request.body as any),
      });

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: validation.error.errors.map((e) => e.message).join(', '),
        });
      }

      const completedSession = await voiceEngineService.endSession(
        tenantId,
        id,
        validation.data
      );

      if (!completedSession) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Voice session not found',
        });
      }

      return reply.send(completedSession);
    }
  );

  // GET /tenants/:tenantId/voice/sessions/:id/evaluation
  app.get(
    '/sessions/:id/evaluation',
    { preHandler: [authenticate, requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const evaluation = await conversationEvaluationService.getEvaluationBySession(
        tenantId,
        id
      );

      if (!evaluation) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Evaluation not found for this session',
        });
      }

      return reply.send(evaluation);
    }
  );
};
