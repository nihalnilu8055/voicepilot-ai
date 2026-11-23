-- ==============================================================================
-- VoicePilot AI — Phase 4.3: AI Training Studio Database Migration
-- Target: Supabase PostgreSQL (Additive & Non-Destructive)
-- ==============================================================================

-- 1. Create Enums (Idempotent)
DO $$ BEGIN
    CREATE TYPE "DocumentType" AS ENUM ('PDF', 'DOCX', 'TXT', 'CSV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TrainingVersionStatus" AS ENUM ('DRAFT', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'ACTIVATED', 'REJECTED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ExampleScenario" AS ENUM ('PRODUCT_EXPLANATION', 'OBJECTION_HANDLING', 'PRICE_NEGOTIATION', 'QUALIFICATION', 'CALLBACK_SCHEDULING', 'GENERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter Existing Table (Non-Destructive Nullable Column)
ALTER TABLE "voice_sessions" ADD COLUMN IF NOT EXISTS "training_version_id" TEXT;

-- 3. Create Phase 4.3 Tables
CREATE TABLE IF NOT EXISTS "tenant_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" "DocumentType" NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "file_hash_sha256" VARCHAR(64) NOT NULL,
    "storage_path" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL DEFAULT 'PRODUCTS',
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "extracted_text_length" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "version_number" VARCHAR(50) NOT NULL,
    "status" "TrainingVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "changelog" TEXT,
    "rejection_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "activated_by_id" TEXT,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_version_documents" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "document_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" "DocumentType" NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "file_hash_sha256" VARCHAR(64) NOT NULL,
    "storage_path" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL DEFAULT 'PRODUCTS',
    "extracted_text" TEXT NOT NULL,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_version_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_version_chunks" (
    "id" TEXT NOT NULL,
    "version_document_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_version_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_instructions" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_identity" TEXT NOT NULL,
    "sales_objectives" TEXT NOT NULL,
    "consultative_rules" TEXT NOT NULL,
    "restricted_topics" TEXT NOT NULL,
    "approved_claims" TEXT NOT NULL,
    "pricing_policy" TEXT NOT NULL,
    "handoff_triggers" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_instructions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversation_examples" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_query" TEXT NOT NULL,
    "agent_response" TEXT NOT NULL,
    "language" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "scenario" "ExampleScenario" NOT NULL DEFAULT 'GENERAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_examples_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_evaluations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "version_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "pricing_accuracy_score" INTEGER NOT NULL DEFAULT 100,
    "spec_accuracy_score" INTEGER NOT NULL DEFAULT 100,
    "consultative_quality_score" INTEGER NOT NULL DEFAULT 100,
    "language_fluency_score" INTEGER NOT NULL DEFAULT 100,
    "overall_compliance_passed" BOOLEAN NOT NULL DEFAULT true,
    "mistakes_detected" JSONB DEFAULT '[]',
    "unapproved_pricing_flagged" BOOLEAN NOT NULL DEFAULT false,
    "recommended_improvements" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_evaluations_pkey" PRIMARY KEY ("id")
);

-- 4. Create Indexes & Composite Unique Constraints
CREATE INDEX IF NOT EXISTS "tenant_documents_tenant_id_idx" ON "tenant_documents"("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_documents_category_idx" ON "tenant_documents"("category");
CREATE INDEX IF NOT EXISTS "tenant_documents_status_idx" ON "tenant_documents"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_documents_tenant_id_file_hash_sha256_key" ON "tenant_documents"("tenant_id", "file_hash_sha256");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_documents_id_tenant_id_key" ON "tenant_documents"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "document_chunks_document_id_idx" ON "document_chunks"("document_id");
CREATE INDEX IF NOT EXISTS "document_chunks_tenant_id_idx" ON "document_chunks"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");
CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_id_tenant_id_key" ON "document_chunks"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "training_versions_tenant_id_idx" ON "training_versions"("tenant_id");
CREATE INDEX IF NOT EXISTS "training_versions_status_idx" ON "training_versions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "training_versions_tenant_id_version_number_key" ON "training_versions"("tenant_id", "version_number");
CREATE UNIQUE INDEX IF NOT EXISTS "training_versions_id_tenant_id_key" ON "training_versions"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "training_version_documents_version_id_idx" ON "training_version_documents"("version_id");
CREATE INDEX IF NOT EXISTS "training_version_documents_document_id_idx" ON "training_version_documents"("document_id");
CREATE INDEX IF NOT EXISTS "training_version_documents_tenant_id_idx" ON "training_version_documents"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_version_documents_version_id_file_hash_sha256_key" ON "training_version_documents"("version_id", "file_hash_sha256");
CREATE UNIQUE INDEX IF NOT EXISTS "training_version_documents_id_tenant_id_key" ON "training_version_documents"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "training_version_chunks_version_document_id_idx" ON "training_version_chunks"("version_document_id");
CREATE INDEX IF NOT EXISTS "training_version_chunks_version_id_idx" ON "training_version_chunks"("version_id");
CREATE INDEX IF NOT EXISTS "training_version_chunks_tenant_id_idx" ON "training_version_chunks"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_version_chunks_version_document_id_chunk_index_key" ON "training_version_chunks"("version_document_id", "chunk_index");
CREATE UNIQUE INDEX IF NOT EXISTS "training_version_chunks_id_tenant_id_key" ON "training_version_chunks"("id", "tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "training_instructions_version_id_key" ON "training_instructions"("version_id");
CREATE INDEX IF NOT EXISTS "training_instructions_version_id_idx" ON "training_instructions"("version_id");
CREATE INDEX IF NOT EXISTS "training_instructions_tenant_id_idx" ON "training_instructions"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_instructions_id_tenant_id_key" ON "training_instructions"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "conversation_examples_version_id_idx" ON "conversation_examples"("version_id");
CREATE INDEX IF NOT EXISTS "conversation_examples_tenant_id_idx" ON "conversation_examples"("tenant_id");
CREATE INDEX IF NOT EXISTS "conversation_examples_scenario_idx" ON "conversation_examples"("scenario");
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_examples_id_tenant_id_key" ON "conversation_examples"("id", "tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "training_evaluations_session_id_key" ON "training_evaluations"("session_id");
CREATE INDEX IF NOT EXISTS "training_evaluations_session_id_idx" ON "training_evaluations"("session_id");
CREATE INDEX IF NOT EXISTS "training_evaluations_version_id_idx" ON "training_evaluations"("version_id");
CREATE INDEX IF NOT EXISTS "training_evaluations_tenant_id_idx" ON "training_evaluations"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "training_evaluations_id_tenant_id_key" ON "training_evaluations"("id", "tenant_id");

CREATE INDEX IF NOT EXISTS "voice_sessions_training_version_id_idx" ON "voice_sessions"("training_version_id");

-- 5. Add Foreign Key Constraints
DO $$ BEGIN
    ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_training_version_id_fkey" 
    FOREIGN KEY ("training_version_id") REFERENCES "training_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_uploaded_by_id_fkey" 
    FOREIGN KEY ("uploaded_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" 
    FOREIGN KEY ("document_id") REFERENCES "tenant_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_versions" ADD CONSTRAINT "training_versions_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_versions" ADD CONSTRAINT "training_versions_created_by_id_fkey" 
    FOREIGN KEY ("created_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_versions" ADD CONSTRAINT "training_versions_approved_by_id_fkey" 
    FOREIGN KEY ("approved_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_versions" ADD CONSTRAINT "training_versions_activated_by_id_fkey" 
    FOREIGN KEY ("activated_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_documents" ADD CONSTRAINT "training_version_documents_version_id_fkey" 
    FOREIGN KEY ("version_id") REFERENCES "training_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_documents" ADD CONSTRAINT "training_version_documents_document_id_fkey" 
    FOREIGN KEY ("document_id") REFERENCES "tenant_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_documents" ADD CONSTRAINT "training_version_documents_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_chunks" ADD CONSTRAINT "training_version_chunks_version_document_id_fkey" 
    FOREIGN KEY ("version_document_id") REFERENCES "training_version_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_chunks" ADD CONSTRAINT "training_version_chunks_version_id_fkey" 
    FOREIGN KEY ("version_id") REFERENCES "training_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_version_chunks" ADD CONSTRAINT "training_version_chunks_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_instructions" ADD CONSTRAINT "training_instructions_version_id_fkey" 
    FOREIGN KEY ("version_id") REFERENCES "training_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_instructions" ADD CONSTRAINT "training_instructions_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "conversation_examples" ADD CONSTRAINT "conversation_examples_version_id_fkey" 
    FOREIGN KEY ("version_id") REFERENCES "training_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "conversation_examples" ADD CONSTRAINT "conversation_examples_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_evaluations" ADD CONSTRAINT "training_evaluations_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "voice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_evaluations" ADD CONSTRAINT "training_evaluations_version_id_fkey" 
    FOREIGN KEY ("version_id") REFERENCES "training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_evaluations" ADD CONSTRAINT "training_evaluations_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "training_evaluations" ADD CONSTRAINT "training_evaluations_reviewed_by_id_fkey" 
    FOREIGN KEY ("reviewed_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. Enable and Force Row Level Security (RLS) on all Phase 4.3 Tables
ALTER TABLE "tenant_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_documents" FORCE ROW LEVEL SECURITY;

ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_chunks" FORCE ROW LEVEL SECURITY;

ALTER TABLE "training_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_versions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "training_version_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_version_documents" FORCE ROW LEVEL SECURITY;

ALTER TABLE "training_version_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_version_chunks" FORCE ROW LEVEL SECURITY;

ALTER TABLE "training_instructions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_instructions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "conversation_examples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_examples" FORCE ROW LEVEL SECURITY;

ALTER TABLE "training_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_evaluations" FORCE ROW LEVEL SECURITY;

-- 7. RLS Tenant Isolation Policies (Direct Client / PostgREST Defense-in-Depth)
DO $$ BEGIN
    CREATE POLICY "tenant_documents_isolation" ON "tenant_documents"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "document_chunks_isolation" ON "document_chunks"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "training_versions_isolation" ON "training_versions"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "training_version_docs_isolation" ON "training_version_documents"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "training_version_chunks_isolation" ON "training_version_chunks"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "training_instructions_isolation" ON "training_instructions"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "conversation_examples_isolation" ON "conversation_examples"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "training_evaluations_isolation" ON "training_evaluations"
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN null; END $$;
