# VoicePilot AI 🎙️

> Multilingual AI-Powered Outbound Sales Calling SaaS

VoicePilot AI is an autonomous, multilingual outbound sales calling platform designed to scale outbound outreach with low-latency conversational AI agents in multiple languages.

---

## 🏗️ Project Architecture (Phase 1 — Foundation)

This repository is built as an **npm-workspaces** monorepo:

- **[`apps/web`](./apps/web)** — React 18, Vite 6, TypeScript, Tailwind CSS, and React Router single-page application.
- **[`apps/api`](./apps/api)** — Fastify 5, Node.js, and TypeScript backend service with Zod environment validation and health checks.
- **[`packages/shared`](./packages/shared)** — Shared TypeScript interfaces, API schemas, and common constants.
- **[`docs`](./docs)** — Architecture diagrams, development setup, and project roadmap.

---

## ⚡ Quick Start

### 1. Prerequisites
- Windows OS
- Node.js LTS (>= 20.0.0, tested on v26.13.1)
- npm (>= 10.0.0)
- Online Supabase account (no local PostgreSQL required)

### 2. Install Dependencies
```powershell
npm install
```

### 3. Build Shared Contracts
```powershell
npm run build:shared
```

### 4. Run Development Environment
Run both API and Web concurrently with color-coded logs:
```powershell
npm run dev
```

Or run services individually:
```powershell
npm run dev:api    # Starts Fastify at http://localhost:3000
npm run dev:web    # Starts Vite at http://localhost:5173
```

---

## 📡 API Endpoints (Phase 1)

### `GET /health`
Returns system health, uptime, environment, and service version:
```json
{
  "status": "ok",
  "service": "VoicePilot AI API",
  "version": "0.1.0",
  "timestamp": "2026-11-22T06:00:00.000Z",
  "uptime": 42,
  "environment": "development"
}
```

---

## 🔐 Security & Environment Variables

Copy `.env.example` to `.env` before running in production:
```powershell
cp .env.example .env
```
> **IMPORTANT:** Real credentials and secret keys must NEVER be committed to Git.

---

## 📋 Phase Roadmap
- **Phase 1: Project Foundation** *(Completed)*
- **Phase 2: Supabase Online DB & Authentication** *(Completed)*
- **Phase 3: Lead & Campaign Management** *(Completed)*
- **Phase 4: Multilingual Voice & Telephony Engine** *(Completed)*
- **Phase 5: Real-time Analytics & CRM Integration**
