-- ============================================================================
-- VoicePilot AI — Phase 4: AI Voice Engine Database Migration
-- Target: Supabase PostgreSQL (xkjpytyocqofplkalduu.supabase.co)
-- Strictly preserves all Phase 1, Phase 2, and Phase 3 tables and data.
-- ============================================================================

-- 1. Create Knowledge Category Enum if not exists
DO $$ BEGIN
    CREATE TYPE "KnowledgeCategory" AS ENUM ('PRODUCTS', 'PRICING', 'POLICIES', 'FAQ', 'GENERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Voice Session Status Enum if not exists
DO $$ BEGIN
    CREATE TYPE "VoiceSessionStatus" AS ENUM ('INITIALIZING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Voice Gender Enum if not exists
DO $$ BEGIN
    CREATE TYPE "VoiceGender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Create Conversation Sender Enum if not exists
DO $$ BEGIN
    CREATE TYPE "ConversationSender" AS ENUM ('USER', 'AI', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create Qualification Outcome Enum if not exists
DO $$ BEGIN
    CREATE TYPE "QualificationOutcome" AS ENUM ('QUALIFIED', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'NEEDS_FOLLOW_UP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE 1: company_knowledge
-- Approved company products, pricing, specs, and FAQs for grounded AI sales
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company_knowledge (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category "KnowledgeCategory" NOT NULL DEFAULT 'PRODUCTS',
    content TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_knowledge_tenant ON public.company_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_category ON public.company_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_approved ON public.company_knowledge(is_approved);

-- ============================================================================
-- TABLE 2: voice_configs
-- Configurable voice parameters per company and/or campaign
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.voice_configs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE SET NULL,
    default_language VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    supported_languages TEXT[] NOT NULL DEFAULT '{"en-IN", "ml-IN"}',
    voice_gender "VoiceGender" NOT NULL DEFAULT 'FEMALE',
    voice_name VARCHAR(100) NOT NULL DEFAULT 'Priya (Warm)',
    personality "SalesPersonality" NOT NULL DEFAULT 'CONSULTATIVE',
    pitch DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    speaking_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    system_prompt_override TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_voice_configs_tenant ON public.voice_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_configs_campaign ON public.voice_configs(campaign_id);

-- ============================================================================
-- TABLE 3: voice_sessions
-- Live voice call and simulation session records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.voice_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE SET NULL,
    lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
    initiated_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    language VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    voice_name VARCHAR(100) NOT NULL DEFAULT 'Priya (Warm)',
    status "VoiceSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    qualification_outcome "QualificationOutcome",
    callback_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_tenant ON public.voice_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_campaign ON public.voice_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_lead ON public.voice_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON public.voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started_at ON public.voice_sessions(started_at);

-- ============================================================================
-- TABLE 4: conversation_messages
-- Full turn-by-turn transcripts of voice sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender "ConversationSender" NOT NULL,
    text TEXT NOT NULL,
    language VARCHAR(20),
    audio_url TEXT,
    confidence DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON public.conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_tenant ON public.conversation_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON public.conversation_messages(timestamp);

-- ============================================================================
-- TABLE 5: conversation_evaluations
-- Automated AI evaluations, lead qualification scoring, objections, next steps
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_evaluations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT UNIQUE NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
    lead_score INTEGER NOT NULL DEFAULT 0,
    sentiment VARCHAR(50) NOT NULL DEFAULT 'NEUTRAL',
    objections_raised JSONB DEFAULT '[]'::jsonb,
    customer_interest VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    qualification_summary TEXT NOT NULL,
    suggested_next_step TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_conversation_evaluations_session ON public.conversation_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_evaluations_tenant ON public.conversation_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_evaluations_lead ON public.conversation_evaluations(lead_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strictly enforce tenant isolation across all new Phase 4 tables
-- ============================================================================

ALTER TABLE public.company_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_evaluations ENABLE ROW LEVEL SECURITY;

-- company_knowledge RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant members can view knowledge" ON public.company_knowledge;
    DROP POLICY IF EXISTS "Tenant members can manage knowledge" ON public.company_knowledge;
END $$;

CREATE POLICY "Tenant members can view knowledge"
ON public.company_knowledge FOR SELECT
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

CREATE POLICY "Tenant members can manage knowledge"
ON public.company_knowledge FOR ALL
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

-- voice_configs RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant members can view voice configs" ON public.voice_configs;
    DROP POLICY IF EXISTS "Tenant members can manage voice configs" ON public.voice_configs;
END $$;

CREATE POLICY "Tenant members can view voice configs"
ON public.voice_configs FOR SELECT
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

CREATE POLICY "Tenant members can manage voice configs"
ON public.voice_configs FOR ALL
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

-- voice_sessions RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant members can view voice sessions" ON public.voice_sessions;
    DROP POLICY IF EXISTS "Tenant members can manage voice sessions" ON public.voice_sessions;
END $$;

CREATE POLICY "Tenant members can view voice sessions"
ON public.voice_sessions FOR SELECT
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

CREATE POLICY "Tenant members can manage voice sessions"
ON public.voice_sessions FOR ALL
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

-- conversation_messages RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant members can view messages" ON public.conversation_messages;
    DROP POLICY IF EXISTS "Tenant members can manage messages" ON public.conversation_messages;
END $$;

CREATE POLICY "Tenant members can view messages"
ON public.conversation_messages FOR SELECT
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

CREATE POLICY "Tenant members can manage messages"
ON public.conversation_messages FOR ALL
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

-- conversation_evaluations RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant members can view evaluations" ON public.conversation_evaluations;
    DROP POLICY IF EXISTS "Tenant members can manage evaluations" ON public.conversation_evaluations;
END $$;

CREATE POLICY "Tenant members can view evaluations"
ON public.conversation_evaluations FOR SELECT
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

CREATE POLICY "Tenant members can manage evaluations"
ON public.conversation_evaluations FOR ALL
USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text
));

-- Grant permissions to authenticated service roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_evaluations TO authenticated;
