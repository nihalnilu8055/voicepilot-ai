import type { Lead } from './lead.js';

export type SalesObjective = 'LEAD_GENERATION' | 'DIRECT_SALES' | 'BOTH';

export type SalesPersonality = 'CONSULTATIVE';

export type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CampaignLeadItem {
  id: string;
  campaignId: string;
  leadId: string;
  tenantId: string;
  status: 'PENDING' | 'SCHEDULED' | 'EXCLUDED' | 'COMPLETED';
  isCallable: boolean;
  unfitReason: string | null;
  addedAt: string;
  lead?: Lead;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  salesObjective: SalesObjective;
  salesPersonality: SalesPersonality;
  preferredLanguage: string;
  voicePreference: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  timezone: string;
  status: CampaignStatus;
  createdById: string;
  createdByUser?: {
    id: string;
    fullName: string | null;
    email: string;
  };
  approvedById: string | null;
  approvedByUser?: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  approvedAt: string | null;
  totalLeadsCount: number;
  callableLeadsCount: number;
  dncBlockedCount: number;
  createdAt: string;
  updatedAt: string;
  campaignLeads?: CampaignLeadItem[];
}

export interface CreateCampaignDto {
  name: string;
  description?: string | null;
  salesObjective?: SalesObjective;
  salesPersonality?: SalesPersonality;
  preferredLanguage?: string;
  voicePreference?: string;
  startDate: string;
  startTime: string;
  timezone?: string;
  leadIds?: string[];
}

export interface UpdateCampaignDto {
  name?: string;
  description?: string | null;
  salesObjective?: SalesObjective;
  salesPersonality?: SalesPersonality;
  preferredLanguage?: string;
  voicePreference?: string;
  startDate?: string;
  startTime?: string;
  timezone?: string;
}

export interface CampaignFilterQuery {
  search?: string;
  status?: CampaignStatus;
  salesObjective?: SalesObjective;
  preferredLanguage?: string;
  page?: number;
  limit?: number;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CampaignStats {
  totalLeads: number;
  callableLeads: number;
  dncBlockedLeads: number;
  consentVerifiedLeads: number;
  pendingApproval: boolean;
  status: CampaignStatus;
}
