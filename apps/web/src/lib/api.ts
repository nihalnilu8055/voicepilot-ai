import type {
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  LeadFilterQuery,
  LeadListResponse,
  CsvLeadRow,
  CsvImportPreviewResponse,
  CsvImportResultResponse,
  Campaign,
  CreateCampaignDto,
  UpdateCampaignDto,
  CampaignFilterQuery,
  CampaignListResponse,
  CampaignStatus,
  DashboardStatsResponse,
  VoiceSession,
  CreateVoiceSessionInput,
  ConversationMessage,
  EndVoiceSessionInput,
  ConversationEvaluation,
  CompanyKnowledge,
  CreateKnowledgeInput,
} from '@voicepilot/shared';

const getHeaders = (token: string, tenantId?: string) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  return headers;
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorJson = await res.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
};

export const api = {
  // --- LEADS ---
  async getLeads(tenantId: string, token: string, query?: LeadFilterQuery): Promise<LeadListResponse> {
    const params = new URLSearchParams();
    if (query?.search) params.append('search', query.search);
    if (query?.status) params.append('status', query.status);
    if (query?.isDnc !== undefined) params.append('isDnc', String(query.isDnc));
    if (query?.isCallable !== undefined) params.append('isCallable', String(query.isCallable));
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));

    const res = await fetch(`/api/tenants/${tenantId}/leads?${params.toString()}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<LeadListResponse>(res);
  },

  async getLeadById(tenantId: string, token: string, leadId: string): Promise<Lead> {
    const res = await fetch(`/api/tenants/${tenantId}/leads/${leadId}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<Lead>(res);
  },

  async createLead(tenantId: string, token: string, data: CreateLeadDto): Promise<Lead> {
    const res = await fetch(`/api/tenants/${tenantId}/leads`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<Lead>(res);
  },

  async updateLead(tenantId: string, token: string, leadId: string, data: UpdateLeadDto): Promise<Lead> {
    const res = await fetch(`/api/tenants/${tenantId}/leads/${leadId}`, {
      method: 'PUT',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<Lead>(res);
  },

  async deleteLead(tenantId: string, token: string, leadId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tenants/${tenantId}/leads/${leadId}`, {
      method: 'DELETE',
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async previewCsvImport(
    tenantId: string,
    token: string,
    rows: Partial<CsvLeadRow>[]
  ): Promise<CsvImportPreviewResponse> {
    const res = await fetch(`/api/tenants/${tenantId}/leads/import-preview`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify({ rows }),
    });
    return handleResponse<CsvImportPreviewResponse>(res);
  },

  async executeCsvImport(
    tenantId: string,
    token: string,
    rows: Partial<CsvLeadRow>[]
  ): Promise<CsvImportResultResponse> {
    const res = await fetch(`/api/tenants/${tenantId}/leads/import`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify({ rows }),
    });
    return handleResponse<CsvImportResultResponse>(res);
  },

  async importCsvLeads(
    tenantId: string,
    token: string,
    rows: Partial<CsvLeadRow>[]
  ): Promise<CsvImportResultResponse> {
    return this.executeCsvImport(tenantId, token, rows);
  },

  // --- CAMPAIGNS ---
  async getCampaigns(
    tenantId: string,
    token: string,
    query?: CampaignFilterQuery
  ): Promise<CampaignListResponse> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));

    const res = await fetch(`/api/tenants/${tenantId}/campaigns?${params.toString()}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<CampaignListResponse>(res);
  },

  async getCampaignById(tenantId: string, token: string, campaignId: string): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<Campaign>(res);
  },

  async createCampaign(
    tenantId: string,
    token: string,
    data: CreateCampaignDto
  ): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<Campaign>(res);
  },

  async updateCampaign(
    tenantId: string,
    token: string,
    campaignId: string,
    data: UpdateCampaignDto
  ): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<Campaign>(res);
  },

  async approveCampaign(
    tenantId: string,
    token: string,
    campaignId: string
  ): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}/approve`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<Campaign>(res);
  },

  async updateCampaignStatus(
    tenantId: string,
    token: string,
    campaignId: string,
    status: CampaignStatus
  ): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}/status`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify({ status }),
    });
    return handleResponse<Campaign>(res);
  },

  async attachLeadsToCampaign(
    tenantId: string,
    token: string,
    campaignId: string,
    leadIds: string[]
  ): Promise<Campaign> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}/leads`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify({ leadIds }),
    });
    return handleResponse<Campaign>(res);
  },

  async deleteCampaign(
    tenantId: string,
    token: string,
    campaignId: string
  ): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tenants/${tenantId}/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // --- DASHBOARD ---
  async getDashboardStats(tenantId: string, token: string): Promise<DashboardStatsResponse> {
    const res = await fetch(`/api/tenants/${tenantId}/dashboard/stats`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<DashboardStatsResponse>(res);
  },

  // --- VOICE STUDIO & SESSIONS ---
  async createVoiceSession(
    tenantId: string,
    token: string,
    data: CreateVoiceSessionInput
  ): Promise<VoiceSession> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<VoiceSession>(res);
  },

  async listVoiceSessions(
    tenantId: string,
    token: string
  ): Promise<{ sessions: VoiceSession[]; total: number }> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<{ sessions: VoiceSession[]; total: number }>(res);
  },

  async getVoiceSession(
    tenantId: string,
    token: string,
    sessionId: string
  ): Promise<VoiceSession> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions/${sessionId}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<VoiceSession>(res);
  },

  async sendVoiceMessage(
    tenantId: string,
    token: string,
    sessionId: string,
    data: { text: string; language?: string }
  ): Promise<{ userMessage: ConversationMessage; aiResponse: ConversationMessage }> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<{ userMessage: ConversationMessage; aiResponse: ConversationMessage }>(res);
  },

  async endVoiceSession(
    tenantId: string,
    token: string,
    sessionId: string,
    data: EndVoiceSessionInput
  ): Promise<VoiceSession> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<VoiceSession>(res);
  },

  async getVoiceSessionEvaluation(
    tenantId: string,
    token: string,
    sessionId: string
  ): Promise<ConversationEvaluation> {
    const res = await fetch(`/api/tenants/${tenantId}/voice/sessions/${sessionId}/evaluation`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<ConversationEvaluation>(res);
  },

  // --- COMPANY KNOWLEDGE ---
  async listKnowledge(
    tenantId: string,
    token: string,
    params?: { category?: string; search?: string }
  ): Promise<{ items: CompanyKnowledge[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.search) q.append('search', params.search);

    const res = await fetch(`/api/tenants/${tenantId}/knowledge?${q.toString()}`, {
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<{ items: CompanyKnowledge[]; total: number }>(res);
  },

  async createKnowledge(
    tenantId: string,
    token: string,
    data: CreateKnowledgeInput
  ): Promise<CompanyKnowledge> {
    const res = await fetch(`/api/tenants/${tenantId}/knowledge`, {
      method: 'POST',
      headers: getHeaders(token, tenantId),
      body: JSON.stringify(data),
    });
    return handleResponse<CompanyKnowledge>(res);
  },

  async deleteKnowledge(
    tenantId: string,
    token: string,
    id: string
  ): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tenants/${tenantId}/knowledge/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token, tenantId),
    });
    return handleResponse<{ success: boolean }>(res);
  },
};
