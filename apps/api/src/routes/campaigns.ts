import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireTenantAccess } from '../middleware/tenant.js';
import { campaignService } from '../services/campaignService.js';

const salesObjectiveEnum = z.enum(['LEAD_GENERATION', 'DIRECT_SALES', 'BOTH']);
const salesPersonalityEnum = z.enum(['CONSULTATIVE']);
const campaignStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional().nullable(),
  salesObjective: salesObjectiveEnum.default('LEAD_GENERATION'),
  salesPersonality: salesPersonalityEnum.default('CONSULTATIVE'),
  preferredLanguage: z.string().default('en-US'),
  voicePreference: z.string().default('Priya (Warm)'),
  startDate: z.string().min(4, 'Start date is required'),
  startTime: z.string().min(2, 'Start time is required'),
  timezone: z.string().default('Asia/Kolkata'),
  leadIds: z.array(z.string().min(1)).optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  // 1. List campaigns
  app.get(
    '/tenants/:tenantId/campaigns',
    {
      preHandler: [authenticate, requireTenantAccess()],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const query = request.query as any;
      const result = await campaignService.getCampaigns(tenantId, query);
      return reply.send(result);
    }
  );

  // 2. Create campaign
  app.post(
    '/tenants/:tenantId/campaigns',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const tenantId = (request.params as any).tenantId;
      const validated = createCampaignSchema.parse(request.body);
      const campaign = await campaignService.createCampaign(
        tenantId,
        request.user.id,
        request.tenant.currentUserRole,
        validated as any
      );
      return reply.status(201).send(campaign);
    }
  );

  // 3. Get campaign details
  app.get(
    '/tenants/:tenantId/campaigns/:id',
    {
      preHandler: [authenticate, requireTenantAccess()],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const campaign = await campaignService.getCampaignById(tenantId, id);
      return reply.send(campaign);
    }
  );

  // 4. Update campaign
  app.patch(
    '/tenants/:tenantId/campaigns/:id',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const validated = updateCampaignSchema.parse(request.body);
      const updated = await campaignService.updateCampaign(
        tenantId,
        id,
        request.user.id,
        validated as any
      );
      return reply.send(updated);
    }
  );

  // 5. Campaign Approval Workflow - STRICTLY OWNER OR ADMIN
  app.post(
    '/tenants/:tenantId/campaigns/:id/approve',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const approved = await campaignService.approveCampaign(
        tenantId,
        id,
        request.user.id,
        request.tenant.currentUserRole
      );
      return reply.send(approved);
    }
  );

  // 6. Pause / Resume / Cancel Status update
  app.post(
    '/tenants/:tenantId/campaigns/:id/status',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const body = request.body as { status: any };
      const validatedStatus = campaignStatusEnum.parse(body.status);
      const updated = await campaignService.updateStatus(
        tenantId,
        id,
        request.user.id,
        request.tenant.currentUserRole,
        validatedStatus as any
      );
      return reply.send(updated);
    }
  );

  // 7. Attach / Sync leads to campaign
  app.post(
    '/tenants/:tenantId/campaigns/:id/leads',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN', 'AGENT'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const body = request.body as { leadIds: string[] };
      if (!body.leadIds || !Array.isArray(body.leadIds)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'leadIds array is required',
        });
      }
      await campaignService.attachLeads(tenantId, id, body.leadIds);
      const updated = await campaignService.getCampaignById(tenantId, id);
      return reply.send(updated);
    }
  );

  // 8. Delete campaign (Restricted to OWNER and ADMIN)
  app.delete(
    '/tenants/:tenantId/campaigns/:id',
    {
      preHandler: [authenticate, requireTenantAccess(['OWNER', 'ADMIN'])],
    },
    async (request, reply) => {
      const { tenantId, id } = request.params as any;
      const result = await campaignService.deleteCampaign(tenantId, id, request.user.id);
      return reply.send(result);
    }
  );
};
