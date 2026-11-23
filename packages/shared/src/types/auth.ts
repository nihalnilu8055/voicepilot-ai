export type TenantRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER';

export interface UserSummary {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface TenantMembershipSummary {
  id: string;
  tenantId: string;
  role: TenantRole;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface AuthMeResponse {
  user: UserSummary;
  activeTenantId?: string | null;
  memberships: TenantMembershipSummary[];
}

export interface CreateTenantInput {
  name: string;
  slug?: string;
}

export interface TenantMemberDetail {
  id: string;
  userId: string;
  role: TenantRole;
  user: {
    id: string;
    email: string;
    fullName?: string | null;
  };
  createdAt: string;
}

export interface TenantDetailResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  currentUserRole: TenantRole;
  members: TenantMemberDetail[];
}

export interface AuditLogItem {
  id: string;
  tenantId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
