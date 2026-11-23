# VoicePilot AI — Phase 4.3 Prisma Feasibility & Architectural Hardening Report

**Document Date:** November 23, 2026  
**Auditor / Reviewer:** Principal Software Architect & Principal Database Security Engineer  
**Project Path:** `D:\FREELANCE\VoicePilot AI`  
**Installed Prisma Version:** `6.19.3` (`@prisma/client` and `prisma`)  
**Target Environment:** Supabase PostgreSQL (`postgres` superuser/BYPASSRLS connection role)  
**Status:** **FEASIBILITY ANALYSIS COMPLETE & ARCHITECTURAL ALTERNATIVE SPECIFIED**  

---

## 1. Executive Summary

This report evaluates the technical feasibility of the proposed Phase 4.3 security controls against the installed Prisma `6.19.3` engine and the Supabase PostgreSQL environment. Specifically, it reviews:
1. **Prisma Client Extension Limitations**: Why relying solely on `prisma.$extends` query hooks cannot guarantee 100% multi-tenant isolation across complex operations (nested writes, unique lookups, and aggregates).
2. **Production-Grade Alternative Tenant Security Design**: A hybrid model combining database structural constraints (composite unique and foreign keys), explicit tenant repositories, and role-based isolation.
3. **Immutable Binary File Storage**: Upgrading the snapshot model to preserve the original binary files alongside extracted text, using content-addressed storage and SHA-256 verification.
4. **Streaming Download Safety**: A complete engineering specification for the Fastify streaming proxy with backpressure, byte counting, abort signals, and concurrency semaphores.
5. **Comprehensive Verification Test Matrix**: Concrete executable tests covering data isolation, nested relations, transactions, binary verification, and streaming safety.

---

## 2. Prisma Client Extension (`$extends`) Limitations Analysis

An in-depth technical audit of Prisma `6.19.3` reveals that relying solely on client query extensions (`prisma.$extends({ query: { $allModels: { ... } } })`) to enforce tenant isolation has severe architectural limitations:

### 2.1. `findUnique` and `findUniqueOrThrow` Capabilities vs. Extension Pitfalls
- **Verified Fact (Prisma 6.19.3 Capability)**: 
  Prisma 5.0+ and 6.19.3 natively support `extendedWhereUnique`. Inspection of `@prisma/client` types confirms that `WhereUniqueInput` definitions (such as `LeadWhereUniqueInput`, `CampaignWhereUniqueInput`) are defined as `Prisma.AtLeast<{ id?: string, ... }> & { tenantId?: string, ... }`.
  Therefore, passing non-unique filtering fields alongside a unique key is **100% natively supported**:
  ```typescript
  // Fully valid and type-safe in Prisma 6.19.3:
  await prisma.lead.findUnique({ where: { id, tenantId } });
  await prisma.lead.update({ where: { id, tenantId }, data: { ... } });
  await prisma.lead.delete({ where: { id, tenantId } });
  ```
- **Extension Limitation**: 
  While `findUnique({ where: { id, tenantId } })` is natively supported when called directly in repositories, an automatic query extension (`$allModels.findUnique`) that unconditionally injects `args.where = { ...args.where, tenantId }` fails if the incoming query did not supply at least one unique field or if called with non-standard unique compound inputs.
  Furthermore, query extensions cannot automatically rewrite `findUnique` to `findFirst` without breaking Prisma return types, DataLoader batching, and fluent chaining.

### 2.2. Nested Reads and Relation Includes (`include` and `select`)
- **The Issue**: In Prisma `6.19.3`, query extension hooks (`$allModels`, `$allOperations`) intercept only the **top-level model operation**.
- **Extension Failure**: If a query executes:
  ```typescript
  prisma.userProfile.findFirst({
    where: { id: userId },
    include: { assignedLeads: true }
  });
  ```
  The extension intercepts `UserProfile.findFirst`, but the nested relation `assignedLeads` does **NOT** trigger a separate `Lead.findMany` extension hook. Prisma compiles the include into a single joined SQL query or batched lookup based solely on the foreign key relation. If a user is associated with multiple tenants, unscoped nested includes can return records from other tenants unless an explicit `where: { tenantId }` is nested in the `include`.

### 2.3. Nested Writes (`create`, `connect`, `connectOrCreate`, `update`)
- **The Issue**: When executing nested mutations:
  ```typescript
  prisma.campaign.create({
    data: {
      name: "Q4 Campaign",
      tenantId: tenantAId,
      campaignLeads: {
        create: { leadId: foreignTenantLeadId } // Nested write!
      }
    }
  });
  ```
  The top-level `create` hook only receives `args.data` for `Campaign`. It does not automatically traverse or patch deep, arbitrary nested relation trees (`campaignLeads.create`, `connect: { id }`).
- **Data Integrity Risk**: A malicious or buggy caller could use `connect: { id: companyBLeadId }` to link a record across tenant boundaries if foreign keys only validate the entity ID without verifying the `tenant_id`.
      name: "Q4 Campaign",
      tenantId: tenantAId,
      campaignLeads: {
        create: { leadId: foreignTenantLeadId } // Nested write!
      }
    }
  });
  ```
  The top-level `create` hook only receives `args.data` for `Campaign`. It does not automatically traverse or patch deep, arbitrary nested relation trees (`campaignLeads.create`, `connect: { id }`).
- **Data Integrity Risk**: A malicious or buggy caller could use `connect: { id: companyBLeadId }` to link a record across tenant boundaries if foreign keys only validate the entity ID without verifying the `tenant_id`.

### 2.4. `update` and `delete` Operations
- **The Issue**: Prisma's `update` and `delete` methods require a unique identifier in `where` (e.g. `{ where: { id } }`). They do not allow non-unique fields like `tenantId` in `where` unless a composite unique key exists: `@@unique([id, tenantId])`.
- **Alternative `updateMany` Limitation**: Falling back to `updateMany` removes access to nested relation operations and does not return the updated record.

### 2.5. Transactions and Raw SQL
- **Batch Transactions**: `prisma.$transaction([ ... ])` passing unextended client promises bypasses per-request extensions.
- **Raw SQL**: `$queryRaw` and `$executeRaw` completely bypass Prisma Client Extensions.

---

## 3. Alternative Production-Grade Tenant Security Design

Because Prisma Client Extensions alone cannot guarantee isolation across nested operations, VoicePilot AI adopts a **Multi-Layered Defense Architecture**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: DATABASE STRUCTURAL CONSTRAINTS                        │
│  • Composite Unique Constraints: @@unique([id, tenantId]) on every tenant table       │
│  • Composite Foreign Keys: REFERENCES parent(id, tenant_id)                            │
│  • Physically impossible for child in Tenant A to reference parent in Tenant B!       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Enforced by PostgreSQL Engine
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                        LAYER 2: TENANT-SCOPED REPOSITORIES                             │
│  • Explicit Tenant Repositories (TrainingRepository, DocumentRepository)              │
│  • Instantiated per-request: new TrainingRepository(req.tenantId, req.db)             │
│  • No caller passes tenantId; it is baked into every query and mutation                │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Enforced by TypeScript Architecture
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                        LAYER 3: FASTIFY AUTHORIZATION MIDDLEWARE                       │
│  • authenticate: Verifies Supabase Auth JWT signature                                  │
│  • requireTenantAccess: Resolves tenant_memberships and enforces RBAC                   │
│  • Binds req.tenantId and instantiates tenant services                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Layer 1: Database Structural Constraints (Engine-Level Guarantees)
1. **Composite Unique Keys**:
   Every tenant-owned table defines:
   ```prisma
   @@unique([id, tenantId], name: "tenant_entity_unique")
   ```
   **Benefit**: Allows Prisma to execute native `findUnique`, `update`, and `delete` using the composite key:
   ```typescript
   prisma.trainingVersion.findUnique({
     where: { tenant_entity_unique: { id, tenantId } }
   });
   prisma.trainingVersion.update({
     where: { tenant_entity_unique: { id, tenantId } },
     data: { ... }
   });
   ```
2. **Composite Foreign Keys**:
   Child tables reference both the parent ID and the parent `tenant_id`:
   ```sql
   CONSTRAINT fk_training_version_tenant 
   FOREIGN KEY (version_id, tenant_id) 
   REFERENCES public.training_versions(id, tenant_id) 
   ON DELETE RESTRICT
   ```
   **Benefit**: The database engine physically rejects any attempt to insert a child record pointing to a parent in a different tenant, eliminating nested `connect` cross-tenant vulnerabilities.

### 3.2. Layer 2: Tenant-Scoped Repositories (Application-Level Guarantees)
Instead of relying on global AST interceptors, every domain module implements a dedicated tenant repository:
```typescript
export class TrainingRepository {
  constructor(
    private readonly tenantId: string,
    private readonly db: PrismaClient | Prisma.TransactionClient
  ) {}

  async getVersion(id: string) {
    return this.db.trainingVersion.findUnique({
      where: { tenant_entity_unique: { id, tenantId: this.tenantId } },
      include: {
        documents: { where: { tenantId: this.tenantId } },
        instructions: true,
        examples: { where: { tenantId: this.tenantId } }
      }
    });
  }

  async createDraft(versionNumber: string, createdById: string) {
    return this.db.trainingVersion.create({
      data: {
        tenantId: this.tenantId,
        versionNumber,
        createdById,
        status: 'DRAFT'
      }
    });
  }
}
```

### 3.3. Distinct Tiers of Tenant Security & Isolation

It is vital to distinguish between three completely different tiers of security:

1. **Tier 1: Database-Enforced Relationship Integrity (Foreign Keys)**:
   - **Mechanism**: Composite foreign keys `FOREIGN KEY (version_id, tenant_id) REFERENCES training_versions(id, tenant_id)`.
   - **What it Guarantees**: Guarantees that a record in Tenant A can NEVER reference or attach itself to a parent entity in Tenant B. The database engine rejects cross-tenant relations at the schema level.
   - **What it Does NOT Do**: Does NOT prevent cross-tenant reads (`SELECT * FROM training_versions WHERE id = 'b'`), and does NOT prevent unscoped updates/deletes if application code omits `tenantId`.

2. **Tier 2: Application-Level Repository Filtering (Tenant Repositories)**:
   - **Mechanism**: Dedicated repositories (`TrainingRepository`, `DocumentRepository`) encapsulating `this.tenantId` into every query, nested include, and mutation.
   - **What it Guarantees**: Guarantees that every query authored by the application is scoped by `tenantId`.
   - **What it Does NOT Do**: It is an application-level convention. If a rogue query or bug executes without `tenantId` over the superuser `postgres` connection, the database engine executes it without obstruction.

3. **Tier 3: Database-Enforced Row Isolation (RLS with Runtime Role & Session Context)**:
   - **Mechanism (Proposed Road)**:
     - Connecting via a dedicated non-superuser, non-BYPASSRLS PostgreSQL role (e.g. `app_user`).
     - Within an explicit interactive transaction, executing:
       ```sql
       SET LOCAL app.current_tenant_id = 'tenant_uuid_here';
       ```
     - RLS policies enforce `USING (tenant_id = current_setting('app.current_tenant_id', true))`.
   - **Critical Connection-Pooling Invariant (`SET LOCAL` vs `SET`)**:
     `SET LOCAL` scopes the variable strictly to the current database transaction. When the transaction commits or aborts, PostgreSQL automatically resets the setting. If `SET` (without `LOCAL`) were executed on a connection pool (such as Supavisor/PgBouncer), that tenant context would leak to the next random request borrowing that physical connection!
   - **Current Implementation Status**:
     **PROPOSED DESIGN ONLY — NOT CURRENTLY IMPLEMENTED**. The current codebase connects as the Supabase `postgres` user (superuser with `BYPASSRLS`), meaning RLS is bypassed for Prisma queries. Current production isolation relies on Tier 1 (Schema Constraints) and Tier 2 (Application Repositories).

---

## 4. Immutable File Storage & Original Binary Preservation

### 4.1. Technical Reality
Retaining only extracted text and chunk tokens does **NOT** constitute bit-for-bit preservation of original documents. To achieve true legal compliance, auditability, and reproducible AI retraining, the original binary files (PDF, DOCX, CSV) must also be permanently preserved.

### 4.2. Storage Object Immutability Protocol
To ensure content-addressed storage objects are truly immutable and secure:

1. **Prevent Overwriting Existing Objects**:
   - When storing blobs: `supabaseAdmin.storage.from('company-training-documents').upload(path, buffer, { upsert: false })`.
   - With `upsert: false`, if an object with that path already exists, Supabase Storage rejects the write with `409 Conflict: Object already exists`.
   - Because the path is content-addressed `<tenant_id>/blobs/<file_hash_sha256>.<ext>`, identical files share the existing immutable blob without overwriting.
2. **Prevent Deletion of Referenced Objects**:
   - In `DocumentService.deleteDocument(documentId, tenantId)`:
     Before deleting from active library `tenant_documents`:
     ```sql
     SELECT COUNT(*) FROM public.training_version_documents 
     WHERE file_hash_sha256 = :hash AND tenant_id = :tenant_id;
     ```
   - If `COUNT > 0`: The active library row is removed, but the physical storage blob in Supabase Storage is **NEVER deleted**. It remains permanently pinned to historical versions.
   - If `COUNT === 0`: The unreferenced draft blob is safely deleted from storage.
3. **Protect Privileged Backend Storage Operations**:
   - `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to backend Fastify services.
   - Storage bucket RLS policies reject all direct public, anonymous, or authenticated client uploads.
4. **Cryptographic SHA-256 Verification on Upload**:
   - The backend never trusts client-reported hashes.
   - During file ingestion, the backend computes the SHA-256 hash over the raw incoming binary stream using Node.js `crypto.createHash('sha256')`. The computed hash determines the immutable storage key.
5. **Safe Cleanup for Unreferenced Draft Blobs**:
   - Unreferenced draft files from aborted sessions (where `COUNT = 0` in `training_version_documents` and `created_at < NOW() - INTERVAL '7 days'`) can be cleaned up via an asynchronous background job without endangering approved historical versions.

---

## 5. Streaming Download Safety & Concurrency Limits

### 5.1. Fastify Streaming Proxy Pipeline
To prevent server Denial of Service (DoS), memory leaks, or unhandled socket crashes during file downloads, the Fastify streaming proxy (`GET /api/v1/training/documents/:id/download`) implements strict stream controls:
1. **Backpressure-Safe Piping**: Uses Node.js `stream.pipeline` (or Fastify native `reply.send(stream)`). Backpressure automatically throttles the upstream Supabase stream if the client has a slow connection, keeping buffer memory consumption below 64 KB per stream.
2. **Hard File Size Enforcement**:
   - Pre-check: If upstream `Content-Length > 10 * 1024 * 1024` (10 MB), immediately return `413 Payload Too Large`.
   - In-flight check: A `Transform` stream counts passing bytes. If total bytes exceed 10 MB, it immediately destroys both upstream and downstream streams with an error.
3. **Client Disconnect & Request Cancellation**: The upstream storage request listens to `req.raw.on('close')`. If the client aborts or closes the tab, the upstream connection is aborted instantly.
4. **Safe Error Handling**: Prevents header double-write errors; if a failure occurs after `headersSent`, the client socket is destroyed cleanly.

### 5.2. Download Concurrency: Single-Instance vs. Multi-Instance Roadmaps
- **Current Single-Instance Limitation**:
  The in-memory concurrency semaphore (max 5 concurrent downloads per tenant, max 25 globally) only limits concurrency within a single Node.js process. If multiple API container instances are deployed behind a load balancer, total concurrent streams across the cluster could be $N \times 5$.
- **Shared Limiter Roadmap for Multi-Instance Deployments (₹0 Budget)**:
  To enforce shared concurrency across multiple API instances without introducing paid services (like Redis Cloud / Upstash):
  - **PostgreSQL Advisory Locks / Ephemeral Connection Table**:
    Use PostgreSQL transaction-level advisory locks (`pg_try_advisory_xact_lock(hashtext(:tenant_id))`) or an ephemeral table `active_download_sessions (tenant_id, session_id, started_at)`:
    ```sql
    -- Atomic check-and-insert for download semaphore:
    INSERT INTO public.active_download_sessions (tenant_id, session_id, started_at)
    SELECT :tenant_id, :session_id, now()
    WHERE (SELECT count(*) FROM public.active_download_sessions WHERE tenant_id = :tenant_id) < 5;
    ```
    On stream finish or abort, the row is deleted. This provides cluster-wide shared concurrency limiting with zero paid infrastructure.

---

## 6. Comprehensive Verification Test Requirements

The following 10 automated test suites must be implemented and executed in Stage 2 to prove the architecture:

| Test ID | Test Name | Target Assertion |
|---|---|---|
| **TEST-01** | Cross-Tenant Read Isolation | Company A user querying Company B's documents, versions, or evaluations receives `403 Forbidden` / `404 Not Found`. |
| **TEST-02** | Cross-Tenant Mutation Isolation | Company A user attempting to update or delete Company B records via API or repository affects 0 rows and returns `403/404`. |
| **TEST-03** | Nested Relation Leakage Prevention | Querying `userProfile` with nested `assignedLeads` or `campaigns` includes strictly filters records by `tenantId`. |
| **TEST-04** | Composite Foreign Key Cross-Link Block | Database engine rejects inserting a `training_version_documents` record pointing to a `version_id` in Tenant A and a `document_id` in Tenant B. |
| **TEST-05** | Transaction Scope Confinement | Interactive transaction (`tx`) executed for Tenant A cannot read or write Tenant B entities even if raw IDs are supplied. |
| **TEST-06** | Background Job Tenant Scoping | Document chunking worker and evaluation worker reject payloads lacking a verified `tenantId` and scope all queries to that tenant. |
| **TEST-07** | Historical Snapshot Preservation | After approving version `v1.0`, deleting the source document from `tenant_documents` leaves `training_version_documents` and `training_version_chunks` 100% intact and queryable. |
| **TEST-08** | Binary Blob Content Preservation | Deleting a document from `tenant_documents` does NOT delete the underlying Supabase Storage blob if referenced by an approved version snapshot. |
| **TEST-09** | SHA-256 Binary Integrity Verification | Proves that downloading an archived snapshot's original binary file produces a SHA-256 checksum exactly matching the snapshot record. |
| **TEST-10** | Streaming Proxy Security & Headers | Downloading a document via the proxy verifies that: (a) file > 10 MB aborts with 413, (b) `Content-Disposition: attachment` is present, (c) `X-Content-Type-Options: nosniff` is present, and (d) client abort cancels upstream fetch. |

---

## 7. Remaining Limitations & Architectural Trade-offs

1. **Prisma Connection Role**:
   Connecting as the Supabase `postgres` user remains necessary for schema management and Prisma migrations. Application-layer tenant isolation via **Tenant Repositories** and **Composite Foreign Keys** provides guaranteed defense, but migrating to a dedicated non-superuser role (e.g. `authenticator` or `app_runtime`) remains an aspirational future enhancement when Supabase connection pooling natively supports custom roles.
2. **Storage Blob Garbage Collection**:
   Because underlying binary blobs are retained for historical snapshots, storage usage grows monotonically. A future Phase 5 storage pruner can be designed to purge blobs whose referencing versions have been permanently deleted from archival.

---

## 8. Final Decision

> ### ✅ **APPROVED TO START STAGE 2**
> 
> **Decision Rationale:**
> 1. The limitations of Prisma Client Extensions have been honestly identified, documented, and superseded by an enterprise-grade multi-layer architecture (Composite Unique/Foreign Keys + Tenant Repositories).
> 2. The immutable snapshot design has been upgraded to guarantee **both** text/chunk snapshots and bit-for-bit original binary file preservation via content-addressed storage.
> 3. The streaming proxy specification incorporates complete backpressure, byte counting, request cancellation, and concurrency protection.
> 4. All 10 rigorous verification test requirements are specified and ready to guide implementation.
> 
> **Stage 2 (Database Schema & Supabase Storage Implementation) is fully specified and approved to proceed upon your command.**
