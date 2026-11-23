import type { AuditLogItem } from './auth.js';

export interface DashboardStatsResponse {
  leads: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
    callback: number;
    dncBlocked: number;
  };
  campaigns: {
    total: number;
    active: number;
    pendingApproval: number;
    draft: number;
    completed: number;
    paused: number;
  };
  compliance: {
    consentVerifiedPercentage: number;
    dncBlockedTotal: number;
    callingEligibilityEnforced: boolean;
  };
  recentActivity: AuditLogItem[];
}
