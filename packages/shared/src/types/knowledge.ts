import { z } from 'zod';

export type KnowledgeCategory = 'PRODUCTS' | 'PRICING' | 'POLICIES' | 'FAQ' | 'GENERAL';

export interface CompanyKnowledge {
  id: string;
  tenantId: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  tags: string[];
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createKnowledgeSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  category: z.enum(['PRODUCTS', 'PRICING', 'POLICIES', 'FAQ', 'GENERAL']).default('PRODUCTS'),
  content: z.string().min(5, 'Content must be at least 5 characters'),
  tags: z.array(z.string()).default([]),
  isApproved: z.boolean().default(true),
});

export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;

export const updateKnowledgeSchema = createKnowledgeSchema.partial();
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
