import { prisma } from '../db/prisma.js';
import type { DashboardStatsResponse } from '@voicepilot/shared';
import { leadService } from './leadService.js';
import { campaignService } from './campaignService.js';

export class DashboardService {
  private useMemoryFallback = false;

  constructor() {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-database-url-placeholder')) {
      this.useMemoryFallback = true;
    }
  }

  public setMemoryMode(enabled: boolean) {
    this.useMemoryFallback = enabled;
  }

  async getDashboardStats(tenantId: string): Promise<DashboardStatsResponse> {
    if (this.useMemoryFallback) {
      const [leadsRes, campaignsRes] = await Promise.all([
        leadService.getLeads(tenantId, { limit: 1000 }),
        campaignService.getCampaigns(tenantId, { limit: 1000 }),
      ]);

      const leads = leadsRes.leads;
      const campaigns = campaignsRes.campaigns;

      const totalLeads = leads.length;
      const newLeads = leads.filter((l) => l.status === 'NEW').length;
      const qualifiedLeads = leads.filter((l) => l.status === 'QUALIFIED').length;
      const convertedLeads = leads.filter((l) => l.status === 'CONVERTED').length;
      const callbackLeads = leads.filter((l) => l.status === 'CALLBACK').length;
      const dncBlockedLeads = leads.filter((l) => l.isDnc).length;
      const callableLeads = leads.filter((l) => l.isCallable).length;

      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter((c) => c.status === 'APPROVED').length;
      const pendingApprovalCampaigns = campaigns.filter((c) => c.status === 'PENDING_APPROVAL').length;
      const draftCampaigns = campaigns.filter((c) => c.status === 'DRAFT').length;
      const completedCampaigns = campaigns.filter((c) => c.status === 'COMPLETED').length;
      const pausedCampaigns = campaigns.filter((c) => c.status === 'PAUSED').length;

      const consentVerifiedPercentage =
        totalLeads > 0 ? Math.round((callableLeads / totalLeads) * 100) : 100;

      return {
        leads: {
          total: totalLeads,
          new: newLeads,
          qualified: qualifiedLeads,
          converted: convertedLeads,
          callback: callbackLeads,
          dncBlocked: dncBlockedLeads,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          pendingApproval: pendingApprovalCampaigns,
          draft: draftCampaigns,
          completed: completedCampaigns,
          paused: pausedCampaigns,
        },
        compliance: {
          consentVerifiedPercentage,
          dncBlockedTotal: dncBlockedLeads,
          callingEligibilityEnforced: true,
        },
        recentActivity: [],
      };
    }

    const [
      totalLeads,
      newLeads,
      qualifiedLeads,
      convertedLeads,
      callbackLeads,
      dncBlockedLeads,
      callableLeads,
      totalCampaigns,
      activeCampaigns,
      pendingApprovalCampaigns,
      draftCampaigns,
      completedCampaigns,
      pausedCampaigns,
      recentLogs,
    ] = await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.lead.count({ where: { tenantId, status: 'NEW' } }),
      prisma.lead.count({ where: { tenantId, status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { tenantId, status: 'CONVERTED' } }),
      prisma.lead.count({ where: { tenantId, status: 'CALLBACK' } }),
      prisma.lead.count({ where: { tenantId, isDnc: true } }),
      prisma.lead.count({ where: { tenantId, isCallable: true } }),

      prisma.campaign.count({ where: { tenantId } }),
      prisma.campaign.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.campaign.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
      prisma.campaign.count({ where: { tenantId, status: 'DRAFT' } }),
      prisma.campaign.count({ where: { tenantId, status: 'COMPLETED' } }),
      prisma.campaign.count({ where: { tenantId, status: 'PAUSED' } }),

      prisma.auditLog.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    const consentVerifiedPercentage =
      totalLeads > 0 ? Math.round((callableLeads / totalLeads) * 100) : 100;

    return {
      leads: {
        total: totalLeads,
        new: newLeads,
        qualified: qualifiedLeads,
        converted: convertedLeads,
        callback: callbackLeads,
        dncBlocked: dncBlockedLeads,
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        pendingApproval: pendingApprovalCampaigns,
        draft: draftCampaigns,
        completed: completedCampaigns,
        paused: pausedCampaigns,
      },
      compliance: {
        consentVerifiedPercentage,
        dncBlockedTotal: dncBlockedLeads,
        callingEligibilityEnforced: true,
      },
      recentActivity: recentLogs.map((log) => ({
        id: log.id,
        tenantId: log.tenantId,
        userId: log.userId,
        userEmail: log.user?.email || null,
        userFullName: log.user?.fullName || null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: (log.metadata as Record<string, unknown>) || null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
