# VoicePilot AI — Phase 4.3: Test Plan & Quality Assurance Strategy

**Document Version:** 1.0.0  
**Phase:** 4.3 — AI Training Studio  
**Baseline Test Count:** 50 Tests Passing (Phases 1, 2, 3, 4.1, 4.2)  
**Target:** 65+ Total Automated Tests Passing with 100% Zero Regressions  
**Status:** Test Specification (Pending Review)

---

## 1. Quality Objectives & Non-Negotiable Rules

1. **Zero Regression Baseline**: All 50 pre-existing tests across multi-tenant security, lead/campaign management, voice engine, and Gemini Live WebSocket gateway must pass without alteration.
2. **Deterministic Automated Testing**: All automated test suites must execute without external paid cloud dependencies by utilizing deterministic service mock modes and test JWT signatures.
3. **Multi-Tenant Boundary Verification**: Cross-tenant isolation must be verified using two distinct companies (Company A: *Kochi Tech Cloud* vs Company B: *Rival Dialing Corp*).
4. **Role-Based Access Control (RBAC)**: AGENT users must never be allowed to approve or activate training versions.
5. **No Secret Exposure**: API keys, passwords, or database credentials must never be printed to test logs.

---

## 2. Test Architecture & Runner Setup

- **Test Runner**: Node.js Native Test Runner (`node:test`, `node:assert/strict`) with `tsx`.
- **Command**: `npm test` (`npm run test --workspace=@voicepilot/api`).
- **Network Execution**: `BypassSandbox: true` for ephemeral loopback TCP socket connections during WebSocket test runs.
- **In-Memory Mock Support**: Services implement memory fallback modes for fast unit/CI execution while supporting direct database integration testing.

---

## 3. Test Suites Breakdown

### Suite 1: Existing Regression Baseline (50 / 50 Tests Required)
- `test/multi_tenant_security.test.ts` (16 Tests):
  - Token authentication, rejection of unauthenticated/forged requests, tenant boundaries, role-based checks.
- `test/phase3_management.test.ts` (16 Tests):
  - Lead CRUD, CSV bulk import, duplicate detection, DNC/consent checks, campaign approval workflows.
- `test/phase4_voice_engine.test.ts` (11 Tests):
  - Company knowledge grounding, voice configs, anti-hallucination callbacks, Malayalam switching, evaluation metrics.
- `test/gemini_live_voice.test.ts` (7 Tests):
  - WebSocket authentication, cross-tenant denial, Malayalam PCM audio streaming, 10-minute session cap, session evaluation.

---

### Suite 2: Document Processing & Extraction Unit Tests
**File**: `apps/api/test/training_documents.test.ts`
1. `Validate supported MIME types`: Accepts `application/pdf`, `text/plain`, `text/csv`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Rejects `.exe`, `.zip`, `.js`.
2. `Enforce file size limits`: Rejects files exceeding 10MB (`FILE_TOO_LARGE`).
3. `SHA-256 duplicate detection`: Uploading identical file content within the same tenant throws `DUPLICATE_FILE`.
4. `Allow identical file in different tenant`: Confirms Company B can upload a file with identical hash to Company A without collision.
5. `Text extraction accuracy`: Verifies structured extraction of paragraphs from TXT, CSV, DOCX, and PDF buffers.
6. `Chunking & overlap`: Verifies text chunker splits long documents into 400-token passages with 50-token overlap.
7. `Prompt injection sanitization`: Strips adversarial prompt overrides (`"ignore all previous instructions"`, `"system:"`).

---

### Suite 3: Training Version State Machine & Approval Workflow Tests
**File**: `apps/api/test/training_versions.test.ts`
1. `Create initial draft version`: Creates version `v1.0` with status `DRAFT`.
2. `Submit draft for approval`: Transition from `DRAFT` to `SUBMITTED_FOR_APPROVAL`.
3. `RBAC: AGENT cannot approve version`: Returns `403 Forbidden` when AGENT attempts approval.
4. `OWNER/ADMIN approves version`: Transition from `SUBMITTED_FOR_APPROVAL` to `APPROVED`.
5. `Immutable document content snapshot`:
   - When version moves to `APPROVED`, verifies `training_version_documents` and `training_version_chunks` contain frozen copies of extracted text, chunk tokens, and SHA-256 hashes.
   - Deleting the source document from `tenant_documents` leaves the frozen version snapshot 100% intact and runnable.
6. `Activation rule: Exactly one active version`: Activating `v1.0` sets status `ACTIVATED`. Activating `v1.1` sets `v1.0` to `ARCHIVED`.
7. `Rejection workflow`: Transition from `SUBMITTED_FOR_APPROVAL` to `DRAFT` with recorded `rejectionReason`.
8. `Immutable active version`: Attempting to edit an `ACTIVATED` version is rejected; forces creating a new `DRAFT`.
9. `Rollback capability`: Activating a previously approved historical version succeeds and updates the active pointer.
10. `Historical version retention & ON DELETE RESTRICT`:
    - Asserts that attempting to delete a `training_versions` row referenced by a `voice_sessions` record fails with a foreign key restriction violation (`ON DELETE RESTRICT`).
    - Asserts that API returns `409 Conflict` when trying to delete any non-draft version.

---

### Suite 4: Multi-Tenant Security & Storage Isolation Tests
**File**: `apps/api/test/training_security.test.ts`
Setup: Company A (*Alice = Owner, Charlie = Agent*) & Company B (*Bob = Owner*).

1. `CROSS-TENANT DOCUMENT ACCESS`:
   - Bob cannot list Alice's documents (`GET /tenants/:companyAId/training/documents` -> `403`).
   - Bob cannot retrieve or download Alice's document (`GET /tenants/:companyAId/training/documents/:docId` -> `403`).
   - Bob cannot delete Alice's document (`DELETE /tenants/:companyAId/training/documents/:docId` -> `403`).
2. `CROSS-TENANT INSTRUCTIONS & EXAMPLES`:
   - Bob cannot view or edit Alice's training instructions -> `403`.
   - Bob cannot view or edit Alice's conversation examples -> `403`.
3. `CROSS-TENANT VERSION INTERFERENCE`:
   - Bob cannot approve, reject, or activate Alice's training version -> `403`.
4. `CROSS-TENANT EVALUATION ACCESS`:
   - Bob cannot view Alice's call evaluation reports or mistakes detected -> `403`.
5. `CENTRALIZED PRISMA TENANT-SCOPED DATA ACCESS (`getTenantDb`)`:
   - Verifies `getTenantDb(tenantA)` automatically appends `where: { tenantId: tenantA }` across `findFirst`, `findMany`, `count`, `aggregate`, `groupBy`.
   - Verifies `findUnique` calls are rewritten to tenant-scoped `findFirst`.
   - Verifies `create` and `createMany` forcefully set `tenantId` to the active context.
   - Verifies `update` and `delete` operations targeting Company B records via Company A client affect 0 rows.
6. `STORAGE BUCKET SECURITY & DOWNLOAD HEADERS`:
   - Verify storage bucket is `company-training-documents` with `public = false`.
   - Verify signed storage URLs are scoped strictly to `tenantId/...` and pass `{ download: sanitizedFileName }` to invoke S3 `response-content-disposition=attachment`.
   - Verify authenticated stream proxy endpoint `GET /api/v1/training/documents/:id/download` returns exact HTTP headers: `Content-Disposition: attachment; filename="..."` and `X-Content-Type-Options: nosniff`.
   - Verify unauthenticated or cross-tenant requests cannot download documents (`401` / `403`).

---

### Suite 5: AI Evaluation Engine Unit & Integration Tests
**File**: `apps/api/test/training_evaluations.test.ts`
1. `Accurate Pricing Call Evaluation`:
   - Call adhering strictly to approved catalog prices receives `pricing_accuracy_score = 100` and `unapproved_pricing_flagged = false`.
2. `Hallucinated Pricing Detection`:
   - Call where representative invents an unapproved discount (e.g. *"75% off for you today"*) is flagged with `unapproved_pricing_flagged = true`, low score (`< 50`), and identified mistake log.
3. `Consultative Behavior Evaluation`:
   - Evaluates discovery questions, objection handling, and lead interest.
4. `Language Quality Evaluation`:
   - Scores native Malayalam and Indian English phrasing.

---

### Suite 6: Voice Engine Integration with Active Training Version
**File**: `apps/api/test/training_voice_integration.test.ts`
1. `Voice session stamps active version ID`: When a voice session starts, its record contains `training_version_id = activeVersion.id`.
2. `Historical session version immutability`: When a new version `v2.0` is activated, an older session's `training_version_id` remains unchanged (`v1.0`).
3. `Prompt contains active version instructions & examples`: Verified by examining the generated Gemini Live system instruction.

---

## 4. Test Execution Matrix

| Test Suite | File | Estimated Tests | Target Status |
| :--- | :--- | :---: | :---: |
| Existing Security & Auth | `multi_tenant_security.test.ts` | 16 | PASS (Unchanged) |
| Existing Lead & Campaign | `phase3_management.test.ts` | 16 | PASS (Unchanged) |
| Existing Voice Engine | `phase4_voice_engine.test.ts` | 11 | PASS (Unchanged) |
| Existing Gemini Live Gateway | `gemini_live_voice.test.ts` | 7 | PASS (Unchanged) |
| Document Management | `training_documents.test.ts` | 5 | NEW |
| Version State Machine | `training_versions.test.ts` | 6 | NEW |
| Tenant Security & Isolation | `training_security.test.ts` | 6 | NEW |
| Training Evaluation Engine | `training_evaluations.test.ts` | 4 | NEW |
| Voice Engine Integration | `training_voice_integration.test.ts` | 3 | NEW |
| **Total Automated Tests** | | **69+** | **100% PASS** |

---

## 5. Verification Commands

```bash
# 1. Type Check All Packages
npm run typecheck

# 2. Production Build Verification
npm run build

# 3. Full Test Suite Execution
npm test
```
