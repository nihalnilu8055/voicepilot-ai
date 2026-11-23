-- ==============================================================================
-- VoicePilot AI - Supabase PostgreSQL Initial Migration & RLS Setup
-- Safe, Idempotent Setup Script for Supabase Dashboard SQL Editor
-- Target Project: https://xkjpytyocqofplkalduu.supabase.co
-- ==============================================================================

-- 0. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Enums & Tables
DO $$ BEGIN
    CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY, -- References auth.users.id
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name "TenantRole" UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance & Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON public.tenants(created_by_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON public.tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON public.tenant_memberships(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 3. Seed Default Roles (Idempotent)
INSERT INTO public.roles (id, name, description) VALUES
('role_owner', 'OWNER', 'Company Owner - Full administrative authority, billing, and membership control'),
('role_admin', 'ADMIN', 'Company Administrator - Operational control, team management, and settings'),
('role_agent', 'AGENT', 'Sales Calling Agent - Campaign execution, outbound dialing, lead management'),
('role_viewer', 'VIEWER', 'Read-Only Viewer - Analytics, dashboard review, call history audits')
ON CONFLICT (name) DO NOTHING;

-- 4. Supabase Auth Automatic User Profile Sync
-- When a user registers via Supabase Auth (auth.users), automatically insert into public.user_profiles
-- SECURITY NOTE: Explicit search_path prevents search_path hijacking on SECURITY DEFINER execution
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
        new.id::text,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
        updated_at = now();
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================
-- IMPORTANT ARCHITECTURAL NOTE:
-- PostgreSQL RLS policies apply when querying through Supabase PostgREST / Supabase Client
-- with user JWTs (role = 'authenticated').
-- When Prisma connects with a superuser (role = 'postgres'), PostgreSQL BYPASSES RLS.
-- Therefore, VoicePilot AI enforces strict application-level multi-tenant isolation
-- in Fastify service controllers and repository queries as the primary defense,
-- while PostgreSQL RLS provides defense-in-depth for direct client queries.
-- ==============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User Profile Policies: Users can view their own profile or profiles of members sharing a tenant
DROP POLICY IF EXISTS "Users can read relevant user profiles" ON public.user_profiles;
CREATE POLICY "Users can read relevant user profiles" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()::text
        OR id IN (
            SELECT tm2.user_id
            FROM public.tenant_memberships tm1
            JOIN public.tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
            WHERE tm1.user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid()::text);

-- Role Policies: Read-only for authenticated users
DROP POLICY IF EXISTS "Roles are readable by authenticated users" ON public.roles;
CREATE POLICY "Roles are readable by authenticated users" ON public.roles
    FOR SELECT TO authenticated
    USING (true);

-- Tenant Policies: Users can only see and access tenants they are members of
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON public.tenants;
CREATE POLICY "Users can view tenants they belong to" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Users can create new tenants" ON public.tenants;
CREATE POLICY "Users can create new tenants" ON public.tenants
    FOR INSERT TO authenticated
    WITH CHECK (created_by_id = auth.uid()::text);

DROP POLICY IF EXISTS "Owners and Admins can update tenant" ON public.tenants;
CREATE POLICY "Owners and Admins can update tenant" ON public.tenants
    FOR UPDATE TO authenticated
    USING (
        id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            JOIN public.roles r ON tm.role_id = r.id
            WHERE tm.user_id = auth.uid()::text
            AND r.name IN ('OWNER', 'ADMIN')
        )
    );

-- Tenant Membership Policies: Users can view memberships in their tenants
DROP POLICY IF EXISTS "Users can view memberships for their tenants" ON public.tenant_memberships;
CREATE POLICY "Users can view memberships for their tenants" ON public.tenant_memberships
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Owners and Admins can manage memberships" ON public.tenant_memberships;
CREATE POLICY "Owners and Admins can manage memberships" ON public.tenant_memberships
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            JOIN public.roles r ON tm.role_id = r.id
            WHERE tm.user_id = auth.uid()::text
            AND r.name IN ('OWNER', 'ADMIN')
        )
    );

-- Audit Log Policies: Only accessible within the tenant by Owners/Admins
DROP POLICY IF EXISTS "Owners and Admins can view tenant audit logs" ON public.audit_logs;
CREATE POLICY "Owners and Admins can view tenant audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            JOIN public.roles r ON tm.role_id = r.id
            WHERE tm.user_id = auth.uid()::text
            AND r.name IN ('OWNER', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid()::text
        )
    );

-- 6. Schema Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.roles TO anon;
