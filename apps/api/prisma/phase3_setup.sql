-- ==============================================================================
-- VoicePilot AI - Phase 3: Lead & Campaign Management Migration Script
-- Target: Supabase PostgreSQL (Production-Safe & Idempotent)
-- ==============================================================================

-- 1. Create Enums if they do not already exist
DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NOT_INTERESTED', 'CALLBACK', 'CONVERTED', 'LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentStatus" AS ENUM ('CONSENT_GRANTED', 'CONSENT_REVOKED', 'PENDING_VERIFICATION', 'LAWFUL_BASIS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'INBOUND', 'COLD_OUTREACH', 'REFERRAL', 'EVENT', 'PAID_ADS', 'CSV_IMPORT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesObjective" AS ENUM ('LEAD_GENERATION', 'DIRECT_SALES', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesPersonality" AS ENUM ('CONSULTATIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAUSED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignLeadStatus" AS ENUM ('PENDING', 'SCHEDULED', 'EXCLUDED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create 'leads' table
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  company_name TEXT,
  country TEXT NOT NULL DEFAULT 'IN',
  language_preference TEXT NOT NULL DEFAULT 'en-IN',
  lead_source "LeadSource" NOT NULL DEFAULT 'OTHER',
  status "LeadStatus" NOT NULL DEFAULT 'NEW',
  notes TEXT,
  assigned_agent_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  consent_status "ConsentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  consent_source TEXT,
  consent_date TIMESTAMPTZ,
  is_dnc BOOLEAN NOT NULL DEFAULT false,
  dnc_reason TEXT,
  dnc_updated_at TIMESTAMPTZ,
  is_callable BOOLEAN NOT NULL DEFAULT false,
  created_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tenant_phone_unique UNIQUE (tenant_id, phone_number)
);

-- 3. Create 'campaigns' table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sales_objective "SalesObjective" NOT NULL DEFAULT 'LEAD_GENERATION',
  sales_personality "SalesPersonality" NOT NULL DEFAULT 'CONSULTATIVE',
  preferred_language TEXT NOT NULL DEFAULT 'en-IN',
  voice_preference TEXT NOT NULL DEFAULT 'Priya (Warm)',
  start_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  created_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create 'campaign_leads' junction table
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status "CampaignLeadStatus" NOT NULL DEFAULT 'PENDING',
  is_callable BOOLEAN NOT NULL DEFAULT false,
  unfit_reason TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT campaign_lead_unique UNIQUE (campaign_id, lead_id)
);

-- 5. Indexes for Query Performance & Multi-Tenant Partitioning
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_dnc ON public.leads(is_dnc);
CREATE INDEX IF NOT EXISTS idx_leads_callable ON public.leads(is_callable);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_tenant ON public.campaign_leads(tenant_id);

-- 6. Enable Row Level Security (RLS) on all Phase 3 Tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Leads Table
DROP POLICY IF EXISTS "Tenant members can view own company leads" ON public.leads;
CREATE POLICY "Tenant members can view own company leads"
  ON public.leads FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can insert leads for own company" ON public.leads;
CREATE POLICY "Tenant members can insert leads for own company"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own company leads" ON public.leads;
CREATE POLICY "Tenant members can update own company leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can delete own company leads" ON public.leads;
CREATE POLICY "Tenant members can delete own company leads"
  ON public.leads FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

-- 8. RLS Policies: Campaigns Table
DROP POLICY IF EXISTS "Tenant members can view own company campaigns" ON public.campaigns;
CREATE POLICY "Tenant members can view own company campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can insert campaigns for own company" ON public.campaigns;
CREATE POLICY "Tenant members can insert campaigns for own company"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can update own company campaigns" ON public.campaigns;
CREATE POLICY "Tenant members can update own company campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can delete own company campaigns" ON public.campaigns;
CREATE POLICY "Tenant members can delete own company campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

-- 9. RLS Policies: Campaign Leads Table
DROP POLICY IF EXISTS "Tenant members can view own company campaign leads" ON public.campaign_leads;
CREATE POLICY "Tenant members can view own company campaign leads"
  ON public.campaign_leads FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Tenant members can modify own company campaign leads" ON public.campaign_leads;
CREATE POLICY "Tenant members can modify own company campaign leads"
  ON public.campaign_leads FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships
      WHERE user_id = auth.uid()::text
    )
  );

-- 10. Grant Permissions
GRANT ALL ON public.leads TO authenticated, service_role;
GRANT ALL ON public.campaigns TO authenticated, service_role;
GRANT ALL ON public.campaign_leads TO authenticated, service_role;

GRANT SELECT ON public.leads TO anon;
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT ON public.campaign_leads TO anon;

-- Verification query
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('leads', 'campaigns', 'campaign_leads');
