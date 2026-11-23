# VoicePilot AI — Phase 4.3: Database Migration Plan (Reviewed & Enhanced)

**Document Version:** 1.1.0  
**Target Database:** Supabase PostgreSQL (`db.xkjpytyocqofplkalduu.supabase.co`)  
**ORM:** Prisma v6  
**Status:** Migration Specification (Reviewed & Hardened)

---

## 1. Safety & Compatibility Guarantees

1. **Zero Data Loss**: Existing data in Phase 1, Phase 2, Phase 3, and Phase 4.1/4.2 tables will remain completely untouched.
2. **Backward Compatibility & Type Parity**: All additions are purely additive. All primary and foreign keys use `TEXT` (UUID string), matching existing `tenants(id)`, `user_profiles(id)`, and `voice_sessions(id)`.
3. **Tenant Scoping**: Every new table includes a mandatory `tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`.
4. **Row-Level Security (RLS)**: Enabled with `FORCE ROW LEVEL SECURITY` on every new table for client/PostgREST queries.
5. **Prisma Connection Role Clarification**: The Prisma database user (`postgres`) holds `SUPERUSER` / `BYPASSRLS` privileges and bypasses RLS. Tenant isolation for all backend queries is strictly enforced by application-layer filtering (`where: { tenantId }`) in every Prisma call.
6. **Private Storage**: Supabase Storage bucket `company-training-documents` configured as private (`public = false`) with access restricted by tenant authorization and 5-minute pre-signed URLs.

---

## 2. New Enums

```sql
-- 1. Supported Document Types
DO $$ BEGIN
    CREATE TYPE "DocumentType" AS ENUM ('PDF', 'DOCX', 'TXT', 'CSV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Document Extraction & Processing Status
DO $$ BEGIN
    CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Training Version Workflow Lifecycle
DO $$ BEGIN
    CREATE TYPE "TrainingVersionStatus" AS ENUM (
        'DRAFT',
        'SUBMITTED_FOR_APPROVAL',
        'APPROVED',
        'ACTIVATED',
        'REJECTED',
        'ARCHIVED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Conversation Example Scenarios
DO $$ BEGIN
    CREATE TYPE "ExampleScenario" AS ENUM (
        'PRODUCT_EXPLANATION',
        'OBJECTION_HANDLING',
        'PRICE_NEGOTIATION',
        'QUALIFICATION',
        'CALLBACK_SCHEDULING',
        'GENERAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

---

## 3. New Table Specifications

### Table 1: `tenant_documents`
Stores metadata for uploaded company files (PDF, DOCX, TXT, CSV).

```sql
CREATE TABLE IF NOT EXISTS public.tenant_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type "DocumentType" NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    category "KnowledgeCategory" NOT NULL DEFAULT 'PRODUCTS',
    status "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    extracted_text_length INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    error_message TEXT,
    uploaded_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_file_hash UNIQUE (tenant_id, file_hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_tenant_documents_tenant ON public.tenant_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_category ON public.tenant_documents(category);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_status ON public.tenant_documents(status);
```

### Table 2: `document_chunks`
Stores parsed passages extracted from uploaded documents for precision grounding.

```sql
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    document_id TEXT NOT NULL REFERENCES public.tenant_documents(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant ON public.document_chunks(tenant_id);
```

### Table 3: `training_versions`
Manages the auditable versioning lifecycle (DRAFT → SUBMITTED → APPROVED → ACTIVATED).

```sql
CREATE TABLE IF NOT EXISTS public.training_versions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL,
    status "TrainingVersionStatus" NOT NULL DEFAULT 'DRAFT',
    changelog TEXT,
    rejection_reason TEXT,
    created_by_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    approved_by_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    activated_by_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_version_number UNIQUE (tenant_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_training_versions_tenant ON public.training_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_versions_status ON public.training_versions(status);
```

### Table 4: `training_version_documents` (Immutable Version Document Snapshot)
Guarantees that an approved version is permanently frozen to the exact documents, revisions, extracted text, and content hashes approved at that time.

```sql
CREATE TABLE IF NOT EXISTS public.training_version_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_id TEXT NOT NULL REFERENCES public.training_versions(id) ON DELETE RESTRICT,
    document_id TEXT REFERENCES public.tenant_documents(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type "DocumentType" NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash_sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    category "KnowledgeCategory" NOT NULL DEFAULT 'PRODUCTS',
    extracted_text TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_version_document_hash UNIQUE (version_id, file_hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_training_version_docs_version ON public.training_version_documents(version_id);
CREATE INDEX IF NOT EXISTS idx_training_version_docs_doc ON public.training_version_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_training_version_docs_tenant ON public.training_version_documents(tenant_id);
```

### Table 5: `training_version_chunks` (Immutable Grounding Passages Snapshot)
Stores the exact chunk passages and token distributions linked to the approved version document. Eliminates runtime dependencies on the mutable active document library.

```sql
CREATE TABLE IF NOT EXISTS public.training_version_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_document_id TEXT NOT NULL REFERENCES public.training_version_documents(id) ON DELETE CASCADE,
    version_id TEXT NOT NULL REFERENCES public.training_versions(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_version_doc_chunk UNIQUE (version_document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_training_version_chunks_doc ON public.training_version_chunks(version_document_id);
CREATE INDEX IF NOT EXISTS idx_training_version_chunks_version ON public.training_version_chunks(version_id);
CREATE INDEX IF NOT EXISTS idx_training_version_chunks_tenant ON public.training_version_chunks(tenant_id);
```

### Table 6: `training_instructions`
Contains behavioral guidelines, company identity, rules, and guardrails linked to a training version.

```sql
CREATE TABLE IF NOT EXISTS public.training_instructions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_id TEXT NOT NULL REFERENCES public.training_versions(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_identity TEXT NOT NULL,
    sales_objectives TEXT NOT NULL,
    consultative_rules TEXT NOT NULL,
    restricted_topics TEXT NOT NULL,
    approved_claims TEXT NOT NULL,
    pricing_policy TEXT NOT NULL,
    handoff_triggers TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_version_instructions UNIQUE (version_id)
);

CREATE INDEX IF NOT EXISTS idx_training_instructions_version ON public.training_instructions(version_id);
CREATE INDEX IF NOT EXISTS idx_training_instructions_tenant ON public.training_instructions(tenant_id);
```

### Table 7: `conversation_examples`
Curated few-shot dialogue pairs in Malayalam, Indian English, and Manglish.

```sql
CREATE TABLE IF NOT EXISTS public.conversation_examples (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_id TEXT NOT NULL REFERENCES public.training_versions(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_query TEXT NOT NULL,
    agent_response TEXT NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    scenario "ExampleScenario" NOT NULL DEFAULT 'GENERAL',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_conversation_examples_version ON public.conversation_examples(version_id);
CREATE INDEX IF NOT EXISTS idx_conversation_examples_tenant ON public.conversation_examples(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_examples_scenario ON public.conversation_examples(scenario);
```

### Table 8: `training_evaluations`
Grounded call audit records assessing truthfulness, pricing accuracy, and language quality.

```sql
CREATE TABLE IF NOT EXISTS public.training_evaluations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    version_id TEXT REFERENCES public.training_versions(id) ON DELETE SET NULL,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pricing_accuracy_score INTEGER NOT NULL DEFAULT 100,
    spec_accuracy_score INTEGER NOT NULL DEFAULT 100,
    consultative_quality_score INTEGER NOT NULL DEFAULT 100,
    language_fluency_score INTEGER NOT NULL DEFAULT 100,
    overall_compliance_passed BOOLEAN NOT NULL DEFAULT true,
    mistakes_detected JSONB DEFAULT '[]'::jsonb,
    unapproved_pricing_flagged BOOLEAN NOT NULL DEFAULT false,
    recommended_improvements TEXT,
    reviewed_by_id TEXT REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_training_evaluation UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_training_evaluations_session ON public.training_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_training_evaluations_version ON public.training_evaluations(version_id);
CREATE INDEX IF NOT EXISTS idx_training_evaluations_tenant ON public.training_evaluations(tenant_id);
```

---

## 4. Alterations to Existing Tables

Link `voice_sessions` permanently to the training version used during call initiation. Uses `ON DELETE RESTRICT` to guarantee historical training versions can never be deleted while referenced by historical call sessions:

```sql
DO $$ BEGIN
    ALTER TABLE public.voice_sessions
    ADD COLUMN training_version_id TEXT REFERENCES public.training_versions(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_voice_sessions_training_version ON public.voice_sessions(training_version_id);
```

---

## 5. Row-Level Security (RLS) & Connection Privileges

> [!WARNING]
> **PostgreSQL Superuser & BYPASSRLS Clarification**:
> In PostgreSQL, roles with `SUPERUSER` or `BYPASSRLS` privileges (including the default Supabase `postgres` user used by Prisma) **always bypass RLS policies**, regardless of `FORCE ROW LEVEL SECURITY`.
> `FORCE ROW LEVEL SECURITY` ensures policies apply to non-superuser table owners.
> Therefore, these RLS policies serve as a database defense-in-depth layer for PostgREST and client-side access, while **application-layer tenant filtering (`where: { tenantId }`) is mandatory on every Prisma query**.

```sql
-- Enable and FORCE RLS on all Phase 4.3 tables
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_version_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_version_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_version_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_version_chunks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_instructions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.conversation_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_examples FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_evaluations FORCE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY tenant_documents_isolation ON public.tenant_documents
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY document_chunks_isolation ON public.document_chunks
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY training_versions_isolation ON public.training_versions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY training_version_docs_isolation ON public.training_version_documents
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY training_version_chunks_isolation ON public.training_version_chunks
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY training_instructions_isolation ON public.training_instructions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY conversation_examples_isolation ON public.conversation_examples
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY training_evaluations_isolation ON public.training_evaluations
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()::text
        )
    );
```

---

## 6. Safe Rollback Script

```sql
ALTER TABLE public.voice_sessions DROP COLUMN IF EXISTS training_version_id;
DROP TABLE IF EXISTS public.training_evaluations CASCADE;
DROP TABLE IF EXISTS public.conversation_examples CASCADE;
DROP TABLE IF EXISTS public.training_instructions CASCADE;
DROP TABLE IF EXISTS public.training_version_chunks CASCADE;
DROP TABLE IF EXISTS public.training_version_documents CASCADE;
DROP TABLE IF EXISTS public.training_versions CASCADE;
DROP TABLE IF EXISTS public.document_chunks CASCADE;
DROP TABLE IF EXISTS public.tenant_documents CASCADE;
DROP TYPE IF EXISTS "ExampleScenario";
DROP TYPE IF EXISTS "TrainingVersionStatus";
DROP TYPE IF EXISTS "DocumentStatus";
DROP TYPE IF EXISTS "DocumentType";
```
