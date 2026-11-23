# VoicePilot AI — Architecture Documentation

## Overview
VoicePilot AI is an enterprise-grade, multilingual AI-powered outbound sales calling SaaS platform.

## Monorepo Layout
We utilize an **npm-workspaces** monorepo to maintain strong separation of concerns, strict type-safety across boundaries, and unified tooling.

```text
VoicePilot AI/
├── apps/
│   ├── api/             # Fastify REST backend (TypeScript, Node.js)
│   │   ├── src/
│   │   │   ├── config/  # Zod environment variable parsing & validation
│   │   │   ├── routes/  # API route definitions (GET /health, etc.)
│   │   │   ├── app.ts   # Fastify instance builder & middleware
│   │   │   └── server.ts# Server lifecycle & graceful termination
│   │   └── tsconfig.json
│   └── web/             # React 18 + Vite 6 frontend
│       ├── src/
│       │   ├── components/ # Reusable UI components (Header, Footer, etc.)
│       │   ├── pages/      # Route pages (Home, Status/Health Inspector)
│       │   └── App.tsx     # React Router entry point
│       └── vite.config.ts
├── packages/
│   └── shared/          # Shared contracts, types, schemas, and enums
│       ├── src/
│       │   ├── types/   # HealthResponse, SupportedLanguages, Common API types
│       │   └── index.ts
│       └── tsconfig.json
├── docs/                # Architecture, setup, and roadmap documentation
├── .env.example         # Template for environment variables (safe placeholders only)
├── .gitignore           # Ignores dist, node_modules, local secrets
├── package.json         # Root npm workspace orchestrator
├── tsconfig.base.json   # Base TypeScript compiler settings
└── README.md            # Project entry overview and run guide
```

## Technology Stack

### 1. Frontend (`apps/web`)
- **React 18** with **TypeScript**
- **Vite 6** for blazing fast HMR and optimized bundler output
- **Tailwind CSS 3** for streamlined utility styling
- **React Router 6** for client-side single page navigation
- **Lucide React** for lightweight iconography

### 2. Backend (`apps/api`)
- **Fastify 5**: High-performance HTTP server with minimal overhead
- **Zod**: Runtime schema verification for environment variables and payloads
- **@fastify/cors**: Configured for local dev origin `http://localhost:5173`
- **Graceful Shutdown**: Handles SIGINT/SIGTERM cleanly

### 3. Shared Library (`packages/shared`)
- Direct cross-package types avoiding duplicate type declarations
- Enforces API contract between frontend and backend

### 4. Database & Auth Layer (Phase 2 — Active)
- **Supabase Auth**: Manages user identity, session tokens, and password hashing via Bcrypt.
- **Supabase PostgreSQL**: Cloud database with connection pooling on port 6543 and direct migration access on port 5432.
- **Prisma ORM 6**: Type-safe relational database client with schemas for `UserProfile`, `Tenant`, `TenantMembership`, `Role`, and `AuditLog`.
- **Multi-Tenant Security Architecture**:
  - Application-level tenant authorization in Fastify enforces company boundaries on all queries.
  - PostgreSQL Row Level Security (RLS) policies deploy defense-in-depth on `user_profiles`, `tenants`, `tenant_memberships`, and `audit_logs`.
  - Notice: Prisma superuser connections bypass RLS by design, so the primary isolation guarantee is enforced via `requireTenantAccess` middleware and scoped repository queries.
