import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@voicepilot/shared';
import { env } from '../config/env.js';

const startTime = Date.now();

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: HealthResponse }>('/health', async (_request, reply) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    const response: HealthResponse = {
      status: 'ok',
      service: 'VoicePilot AI API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: uptimeSeconds,
      environment: env.NODE_ENV,
    };

    return reply.status(200).send(response);
  });
};
