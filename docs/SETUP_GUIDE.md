# Setup Guide — Health Memory Agent

**Version:** 0.1 (Phase 0)  
**Last Updated:** Phase 0

---

## Prerequisites

Before you begin, ensure the following are installed:

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Node.js | 18.x or later | `node --version` |
| npm | 9.x or later | `npm --version` |
| Git | Any recent version | `git --version` |

**Optional (for Supabase integration — needed from Phase 1):**

| Tool | Purpose |
|------|---------|
| Supabase CLI | Local development database, migrations |
| Docker Desktop | Required by Supabase CLI for local dev |

Install Supabase CLI: `npm install -g supabase`

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url> Sanjivni
cd Sanjivni

# Install all dependencies for all workspaces
npm install
```

This installs dependencies for the root, `frontend/`, and `backend/` workspaces in one command.

---

## Step 2: Configure Environment Variables

The application uses separate `.env` files for the backend and frontend. **Never commit `.env` files.**

### Backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Required — application mode
NODE_ENV=development
PORT=3001

# Required — configure this or the backend will fail to start
# Leave as-is for demo/scaffold mode (no real Supabase needed)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Required — origin of the frontend for CORS
FRONTEND_URL=http://localhost:5173
```

**For scaffold/demo mode (no real Supabase account):** The backend will start and the health endpoint will work even without valid Supabase credentials. Features requiring database access will fail gracefully. See the `DEMO_MODE` note in `backend/.env.example`.

### Frontend environment

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## Step 3: Start the Development Servers

Run these in two separate terminal windows:

**Terminal 1 — Backend:**
```bash
npm run dev:backend
```

Expected output:
```
[INFO] Health Memory Agent backend starting...
[INFO] Environment: development
[INFO] Server running on http://localhost:3001
[INFO] Health check: http://localhost:3001/api/health
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
```

Expected output:
```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 4: Verify the Application

1. **Backend health check:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "environment": "development",
     "version": "0.0.1"
   }
   ```

2. **Frontend:** Open http://localhost:5173 in your browser. You should see the Health Memory Agent application shell with a "Foundation Ready" placeholder.

---

## Step 5: Run Quality Checks

```bash
# TypeScript type checking (both workspaces)
npm run type-check

# ESLint (both workspaces)
npm run lint

# All tests
npm run test

# Build for production (verify build succeeds)
npm run build
```

---

## Supabase Setup (Required from Phase 1)

### Option A: Supabase Cloud (Recommended for production)

1. Create a free account at https://supabase.com
2. Create a new project
3. Go to Project Settings → API
4. Copy your Project URL, anon key, and service_role key
5. Paste values into `backend/.env`
6. Run existing migrations:
   ```bash
   supabase db push
   ```

### Option B: Local Supabase (Recommended for development)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (requires Docker)
cd supabase
supabase start

# The CLI will print your local URL and keys
# Use these in backend/.env
```

Local Supabase dashboard: http://localhost:54323

---

## Running Database Migrations

```bash
# Apply all pending migrations to your Supabase project
supabase db push

# Or, for local Supabase:
supabase db reset   # resets and replays all migrations
```

---

## Available Commands

All commands run from the repository root:

| Command | Description |
|---------|-------------|
| `npm run dev:frontend` | Start frontend dev server (port 5173) |
| `npm run dev:backend` | Start backend dev server (port 3001) |
| `npm run build` | Production build (both) |
| `npm run build:frontend` | Production build (frontend only) |
| `npm run build:backend` | Production build (backend only) |
| `npm run test` | Run all tests |
| `npm run test:frontend` | Frontend tests only |
| `npm run test:backend` | Backend tests only |
| `npm run lint` | ESLint (both) |
| `npm run type-check` | TypeScript check (both) |

---

## Expected Local URLs

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |
| Local Supabase (optional) | http://localhost:54321 |
| Local Supabase Dashboard | http://localhost:54323 |

---

## Common Setup Failures

### `Error: Missing required environment variable: SUPABASE_URL`

**Cause:** Backend started without a `.env` file.  
**Fix:** Copy `backend/.env.example` to `backend/.env` and fill in at least placeholder values. Set `DEMO_MODE=true` to skip Supabase validation.

### Port already in use

**Cause:** Another process is using port 3001 or 5173.  
**Fix:**
```bash
# Find process using port 3001
lsof -i :3001
kill -9 <PID>
```
Or change the port in `backend/.env` (`PORT=3002`) and update `frontend/.env` accordingly.

### `npm install` fails with ERESOLVE

**Cause:** Dependency version conflict.  
**Fix:** Run `npm install --legacy-peer-deps`. If it persists, delete `node_modules/` and `package-lock.json`, then reinstall.

### TypeScript errors after `npm install`

**Cause:** Missing type definitions.  
**Fix:** Run `npm install` again to ensure all workspace dependencies resolved correctly.

### Vite proxy errors (Cannot connect to backend)

**Cause:** Backend not running, or `VITE_API_BASE_URL` incorrect.  
**Fix:** Ensure backend is running on port 3001, and `frontend/.env` contains `VITE_API_BASE_URL=http://localhost:3001`.

---

## Current Implementation Status

**Phase 0 Complete.** The following is implemented:

- ✅ Frontend application shell (React + TypeScript + Vite)
- ✅ Navigation layout
- ✅ Home/dashboard placeholder
- ✅ Backend Express.js application
- ✅ `GET /api/health` endpoint
- ✅ Environment variable validation
- ✅ Centralized error handling
- ✅ Request logging
- ✅ TypeScript strict mode (both)
- ✅ ESLint (both)
- ✅ Vitest test suite with health test
- ✅ CSS design token system

**Not yet implemented (future phases):**

- ❌ User authentication (Phase 1)
- ❌ Family profiles and permissions (Phase 1)
- ❌ Health records and documents (Phase 2)
- ❌ OCR processing (Phase 2)
- ❌ AI summaries (Phase 3)
- ❌ Medications and appointments (Phase 4)
- ❌ SOS demo mode (Phase 5)
- ❌ Live SMS/voice (Phase 6)

---

## Starting Phase 1

Before starting Phase 1:

1. Ensure Phase 0 setup is working (all checks pass)
2. Create a Supabase project and configure `backend/.env`
3. Read `docs/DEVELOPMENT_ROADMAP.md` Phase 1 section
4. Read `AGENTS.md` (development conventions)
5. Read `docs/ARCHITECTURE.md` (authentication flow section)
6. Submit the Phase 1 implementation prompt
