# VoicePilot AI — Supabase PostgreSQL & Auth Setup Guide (Phase 2)

## Overview
VoicePilot AI leverages:
1. **Supabase Auth** for identity management (sign up, sign in, password recovery, session tokens, and cryptographic password hashing).
2. **Supabase PostgreSQL** with **Prisma ORM** for persistent multi-tenant relational data (`UserProfile`, `Tenant`, `TenantMembership`, `Role`, `AuditLog`).
3. **Defense-in-Depth Multi-Tenant Security**: Enforced via application-level authorization in Fastify and PostgreSQL Row Level Security (RLS) policies.

---

## 1. Supabase Dashboard Manual Configuration Steps

Follow these steps in your online Supabase project (https://supabase.com/dashboard):

### Step A: Retrieve API & Database Credentials
1. **Project Settings -> API:**
   - Copy **Project URL** -> `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - Copy **anon public** key -> `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - Copy **service_role secret** -> `SUPABASE_SERVICE_ROLE_KEY` *(NEVER expose to client)*
   - Copy **JWT Secret** -> `SUPABASE_JWT_SECRET`
2. **Project Settings -> Database -> Connection String:**
   - Under **Connection Pooling** (Supavisor / Transaction mode on port `6543`):
     Copy URI -> `DATABASE_URL`
   - Under **Direct Connection** (Session mode on port `5432`):
     Copy URI -> `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` with your Supabase database password.

### Step B: Configure Supabase Auth Settings
1. Go to **Authentication -> Providers -> Email**:
   - Ensure **Enable Email provider** is turned **ON**.
2. Go to **Authentication -> Email Templates**:
   - For fast local development, you can temporarily disable **"Confirm email"** under **Authentication -> URL Configuration** or **Sign In / Up settings** if you wish newly registered test accounts to be immediately active without checking an inbox.
3. Add `http://localhost:5173/**` to **Redirect URLs** in **Authentication -> URL Configuration**.

### Step C: Run Database Migration & RLS Script
1. Navigate to **SQL Editor** in the Supabase Dashboard.
2. Open the file `apps/api/prisma/supabase_setup.sql` in this repo.
3. Paste the entire SQL script into the Supabase SQL Editor and click **Run**.
4. This script:
   - Provisions `public.user_profiles`, `public.tenants`, `public.roles`, `public.tenant_memberships`, and `public.audit_logs`.
   - Seeds the 4 standard roles (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`).
   - Installs the `on_auth_user_created` trigger on `auth.users` to automatically populate `public.user_profiles` upon signup.
   - Activates **Row Level Security (RLS)** and deploys multi-tenant security policies.

---

## 2. Multi-Tenant Security Architecture: RLS vs Prisma ORM

> [!IMPORTANT]
> **Privileged Connection Bypass Notice:**
> When Prisma connects to PostgreSQL using the default database connection string (`DATABASE_URL`), it connects as the `postgres` database user. In PostgreSQL, superusers and roles with the `BYPASSRLS` attribute **automatically bypass Row Level Security policies**.
>
> **Do not assume RLS automatically isolates Prisma queries.**

### How VoicePilot AI Solves Multi-Tenant Isolation
VoicePilot AI implements a **dual-layer defense-in-depth model**:

```text
[ Client Request ]
       │
       ▼
1. FASTIFY AUTHENTICATION (`authenticate` preHandler)
   - Verifies Bearer JWT signature against Supabase Auth service.
   - Resolves authenticated user ID. Rejects invalid tokens with HTTP 401.
       │
       ▼
2. APPLICATION TENANT AUTHORIZATION (`requireTenantAccess` preHandler)
   - NEVER trusts any client-provided tenant ID.
   - Queries `public.tenant_memberships` for `(tenantId, request.user.id)`.
   - If membership does not exist: immediately halts request with HTTP 403 Forbidden!
   - Enforces role hierarchy (OWNER, ADMIN, AGENT, VIEWER).
       │
       ▼
3. PRISMA QUERY SCOPING (Repository / Service Layer)
   - Every database query explicitly injects the verified `tenantId` into where clauses.
       │
       ▼
4. POSTGRESQL ROW LEVEL SECURITY (RLS) (Database Defense-in-Depth)
   - RLS is enabled on all tables (`public.tenants`, `public.tenant_memberships`, `public.audit_logs`).
   - Restricts any direct client-side PostgREST queries through user-impersonated JWTs (`auth.uid()`).
```

---

## 3. Running Automated Multi-Tenant Security Tests

To verify that cross-tenant access is strictly denied:
```powershell
npm test
```
The test suite verifies:
- Unauthenticated requests are rejected (`401 Unauthorized`).
- Forged tokens are rejected (`401 Unauthorized`).
- Company A and Company B tenants are created independently.
- User A can ONLY see Company A in `GET /tenants`.
- User B can ONLY see Company B in `GET /tenants`.
- User A attempting to read Company B records via `GET /tenants/:id` is rejected with `403 Forbidden`.
- User B attempting to read Company A audit logs is rejected with `403 Forbidden`.
