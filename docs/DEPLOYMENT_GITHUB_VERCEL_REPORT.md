# VoicePilot AI — GitHub Push & Vercel Deployment Report

**Document Version:** 1.0.0  
**Date:** November 23, 2026  
**Auditor / Engineer:** Lead DevOps & Cloud Solutions Architect  
**Repository:** [https://github.com/nihalnilu8055/VoicePilot-AI](https://github.com/nihalnilu8055/VoicePilot-AI)  
**Target Platform:** Vercel (Monorepo Architecture)  
**Strict Mandate:** Zero secret exposure, ₹0 budget verification, zero destructive actions, truthful verification reporting.

---

## 1. Executive Summary

VoicePilot AI has completed all local security, build, and test verification phases in preparation for deployment to GitHub and Vercel:

1. **Security & Secret Sanitization:** Verified 100% clean. All `.env` files and build outputs are strictly excluded by `.gitignore`. Regex scans confirmed zero exposed passwords, connection strings, Gemini API keys (`AIzaSy`), or Supabase service role keys in tracked files or generated frontend bundles.
2. **Build & Automated Test Status:**
   - **Prisma Schema:** Validated (`prisma validate` passed with code 0).
   - **TypeScript Compilation:** Passed across all 3 workspaces (`@voicepilot/shared`, `@voicepilot/api`, `@voicepilot/web`) with 0 errors.
   - **Production Build:** `npm run build` succeeded across all packages (`apps/web` Vite bundle: 986 kB JS / 38 kB CSS).
   - **Automated Regression Suite:** **50/50 tests passing (100% pass rate)**.
3. **Git Commit Status:** Clean commit history on `main`:
   - **Latest Commit Hash:** `4c6f861`
   - **Branch:** `main`
   - **Commits Pushed:**
     - `7c49e87` — `feat: VoicePilot AI initial production release (Phases 1-4.2 core, Phase 4.3 baseline & Vercel deployment config)`
     - `c9057e3` — `docs: add GitHub push and Vercel deployment report`
     - `4c6f861` — `chore: ignore .vite cache directory`
4. **GitHub Push Status:** **SUCCESSFULLY PUSHED & LIVE ON GITHUB**. Authenticated via SSH (`git@github.com:nihalnilu8055/VoicePilot-AI.git`). Branch `main` is completely in sync with `origin/main`.

---

## 2. Working Features vs Documented Features Audit

Per strict architectural instructions, features are clearly categorized to avoid over-claiming readiness:

### Currently Implemented & Verified Working Features (Phases 1–4.2)
- **Multi-Tenant Authentication & Scoping:** Complete tenant isolation, role-based access control (OWNER, ADMIN, AGENT), JWT validation, and audit logging.
- **Lead Management (Phase 3):** Full CRUD for leads, CSV bulk import with column auto-mapping, deduplication, and regulatory consent verification.
- **Campaign Management (Phase 3):** Multi-stage campaign lifecycle (DRAFT -> PENDING_APPROVAL -> ACTIVE -> COMPLETED), lead assignment, and dispatch controls.
- **AI Voice Engine (Phase 4):** Consultative sales engine, Malayalam (`ml-IN`) and English (`en-IN`) multi-language support, anti-hallucination safeguards for pricing, and post-call evaluation reporting.
- **Gemini Live Real-Time Voice Gateway (Phase 4.2):** Fastify WebSocket gateway (`/tenants/:tenantId/voice/live`) handling 16kHz PCM audio streaming, live transcript broadcasting, and Gemini Live session management.

### Documented / Planned Features (Phase 4.3 Training Studio)
- **Status:** **Architecture Planned & Baseline Established ONLY.**
- The Phase 2 schema was baselined in Prisma (`20261122000000_init_phase2`).
- The 8 Phase 4.3 tables (`tenant_documents`, `document_chunks`, `training_versions`, etc.) have **NOT** been created on the live database. They are documented in migration SQL and Prisma schema, but will be deployed only after explicit user instruction.

---

## 3. Pre-Commit Security Audit Results

| Security Check | Verification Scope | Status | Notes |
| :--- | :--- | :---: | :--- |
| `.gitignore` Configuration | `.env`, `apps/api/.env`, `node_modules`, `dist`, `.vercel` | **PASS** | Verified with `git status --ignored` |
| Local Secrets in Git Staging | Uncommitted index inspection | **PASS** | Zero `.env` files staged |
| Database Password Search | Regex scan for `postgres://` and `postgresql://` | **PASS** | Found only placeholders in `.env.example` |
| Gemini API Key Search | Regex scan for `AIzaSy` | **PASS** | Found only placeholder string in UI input |
| JWT Tokens & Service Keys | Regex scan for `eyJ...` and `service_role` | **PASS** | Zero tokens in tracked files |
| Frontend Bundle Audit | `apps/web/dist/assets/*.js` compiled output scan | **PASS** | Bundle contains zero backend secrets |
| Backend-Only Credential Scoping | `GEMINI_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **PASS** | Excluded from frontend code and VITE variables |

---

## 4. Vercel Architecture Evaluation

Deploying a Fastify + Vite monorepo on Vercel requires evaluating two distinct projects configured from the same GitHub repository:

### Project 1: Frontend Web Application (`apps/web`)

- **Framework Preset:** Vite
- **Root Directory:** `apps/web`
- **Build Command:**
  ```bash
  npm run build:shared && npm run build
  ```
  *(Building `@voicepilot/shared` first ensures compiled TypeScript declaration and distribution files exist for `@voicepilot/web`).*
- **Output Directory:** `dist`
- **Install Command:**
  ```bash
  npm install
  ```
- **SPA Fallback Routing:** Handled via `apps/web/vercel.json`:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "cleanUrls": true,
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
- **API Proxying:** In development, Vite proxies `/api` to `http://localhost:3000`. In production, if Project 2 (Backend) is deployed, `apps/web/vercel.json` can proxy `/api/(.*)` directly to the backend URL without CORS overhead:
  ```json
  {
    "rewrites": [
      {
        "source": "/api/(.*)",
        "destination": "https://<BACKEND_PROJECT_URL>/$1"
      },
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

---

### Project 2: Backend API Service (`apps/api`) & Vercel Limitations Analysis

Vercel provides Serverless Functions, which introduces a fundamental architectural distinction for VoicePilot AI:

#### 1. REST API Compatibility on Vercel Functions (`SUPPORTED`)
- All HTTP REST endpoints (`/health`, `/auth/me`, `/tenants`, `/leads`, `/campaigns`, `/dashboard/stats`, `/knowledge`) are fully compatible with Vercel Serverless Functions.
- Adapter configured in `apps/api/api/index.ts` and `apps/api/vercel.json`.
- Maximum execution duration: 15 seconds on Vercel Hobby (Free), up to 300 seconds on Vercel Pro.

#### 2. WebSocket & Gemini Live Compatibility on Vercel Functions (`ARCHITECTURAL LIMITATION`)
- **CRITICAL FINDING:** Vercel Serverless Functions (AWS Lambda-based) **do NOT support persistent, bidirectional TCP WebSockets**.
- Serverless instances terminate immediately after responding to an HTTP request.
- The Gemini Live Voice Engine (`/tenants/:tenantId/voice/live`), which streams real-time 16kHz PCM audio bidirectionally between the browser and Google Gemini Live API, **cannot maintain a persistent WebSocket session inside a Vercel Serverless Function**.

#### 3. Recommended Production Backend Architecture
- **Option A (Hybrid Recommended - ₹0 Free Tier):**
  - **Frontend (`apps/web`):** Deploy to **Vercel** (Global Edge CDN, blazing fast Vite SPA delivery).
  - **Backend (`apps/api`):** Deploy to a persistent container platform with native WebSocket support:
    - **Render.com** (Free Web Service tier supports persistent WebSockets).
    - **Railway.app** or **Fly.io** (Native Docker/Node.js persistent container runtime).
- **Option B (Vercel Serverless REST + External Voice Gateway):**
  - Run REST endpoints on Vercel Serverless Functions.
  - Route WebSocket requests directly to a persistent micro-gateway instance.

---

## 5. Environment Variables Configuration Checklist

Configure these variables in the respective Vercel project settings (**Project Settings -> Environment Variables**):

### Project 1: Frontend (`apps/web`)

| Variable Name | Required | Purpose | Exposure Scope |
| :--- | :---: | :--- | :--- |
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL | Public (Browser) |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous public key | Public (Browser) |
| `VITE_API_URL` | Optional | Direct backend URL (if not using Vercel rewrites proxy) | Public (Browser) |

> [!CAUTION]
> Never configure `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `GEMINI_API_KEY` in Project 1.

---

### Project 2: Backend (`apps/api`)

| Variable Name | Required | Purpose | Exposure Scope |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Backend Only |
| `CORS_ORIGIN` | **Yes** | Allowed frontend URL (e.g. `https://<FRONTEND_PROJECT>.vercel.app`) | Backend Only |
| `DATABASE_URL` | **Yes** | Supabase connection pooling string (port 6543) | Backend Only |
| `DIRECT_URL` | **Yes** | Supabase direct connection string (port 5432) | Backend Only |
| `SUPABASE_URL` | **Yes** | Supabase project URL | Backend Only |
| `SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous API key | Backend Only |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase administrative service role key | Backend Only |
| `SUPABASE_JWT_SECRET` | **Yes** | Supabase JWT secret for token verification | Backend Only |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio Gemini API key | Backend Only |

---

## 6. Deployment Verification Procedure

Once pushed to GitHub and linked in Vercel:

1. **Preview Verification Steps:**
   - [ ] Navigate to the Vercel generated preview URL (`https://<PROJECT-NAME>-<HASH>.vercel.app`).
   - [ ] Verify homepage loads cleanly without console errors.
   - [ ] Test User Registration / Login flow against Supabase Auth.
   - [ ] Test Company / Tenant Creation.
   - [ ] Access Dashboard and verify stats endpoint returns 200.
   - [ ] Verify Lead list loads and CSV sample download operates.
   - [ ] Check Network tab to confirm `/health` returns `{"status":"ok"}`.
   - [ ] Verify that API responses contain zero leaked secrets or internal database errors.
2. **Production Promotion:**
   - Once preview verification passes, merge or promote the deployment to Production in the Vercel dashboard.

---

## 7. Cost & Billing Safeguards

- **Budget:** **₹0 / $0 USD (Free Tier Verified)**.
- **Vercel:** Deploys under the Hobby Free Plan.
- **Supabase:** Free Tier PostgreSQL and Authentication.
- **Gemini API:** Free Tier Google AI Studio quota.
- **Telephony:** Zero phone calls initiated (WebRTC/WebSocket audio simulation only; Twilio disabled).
- **Billing:** No paid subscriptions or upgrades enabled.
