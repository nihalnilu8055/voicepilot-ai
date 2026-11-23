import { prisma } from '../db/prisma.js';
import type {
  CompanyKnowledge,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeCategory,
} from '@voicepilot/shared';

// In-memory store for unit test suites and zero-DB mocking
const memoryKnowledge = new Map<string, CompanyKnowledge>();
let isMemoryMode = false;

export const companyKnowledgeService = {
  setMemoryMode(enabled: boolean) {
    isMemoryMode = enabled;
  },

  clearMemoryState() {
    memoryKnowledge.clear();
  },

  async listKnowledge(
    tenantId: string,
    filters?: { category?: KnowledgeCategory; search?: string }
  ): Promise<CompanyKnowledge[]> {
    if (isMemoryMode) {
      let items = Array.from(memoryKnowledge.values()).filter(
        (k) => k.tenantId === tenantId
      );
      if (filters?.category) {
        items = items.filter((k) => k.category === filters.category);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(
          (k) =>
            k.title.toLowerCase().includes(q) ||
            k.content.toLowerCase().includes(q)
        );
      }
      return items;
    }

    try {
      const records = await prisma.companyKnowledge.findMany({
        where: {
          tenantId,
          ...(filters?.category ? { category: filters.category } : {}),
          ...(filters?.search
            ? {
                OR: [
                  { title: { contains: filters.search, mode: 'insensitive' } },
                  { content: { contains: filters.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        title: r.title,
        category: r.category as KnowledgeCategory,
        content: r.content,
        tags: r.tags,
        isApproved: r.isApproved,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      // Graceful fallback to memory mode if database table not yet populated
      return Array.from(memoryKnowledge.values()).filter(
        (k) => k.tenantId === tenantId
      );
    }
  },

  async getKnowledgeById(
    tenantId: string,
    id: string
  ): Promise<CompanyKnowledge | null> {
    if (isMemoryMode) {
      const item = memoryKnowledge.get(id);
      if (item && item.tenantId === tenantId) return item;
      return null;
    }

    try {
      const record = await prisma.companyKnowledge.findFirst({
        where: { id, tenantId },
      });
      if (!record) return null;
      return {
        id: record.id,
        tenantId: record.tenantId,
        title: record.title,
        category: record.category as KnowledgeCategory,
        content: record.content,
        tags: record.tags,
        isApproved: record.isApproved,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    } catch {
      const item = memoryKnowledge.get(id);
      if (item && item.tenantId === tenantId) return item;
      return null;
    }
  },

  async createKnowledge(
    tenantId: string,
    input: CreateKnowledgeInput
  ): Promise<CompanyKnowledge> {
    const id = `knw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const created: CompanyKnowledge = {
      id,
      tenantId,
      title: input.title,
      category: input.category,
      content: input.content,
      tags: input.tags,
      isApproved: input.isApproved ?? true,
      createdAt: now,
      updatedAt: now,
    };

    if (isMemoryMode) {
      memoryKnowledge.set(id, created);
      return created;
    }

    try {
      const record = await prisma.companyKnowledge.create({
        data: {
          id,
          tenantId,
          title: input.title,
          category: input.category,
          content: input.content,
          tags: input.tags,
          isApproved: input.isApproved ?? true,
        },
      });

      return {
        id: record.id,
        tenantId: record.tenantId,
        title: record.title,
        category: record.category as KnowledgeCategory,
        content: record.content,
        tags: record.tags,
        isApproved: record.isApproved,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    } catch {
      // In-memory fallback
      memoryKnowledge.set(id, created);
      return created;
    }
  },

  async updateKnowledge(
    tenantId: string,
    id: string,
    input: UpdateKnowledgeInput
  ): Promise<CompanyKnowledge | null> {
    if (isMemoryMode) {
      const existing = memoryKnowledge.get(id);
      if (!existing || existing.tenantId !== tenantId) return null;
      const updated: CompanyKnowledge = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      memoryKnowledge.set(id, updated);
      return updated;
    }

    try {
      const record = await prisma.companyKnowledge.update({
        where: { id },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.content ? { content: input.content } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
          ...(input.isApproved !== undefined
            ? { isApproved: input.isApproved }
            : {}),
        },
      });
      return {
        id: record.id,
        tenantId: record.tenantId,
        title: record.title,
        category: record.category as KnowledgeCategory,
        content: record.content,
        tags: record.tags,
        isApproved: record.isApproved,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    } catch {
      const existing = memoryKnowledge.get(id);
      if (!existing || existing.tenantId !== tenantId) return null;
      const updated: CompanyKnowledge = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      memoryKnowledge.set(id, updated);
      return updated;
    }
  },

  async deleteKnowledge(tenantId: string, id: string): Promise<boolean> {
    if (isMemoryMode) {
      const existing = memoryKnowledge.get(id);
      if (!existing || existing.tenantId !== tenantId) return false;
      return memoryKnowledge.delete(id);
    }

    try {
      await prisma.companyKnowledge.delete({
        where: { id },
      });
      return true;
    } catch {
      return memoryKnowledge.delete(id);
    }
  },
};
