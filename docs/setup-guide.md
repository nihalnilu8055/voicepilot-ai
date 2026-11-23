# VoicePilot AI — Local Setup & Development Guide

## Prerequisites
- **Operating System:** Windows 10/11
- **Node.js:** v20.0.0+ LTS (Tested on v26.13.1 LTS)
- **Package Manager:** npm (v10.0.0+)
- **Git**
- **Supabase Cloud Account:** (Online project ready)

## Initial Setup Steps

### 1. Clone & Enter Project Folder
```powershell
cd "D:\FREELANCE\VoicePilot AI"
```

### 2. Environment Configuration
Copy the `.env.example` template into `.env`:
```powershell
Copy-Item .env.example .env
```
Update the Supabase URL and anon key with your online project credentials when ready.

### 3. Install All Dependencies
Run from the root directory:
```powershell
npm install
```
This installs dependencies across all workspaces (`packages/shared`, `apps/api`, `apps/web`) in a single unified step.

### 4. Build Shared Package First
```powershell
npm run build:shared
```

### 5. Running the Application

#### Run Frontend & Backend Together (Concurrent):
```powershell
npm run dev
```

#### Or Run Each Independently:
- **Fastify API Server:**
  ```powershell
  npm run dev:api
  ```
  Runs at: `http://localhost:3000`  
  Health Check: `http://localhost:3000/health`

- **Vite Web Frontend:**
  ```powershell
  npm run dev:web
  ```
  Runs at: `http://localhost:5173`

### 6. Verification
Navigate to `http://localhost:5173/status` to confirm the frontend communicates with the backend health endpoint.
