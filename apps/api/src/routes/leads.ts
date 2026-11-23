import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireTenantAccess } from '../middleware/tenant.js';
import { leadService } from '../services/leadService.js';

const leadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'NOT_INTERESTED',
  'CALLBACK',
  'CONVERTED',
  'LOST',
]);

const consentStatusEnum = z.enum([
  'CONSENT_GRANTED',
  'CONSENT_REVOKED',
  'PENDING_VERIFICATION',
  'LAWFUL_BASIS',
]);

const leadSourceEnum = z.enum([
  'WEBSITE',
  'INBOUND',
  'COLD_OUTREACH',
  'REFERRAL',
  'EVENT',
  'PAID_ADS',
  'CSV_IMPORT',
  'OTHER',
]);

const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  companyName: z.string().optional().nullable(),
  country: z.string().default('IN'),
  languagePreference: z.string().default('en-US'),
  leadSource: leadSourceEnum.default('OTHER'),
  status: leadStatusEnum.default('NEW'),
  notes: z.string().optional().nullable(),
  assignedAgentId: z.string().optional().nullable(),
  consentStatus: consentStatusEnum.default('PENDING_VERIFICATION'),
  consentSource: z.string().optional().nullable(),
  isDnc: z.boolean().default(false),
  dncReason: z.string().optional().nullable(),
});

const updateLeadSchema = createLeadSchema.partial();

export const leadRoutes: FastifyPluginAsync = async (app) => {
  // 1. List leads with search & filters
  app.get(
    '/tenants/:tenantId/leads',
    {
      preHandler: [authenticate, requireTenantAccess()],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const query = request.query as any;
      const result = await leadService.getLeads(tenantId, query);
      return reply.send(result);
    }
  );

  // 2. Create single lead
  app.post(
    '/tenants/:tenantId/leads',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const validated = createLeadSchema.parse(request.body);
      const lead = await leadService.createLead(tenantId, request.user.id, validated as any);
      return reply.status(201).send(lead);
    }
  );

  // 3. Preview CSV Import
  app.post(
    '/tenants/:tenantId/leads/import-preview',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const body = request.body as { rows: any[] };
      if (!body.rows || !Array.isArray(body.rows)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'An array of rows is required in body.rows',
        });
      }
      const preview = await leadService.previewCsvImport(tenantId, body.rows);
      return reply.send(preview);
    }
  );

  // 4. Execute Bulk CSV Import
  app.post(
    '/tenants/:tenantId/leads/import',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const body = request.body as { rows: any[] };
      if (!body.rows || !Array.isArray(body.rows)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'An array of rows is required in body.rows',
        });
      }
      const result = await leadService.importCsvLeads(tenantId, request.user.id, body.rows);
      return reply.status(201).send(result);
    }
  );

  // 5. Get lead by ID
  app.get(
    '/tenants/:tenantId/leads/:id',
    {
      preHandler: [authenticate, requireTenantAccess()],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const lead = await leadService.getLeadById(tenantId, id);
      return reply.send(lead);
    }
  );

  // 6. Update lead
  app.patch(
    '/tenants/:tenantId/leads/:id',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const validated = updateLeadSchema.parse(request.body);
      const updated = await leadService.updateLead(tenantId, id, request.user.id, validated as any);
      return reply.send(updated);
    }
  );

  // 7. Delete lead (Restricted to OWNER and ADMIN)
  app.delete(
    '/tenants/:tenantId/leads/:id',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const result = await leadService.deleteLead(tenantId, id, request.user.id);
      return reply.send(result);
    }
  );
};
