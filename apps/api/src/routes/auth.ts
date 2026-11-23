import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantService } from '../services/tenantService.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/me
   * Returns current authenticated user profile and their active company memberships.
   */
  fastify.get('/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const authMe = await tenantService.getAuthMe(request.user);
      return reply.status(200).send(authMe);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to retrieve user profile',
      });
    }
  });
};
