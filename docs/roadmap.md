# VoicePilot AI — Engineering Roadmap

## Phase 1: Project Foundation (Current Phase)
- [x] Monorepo layout with npm-workspaces (`apps/web`, `apps/api`, `packages/shared`, `docs`)
- [x] React 18 + Vite + TypeScript + Tailwind CSS frontend
- [x] Fastify + TypeScript backend with Zod environment validation
- [x] `GET /health` endpoint returning system metrics and uptime
- [x] Unified concurrent development runner (`npm run dev`)
- [x] Clean `.env.example` template with safe placeholders
- [x] Foundation verification tests and documentation

---

## Phase 2: Database & Authentication (Completed)
- [x] Supabase Auth integration with session persistence
- [x] Prisma ORM configuration with PostgreSQL schemas (`UserProfile`, `Tenant`, `TenantMembership`, `Role`, `AuditLog`)
- [x] PostgreSQL RLS policies & automatic user creation triggers
- [x] Fastify authentication (`authenticate`) and tenant isolation (`requireTenantAccess`) middlewares
- [x] Protected endpoints: `GET /auth/me`, `POST /tenants`, `GET /tenants`, `GET /tenants/:id`, `GET /tenants/:id/audit-logs`
- [x] Automated multi-tenant security test suite (13 tests proving cross-tenant denial)
- [x] React SaaS UI: Login, Register, Forgot Password, Company Setup, Company Switcher, and Dashboard pages

---

## Phase 3: Campaign & Lead Management (Next Phase)
- CSV/Excel lead list upload & parsing
- Lead scoring & timezone-aware dialing windows
- Contact status pipeline (Uncalled, In Progress, Qualified, Follow-up, DNC)
- Campaign scheduling & concurrency throttling

---

## Phase 4: Voice & Speech Engine Integration
- Telephony provider integration (Twilio / SIP trunking)
- Real-time STT (Deepgram Nova-2 / Live Audio WebSocket)
- Multilingual LLM conversation agent (function calling, objection handling)
- Low-latency TTS (ElevenLabs / Cartesia / Deepgram Aura)
- Interruption handling & acoustic echo cancellation

---

## Phase 5: Analytics, Call Recording & CRM Sync
- Post-call sentiment analysis, summarization & action item extraction
- Call recordings & synchronized audio transcript playback
- Webhook integrations & CRM sync (HubSpot, Salesforce)
- Enterprise billing & usage limits
