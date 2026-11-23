import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TenantRole, TenantDetailResponse } from '@voicepilot/shared';
import { tenantService } from '../services/tenantService.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantDetailResponse;
  }
}

/**
 * Multi-tenant Security Middleware
 *
 * Enforces company boundary isolation:
 * 1. Resolves tenant ID from URL parameter ':id' or ':tenantId', or 'x-tenant-id' header.
 * 2. Never trusts caller claims blindly: queries verified membership in database.
 * 3. Enforces that request.user belongs to the tenant.
 * 4. Optionally validates role permissions (e.g. ['OWNER', 'ADMIN']).
 */
export function requireTenantAccess(allowedRoles?: TenantRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string> | undefined;
    const tenantId = params?.tenantId || (request.headers['x-tenant-id'] as string) || params?.id;

    if (!tenantId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Tenant ID must be specified via route parameter or x-tenant-id header.',
      });
    }

    if (!request.user || !request.user.id) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required prior to tenant authorization.',
      });
    }

    try {
      const tenant = await tenantService.getTenantById(tenantId, request.user.id);

      // Check role permissions if specified
      if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(tenant.currentUserRole)) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}. Current role: ${tenant.currentUserRole}`,
          });
        }
      }

      request.tenant = tenant;
    } catch (err: any) {
      const statusCode = err.statusCode || 403;
      return reply.status(statusCode).send({
        statusCode,
        error: statusCode === 404 ? 'Not Found' : 'Forbidden',
        message: err.message || 'Access denied for this tenant',
      });
    }
  };
}
