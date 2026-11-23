import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { requireTenantAccess } from '../middleware/tenant.js';
import { dashboardService } from '../services/dashboardService.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/tenants/:tenantId/dashboard/stats',
    {
      preHandler: [authenticate, requireTenantAccess()],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const stats = await dashboardService.getDashboardStats(tenantId);
      return reply.send(stats);
    }
  );
};
