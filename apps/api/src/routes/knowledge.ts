import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { requireTenantAccess } from '../middleware/tenant.js';
import { companyKnowledgeService } from '../services/companyKnowledgeService.js';
import {
  createKnowledgeSchema,
  updateKnowledgeSchema,
} from '@voicepilot/shared';

export const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireTenantAccess());

  // GET /tenants/:tenantId/knowledge
  app.get('/', async (request, reply) => {
    const tenantId = (request.params as any).tenantId;
    const query = request.query as any;
    const items = await companyKnowledgeService.listKnowledge(tenantId, {
      category: query?.category,
      search: query?.search,
    });
    return reply.send({ items, total: items.length });
  });

  // GET /tenants/:tenantId/knowledge/:id
  app.get('/:id', async (request, reply) => {
    const { tenantId, id } = request.params as any;
    const item = await companyKnowledgeService.getKnowledgeById(tenantId, id);
    if (!item) {
      return reply.status(404).send({ error: 'Not Found', message: 'Knowledge article not found' });
    }
    return reply.send(item);
  });

  // POST /tenants/:tenantId/knowledge
  app.post('/', async (request, reply) => {
    const tenantId = (request.params as any).tenantId;
    const validation = createKnowledgeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const created = await companyKnowledgeService.createKnowledge(tenantId, validation.data);
    return reply.status(201).send(created);
  });

  // PUT /tenants/:tenantId/knowledge/:id
  app.put('/:id', async (request, reply) => {
    const { tenantId, id } = request.params as any;
    const validation = updateKnowledgeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const updated = await companyKnowledgeService.updateKnowledge(tenantId, id, validation.data);
    if (!updated) {
      return reply.status(404).send({ error: 'Not Found', message: 'Knowledge article not found' });
    }
    return reply.send(updated);
  });

  // DELETE /tenants/:tenantId/knowledge/:id
  app.delete('/:id', async (request, reply) => {
    const { tenantId, id } = request.params as any;
    const deleted = await companyKnowledgeService.deleteKnowledge(tenantId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Knowledge article not found' });
    }
    return reply.send({ success: true, message: 'Knowledge article deleted' });
  });
};
