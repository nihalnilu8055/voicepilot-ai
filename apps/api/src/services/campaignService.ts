import { prisma } from '../db/prisma.js';
import type {
  Campaign,
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignFilterQuery,
  CampaignListResponse,
  CampaignStatus,
  CampaignStats,
  SalesObjective,
  SalesPersonality,
  TenantRole,
} from '@voicepilot/shared';
import { leadService } from './leadService.js';

interface InMemoryCampaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  salesObjective: SalesObjective;
  salesPersonality: SalesPersonality;
  preferredLanguage: string;
  voicePreference: string;
  startDate: string;
  startTime: string;
  timezone: string;
  status: CampaignStatus;
  createdById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryCampaignLead {
  id: string;
  campaignId: string;
  leadId: string;
  tenantId: string;
  status: 'PENDING' | 'SCHEDULED' | 'EXCLUDED' | 'COMPLETED';
  isCallable: boolean;
  unfitReason: string | null;
  addedAt: Date;
}

export class CampaignService {
  private useMemoryFallback = false;
  private memoryCampaigns = new Map<string, InMemoryCampaign>();
  private memoryCampaignLeads = new Map<string, InMemoryCampaignLead>();

  constructor() {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-database-url-placeholder')) {
      this.useMemoryFallback = true;
    }
  }

  public setMemoryMode(enabled: boolean) {
    this.useMemoryFallback = enabled;
  }

  public clearMemoryState() {
    this.memoryCampaigns.clear();
    this.memoryCampaignLeads.clear();
  }

  async createCampaign(
    tenantId: string,
    userId: string,
    userRole: TenantRole,
    data: CreateCampaignDto
  ): Promise<Campaign> {
    const status: CampaignStatus = 'DRAFT';

    if (this.useMemoryFallback) {
      const id = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const inMemory: InMemoryCampaign = {
        id,
        tenantId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        salesObjective: (data.salesObjective as any) || 'LEAD_GENERATION',
        salesPersonality: 'CONSULTATIVE',
        preferredLanguage: data.preferredLanguage || 'en-IN',
        voicePreference: data.voicePreference || 'Priya (Warm)',
        startDate: data.startDate,
        startTime: data.startTime,
        timezone: data.timezone || 'Asia/Kolkata',
        status,
        createdById: userId,
        approvedById: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryCampaigns.set(id, inMemory);

      if (data.leadIds && data.leadIds.length > 0) {
        await this.attachLeads(tenantId, id, data.leadIds);
      }

      return this.getCampaignById(tenantId, id);
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        salesObjective: (data.salesObjective as any) || 'LEAD_GENERATION',
        salesPersonality: 'CONSULTATIVE',
        preferredLanguage: data.preferredLanguage || 'en-IN',
        voicePreference: data.voicePreference || 'Priya (Warm)',
        startDate: data.startDate,
        startTime: data.startTime,
        timezone: data.timezone || 'Asia/Kolkata',
        status,
        createdById: userId,
      },
    });

    if (data.leadIds && data.leadIds.length > 0) {
      await this.attachLeads(tenantId, campaign.id, data.leadIds);
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_CREATED',
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        metadata: {
          campaignName: campaign.name,
          salesObjective: campaign.salesObjective,
          leadsCount: data.leadIds?.length || 0,
        },
      },
    });

    return this.getCampaignById(tenantId, campaign.id);
  }

  async attachLeads(tenantId: string, campaignId: string, leadIds: string[]): Promise<void> {
    if (this.useMemoryFallback) {
      for (const leadId of leadIds) {
        try {
          const lead = await leadService.getLeadById(tenantId, leadId);
          let isCallable = lead.isCallable;
          let unfitReason: string | null = null;

          if (lead.isDnc) {
            isCallable = false;
            unfitReason = 'Excluded: Contact flagged on Do Not Call (DNC) list';
          } else if (lead.consentStatus !== 'CONSENT_GRANTED' && lead.consentStatus !== 'LAWFUL_BASIS') {
            isCallable = false;
            unfitReason = 'Excluded: Missing documented calling consent or lawful basis';
          }

          const clId = `${campaignId}_${leadId}`;
          this.memoryCampaignLeads.set(clId, {
            id: clId,
            campaignId,
            leadId,
            tenantId,
            status: isCallable ? 'PENDING' : 'EXCLUDED',
            isCallable,
            unfitReason,
            addedAt: new Date(),
          });
        } catch {
          // Skip if lead not found or not in tenant
        }
      }
      return;
    }

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        tenantId,
      },
    });

    for (const lead of leads) {
      let isCallable = lead.isCallable;
      let unfitReason: string | null = null;

      if (lead.isDnc) {
        isCallable = false;
        unfitReason = 'Excluded: Contact flagged on Do Not Call (DNC) list';
      } else if (lead.consentStatus !== 'CONSENT_GRANTED' && lead.consentStatus !== 'LAWFUL_BASIS') {
        isCallable = false;
        unfitReason = 'Excluded: Missing documented calling consent or lawful basis';
      }

      await prisma.campaignLead.upsert({
        where: {
          campaign_lead_unique: {
            campaignId,
            leadId: lead.id,
          },
        },
        create: {
          campaignId,
          leadId: lead.id,
          tenantId,
          status: isCallable ? 'PENDING' : 'EXCLUDED',
          isCallable,
          unfitReason,
        },
        update: {
          isCallable,
          unfitReason,
          status: isCallable ? 'PENDING' : 'EXCLUDED',
        },
      });
    }
  }

  async getCampaigns(tenantId: string, query: CampaignFilterQuery): Promise<CampaignListResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (this.useMemoryFallback) {
      let filtered = Array.from(this.memoryCampaigns.values()).filter(
        (c) => c.tenantId === tenantId
      );

      if (query.search) {
        const s = query.search.trim().toLowerCase();
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(s));
      }

      if (query.status) {
        filtered = filtered.filter((c) => c.status === query.status);
      }

      if (query.salesObjective) {
        filtered = filtered.filter((c) => c.salesObjective === query.salesObjective);
      }

      if (query.preferredLanguage) {
        filtered = filtered.filter((c) => c.preferredLanguage === query.preferredLanguage);
      }

      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      const records = filtered.slice(skip, skip + limit);

      const campaigns = records.map((c) => {
        const campaignLeads = Array.from(this.memoryCampaignLeads.values()).filter(
          (cl) => cl.campaignId === c.id
        );
        const totalLeadsCount = campaignLeads.length;
        const callableLeadsCount = campaignLeads.filter((l) => l.isCallable).length;
        const dncBlockedCount = totalLeadsCount - callableLeadsCount;

        return {
          id: c.id,
          tenantId: c.tenantId,
          name: c.name,
          description: c.description,
          salesObjective: c.salesObjective,
          salesPersonality: c.salesPersonality,
          preferredLanguage: c.preferredLanguage,
          voicePreference: c.voicePreference,
          startDate: c.startDate,
          startTime: c.startTime,
          timezone: c.timezone,
          status: c.status,
          createdById: c.createdById,
          createdByUser: { id: c.createdById, fullName: 'Author', email: 'author@demo.com' },
          approvedById: c.approvedById,
          approvedByUser: c.approvedById ? { id: c.approvedById, fullName: 'Approver', email: 'approver@demo.com' } : null,
          approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
          totalLeadsCount,
          callableLeadsCount,
          dncBlockedCount,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
      });

      return {
        campaigns,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    const where: any = { tenantId };

    if (query.search) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.salesObjective) {
      where.salesObjective = query.salesObjective;
    }

    if (query.preferredLanguage) {
      where.preferredLanguage = query.preferredLanguage;
    }

    const [total, records] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          approvedBy: { select: { id: true, fullName: true, email: true } },
          campaignLeads: {
            select: { id: true, isCallable: true },
          },
        },
      }),
    ]);

    const campaigns = records.map((c) => {
      const totalLeadsCount = c.campaignLeads.length;
      const callableLeadsCount = c.campaignLeads.filter((l) => l.isCallable).length;
      const dncBlockedCount = totalLeadsCount - callableLeadsCount;

      return {
        id: c.id,
        tenantId: c.tenantId,
        name: c.name,
        description: c.description,
        salesObjective: c.salesObjective as SalesObjective,
        salesPersonality: c.salesPersonality as SalesPersonality,
        preferredLanguage: c.preferredLanguage,
        voicePreference: c.voicePreference,
        startDate: c.startDate,
        startTime: c.startTime,
        timezone: c.timezone,
        status: c.status as CampaignStatus,
        createdById: c.createdById,
        createdByUser: c.createdBy,
        approvedById: c.approvedById,
        approvedByUser: c.approvedBy,
        approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
        totalLeadsCount,
        callableLeadsCount,
        dncBlockedCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    return {
      campaigns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getCampaignById(tenantId: string, campaignId: string): Promise<Campaign> {
    if (this.useMemoryFallback) {
      const c = this.memoryCampaigns.get(campaignId);
      if (!c || c.tenantId !== tenantId) {
        const error: any = new Error(`Campaign with ID ${campaignId} not found in this company`);
        error.statusCode = 404;
        throw error;
      }

      const campaignLeads = Array.from(this.memoryCampaignLeads.values()).filter(
        (cl) => cl.campaignId === campaignId
      );
      const totalLeadsCount = campaignLeads.length;
      const callableLeadsCount = campaignLeads.filter((l) => l.isCallable).length;
      const dncBlockedCount = totalLeadsCount - callableLeadsCount;

      return {
        id: c.id,
        tenantId: c.tenantId,
        name: c.name,
        description: c.description,
        salesObjective: c.salesObjective,
        salesPersonality: c.salesPersonality,
        preferredLanguage: c.preferredLanguage,
        voicePreference: c.voicePreference,
        startDate: c.startDate,
        startTime: c.startTime,
        timezone: c.timezone,
        status: c.status,
        createdById: c.createdById,
        createdByUser: { id: c.createdById, fullName: 'Author', email: 'author@demo.com' },
        approvedById: c.approvedById,
        approvedByUser: c.approvedById ? { id: c.approvedById, fullName: 'Approver', email: 'approver@demo.com' } : null,
        approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
        totalLeadsCount,
        callableLeadsCount,
        dncBlockedCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        campaignLeads: campaignLeads.map((cl) => ({
          id: cl.id,
          campaignId: cl.campaignId,
          leadId: cl.leadId,
          tenantId: cl.tenantId,
          status: cl.status as any,
          isCallable: cl.isCallable,
          unfitReason: cl.unfitReason,
          addedAt: cl.addedAt.toISOString(),
        })),
      };
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        campaignLeads: {
          include: {
            lead: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                companyName: true,
                country: true,
                languagePreference: true,
                status: true,
                consentStatus: true,
                isDnc: true,
                isCallable: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      const error: any = new Error(`Campaign with ID ${campaignId} not found in this company`);
      error.statusCode = 404;
      throw error;
    }

    const totalLeadsCount = campaign.campaignLeads.length;
    const callableLeadsCount = campaign.campaignLeads.filter((l) => l.isCallable).length;
    const dncBlockedCount = totalLeadsCount - callableLeadsCount;

    return {
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description,
      salesObjective: campaign.salesObjective as SalesObjective,
      salesPersonality: campaign.salesPersonality as SalesPersonality,
      preferredLanguage: campaign.preferredLanguage,
      voicePreference: campaign.voicePreference,
      startDate: campaign.startDate,
      startTime: campaign.startTime,
      timezone: campaign.timezone,
      status: campaign.status as CampaignStatus,
      createdById: campaign.createdById,
      createdByUser: campaign.createdBy,
      approvedById: campaign.approvedById,
      approvedByUser: campaign.approvedBy,
      approvedAt: campaign.approvedAt ? campaign.approvedAt.toISOString() : null,
      totalLeadsCount,
      callableLeadsCount,
      dncBlockedCount,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      campaignLeads: campaign.campaignLeads.map((cl) => ({
        id: cl.id,
        campaignId: cl.campaignId,
        leadId: cl.leadId,
        tenantId: cl.tenantId,
        status: cl.status as any,
        isCallable: cl.isCallable,
        unfitReason: cl.unfitReason,
        addedAt: cl.addedAt.toISOString(),
        lead: cl.lead as any,
      })),
    };
  }

  async updateCampaign(
    tenantId: string,
    campaignId: string,
    userId: string,
    data: UpdateCampaignDto
  ): Promise<Campaign> {
    if (this.useMemoryFallback) {
      const c = this.memoryCampaigns.get(campaignId);
      if (!c || c.tenantId !== tenantId) {
        const error: any = new Error('Campaign not found or access denied');
        error.statusCode = 404;
        throw error;
      }

      if (c.status === 'COMPLETED' || c.status === 'CANCELLED') {
        const error: any = new Error(`Cannot update a campaign with status ${c.status}`);
        error.statusCode = 400;
        throw error;
      }

      c.name = data.name !== undefined ? data.name.trim() : c.name;
      c.description = data.description !== undefined ? data.description?.trim() || null : c.description;
      c.salesObjective = (data.salesObjective as any) || c.salesObjective;
      c.preferredLanguage = data.preferredLanguage || c.preferredLanguage;
      c.voicePreference = data.voicePreference || c.voicePreference;
      c.startDate = data.startDate || c.startDate;
      c.startTime = data.startTime || c.startTime;
      c.timezone = data.timezone || c.timezone;
      c.updatedAt = new Date();

      return this.getCampaignById(tenantId, campaignId);
    }

    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!existing) {
      const error: any = new Error('Campaign not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      const error: any = new Error(`Cannot update a campaign with status ${existing.status}`);
      error.statusCode = 400;
      throw error;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description?.trim() || null : undefined,
        salesObjective: (data.salesObjective as any) || undefined,
        salesPersonality: 'CONSULTATIVE',
        preferredLanguage: data.preferredLanguage || undefined,
        voicePreference: data.voicePreference || undefined,
        startDate: data.startDate || undefined,
        startTime: data.startTime || undefined,
        timezone: data.timezone || undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_UPDATED',
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        metadata: { updatedFields: Object.keys(data) },
      },
    });

    return this.getCampaignById(tenantId, campaignId);
  }

  async approveCampaign(
    tenantId: string,
    campaignId: string,
    userId: string,
    userRole: TenantRole
  ): Promise<Campaign> {
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      const error: any = new Error(
        `Insufficient permissions. Only OWNER or ADMIN can approve campaigns. Your role: ${userRole}`
      );
      error.statusCode = 403;
      throw error;
    }

    if (this.useMemoryFallback) {
      const c = this.memoryCampaigns.get(campaignId);
      if (!c || c.tenantId !== tenantId) {
        const error: any = new Error('Campaign not found or access denied');
        error.statusCode = 404;
        throw error;
      }
      c.status = 'APPROVED';
      c.approvedById = userId;
      c.approvedAt = new Date();
      c.updatedAt = new Date();
      return this.getCampaignById(tenantId, campaignId);
    }

    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!existing) {
      const error: any = new Error('Campaign not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_APPROVED',
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        metadata: {
          approvedByRole: userRole,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    return this.getCampaignById(tenantId, campaignId);
  }

  async updateStatus(
    tenantId: string,
    campaignId: string,
    userId: string,
    userRole: TenantRole,
    newStatus: CampaignStatus
  ): Promise<Campaign> {
    if (this.useMemoryFallback) {
      const c = this.memoryCampaigns.get(campaignId);
      if (!c || c.tenantId !== tenantId) {
        const error: any = new Error('Campaign not found or access denied');
        error.statusCode = 404;
        throw error;
      }

      if (newStatus === 'APPROVED' && userRole !== 'OWNER' && userRole !== 'ADMIN') {
        const error: any = new Error('Only OWNER or ADMIN can transition a campaign to APPROVED');
        error.statusCode = 403;
        throw error;
      }

      c.status = newStatus;
      c.updatedAt = new Date();
      return this.getCampaignById(tenantId, campaignId);
    }

    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!existing) {
      const error: any = new Error('Campaign not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    if (newStatus === 'APPROVED' && userRole !== 'OWNER' && userRole !== 'ADMIN') {
      const error: any = new Error('Only OWNER or ADMIN can transition a campaign to APPROVED');
      error.statusCode = 403;
      throw error;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: newStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_STATUS_CHANGED',
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        metadata: {
          previousStatus: existing.status,
          newStatus,
        },
      },
    });

    return this.getCampaignById(tenantId, campaignId);
  }

  async deleteCampaign(
    tenantId: string,
    campaignId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    if (this.useMemoryFallback) {
      const c = this.memoryCampaigns.get(campaignId);
      if (!c || c.tenantId !== tenantId) {
        const error: any = new Error('Campaign not found or access denied');
        error.statusCode = 404;
        throw error;
      }
      this.memoryCampaigns.delete(campaignId);
      return { success: true };
    }

    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!existing) {
      const error: any = new Error('Campaign not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CAMPAIGN_DELETED',
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        metadata: { campaignName: existing.name },
      },
    });

    return { success: true };
  }

  async getCampaignStats(tenantId: string, campaignId: string): Promise<CampaignStats> {
    const campaign = await this.getCampaignById(tenantId, campaignId);
    return {
      totalLeads: campaign.totalLeadsCount,
      callableLeads: campaign.callableLeadsCount,
      dncBlockedLeads: campaign.dncBlockedCount,
      consentVerifiedLeads: campaign.callableLeadsCount,
      pendingApproval: campaign.status === 'PENDING_APPROVAL',
      status: campaign.status,
    };
  }
}

export const campaignService = new CampaignService();
