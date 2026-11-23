import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireTenantAccess } from '../middleware/tenant.js';
import { tenantService } from '../services/tenantService.js';

const createTenantSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /tenants
   * Creates a new Tenant (Company). The authenticated user becomes OWNER.
   */
  fastify.post('/tenants', { preHandler: [authenticate] }, async (request, reply) => {
    const parseResult = createTenantSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    try {
      // Ensure user profile is registered in public.user_profiles
      await tenantService.ensureUserProfile(request.user);

      const tenant = await tenantService.createTenant(request.user.id, parseResult.data);
      return reply.status(201).send(tenant);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message || 'Failed to create company',
      });
    }
  });

  /**
   * GET /tenants
   * Returns all tenants the authenticated user belongs to.
   * Multi-tenant security: Completely isolated by authenticated user ID.
   */
  fastify.get('/tenants', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const tenants = await tenantService.listUserTenants(request.user.id);
      return reply.status(200).send(tenants);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to list companies',
      });
    }
  });

  /**
   * GET /tenants/:id
   * Returns details and members for the requested tenant.
   * Multi-tenant security: requireTenantAccess validates that the user is a member of this tenant.
   * If not a member, immediately returns 403 Forbidden!
   */
  fastify.get('/tenants/:id', { preHandler: [authenticate, requireTenantAccess()] }, async (request, reply) => {
    // request.tenant is already verified and populated by requireTenantAccess
    return reply.status(200).send(request.tenant);
  });

  /**
   * GET /tenants/:id/audit-logs
   * Returns audit logs for this tenant. Protected: Only OWNER and ADMIN roles permitted.
   */
  fastify.get(
    '/tenants/:id/audit-logs',
    { preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN'])] },
    async (request, reply) => {
      const params = request.params as { id: string };
      const logs = await tenantService.getTenantAuditLogs(params.id, request.user.id);
      return reply.status(200).send(logs);
    }
  );
};
