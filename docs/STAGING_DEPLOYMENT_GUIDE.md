# Sanjivani (Health Memory Agent) — Staging Deployment Guide

> **Document Type:** Staging Deployment Architecture, Hosting Strategy & Operational Guide  
> **Release Candidate:** Phase 12 Staging Candidate  
> **Date:** October 2026  
> **Status:** Verified Ready for Controlled Staging Deployment

---

## 1. Pre-Deployment Audit Summary

Before preparing the staging deployment, an empirical audit of the unified repository was conducted:

| Audit Parameter | Verified Status | Evidence |
|-----------------|-----------------|----------|
| **Git Working Tree** | Clean & Verified | All Phase 0–11 modules integrated with zero regressions. |
| **Monorepo Build** | 100% Clean | `npm run build` succeeds (`vite build` + `tsc` exit code 0). |
| **TypeScript Compilation** | 0 Errors | `npm run type-check` compiles without emit errors. |
| **ESLint Analysis** | 0 Errors | `npm run lint` passes (0 errors, 86 acceptable mock warnings). |
| **Automated Tests** | 317 / 317 Passing | 274 backend tests (13 suites) + 43 frontend tests (9 suites). |
| **Staging Smoke Tests** | 25 / 25 Passing | Tests A through L executed against built server (`backend/tests/staging_smoke.test.ts`). |
| **Database Architecture** | Dual-Mode Operational | Supports both live Supabase PostgreSQL migrations (Phases 1–8) and transactional in-memory datastore. |
| **Emergency Safety Rails** | Active & Enforced | National emergency numbers (112, 911, 108) blocked; hospital receiving desk explicitly labeled simulated. |

---

## 2. Hosting Strategy & Deployment Architecture

### 2.1 Provider Evaluation

| Provider | Suitability for Sanjivani Staging | Monthly Cost | Operational Trade-offs | Selected? |
|:---------|:---------------------------------:|:------------:|:-----------------------|:---------:|
| **Docker Compose (Local/Self-Hosted)** | **Highest** (Full control, zero cost, instant reset) | **$0** | Requires server or local runner; ideal for internal QA & staging smoke tests. | **YES (Primary Staging Baseline)** |
| **Render (Web Service + Static Site)** | **High** (Native Node.js & Docker, free/low-cost tiers) | **$0 – $7/mo** | Ephemeral file storage unless configured with Supabase / GCS; supports automated Git deployments. | **YES (Recommended Cloud Staging)** |
| **Railway (Full Stack Container)** | **High** (Auto-detects monorepo, simple secrets) | **$5/mo** (Trial available) | Fast provisioning, native PostgreSQL addon if not using Supabase. | Alternative |
| **Google Cloud Run (Serverless)** | **Enterprise** (High security, HIPAA/DPDP alignment) | **~$5 – $15/mo** | Requires Google Cloud project, IAM service account binding. | Production Pilot |

### 2.2 Selected Staging Architecture (Docker Compose / Cloud Container)

```
                       [ Evaluators / Investors ]
                                   |
                                   v
             [ Port 8080: Nginx Reverse Proxy & Static SPA ]
                    (serves React 18 production bundle)
                                   |
              +--------------------+--------------------+
              |                                         |
     Static Asset Requests                      /api/* API Requests
      (HTML, JS, CSS, SVG)                              |
                                                        v
                                        [ Port 3001: Express.js Backend ]
                                        (Node.js 20 Alpine Container)
                                                        |
                             +--------------------------+--------------------------+
                             |                          |                          |
                             v                          v                          v
                     [ Datastore Mode ]       [ AI Memory Engine ]       [ Telephony Safety ]
                     - DEMO_MODE=true         - Grounded Deterministic   - LIVE_TEST_MODE=false
                       (In-Memory Vault)        Citation Retrieval       - 112 / 911 Blocked
                     - DEMO_MODE=false        - Optional Gemini API      - Consented Allowlist Only
                       (Supabase Postgres)
```

---

## 3. Environment Separation Matrix

To ensure strict boundaries and prevent test actions from affecting clinical data:

```
+---------------------------------------------------------------------------------------------------------+
| Tier           | Target URL                | Database Provider    | Telephony Mode      | Emergency Dispatch |
+----------------+---------------------------+----------------------+---------------------+--------------------+
| Local Dev      | http://localhost:5173     | In-Memory / SQLite   | Simulated / Mocks   | STRICTLY SIMULATED |
| CI Test        | Vitest In-Process Runner  | In-Memory Datastore  | Mocks               | STRICTLY SIMULATED |
| Demo Seed      | http://localhost:5001     | In-Memory (Sharma)   | Optional Live Test* | STRICTLY SIMULATED |
| Staging        | http://localhost:8080     | Supabase Staging DB  | Disabled by default | STRICTLY SIMULATED |
| Production     | https://app.sanjivani.in  | Dedicated Supabase   | Carriers via DLT    | STRICTLY SIMULATED |
+---------------------------------------------------------------------------------------------------------+
* Live test mode only dispatches to allowlisted team recipients who provided explicit written consent.
```

---

## 4. Step-by-Step Staging Deployment Instructions

### Option A: Local / Virtual Machine Docker Compose Deployment

#### 1. Clone & Enter Repository
```bash
git clone https://github.com/your-org/sanjivani.git
cd sanjivani
```

#### 2. Prepare Environment File
```bash
cp .env.staging.example .env.staging
```
Edit `.env.staging` to configure settings:
- Keep `DEMO_MODE=true` for zero-dependency standalone staging.
- Set `FRONTEND_URL=http://localhost:8080`.
- Keep `LIVE_TEST_MODE_ENABLED=false` unless conducting an authorized telephony demonstration.

#### 3. Build & Launch Containers
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

#### 4. Verify Health Status
```bash
# Check container status
docker compose -f docker-compose.staging.yml ps

# Check backend health probe
curl -s http://localhost:3001/api/health | jq .

# Check readiness probe
curl -s http://localhost:3001/api/health/ready | jq .

# Check frontend availability
curl -I http://localhost:8080/nginx-health
```

#### 5. Access the Staging Web UI
Open your browser to: **`http://localhost:8080`**

---

### Option B: Cloud Staging Deployment (Render / Cloud Run)

#### 1. Backend Service Configuration
1. Create a new **Web Service** on Render from your Git repository.
2. Select **Docker** environment and set Dockerfile path to `Dockerfile.backend`.
3. Configure Environment Variables in the Render Dashboard:
   - `NODE_ENV=staging`
   - `PORT=3001`
   - `DEMO_MODE=true` (or configure Supabase staging credentials)
   - `FRONTEND_URL=https://sanjivani-staging.onrender.com`
   - `LIVE_TEST_MODE_ENABLED=false`
4. Set Health Check Path to: `/api/health`.

#### 2. Frontend Static / Reverse-Proxy Configuration
1. If deploying containerized: Use `Dockerfile.frontend` with build argument `VITE_API_BASE_URL=https://sanjivani-backend-staging.onrender.com`.
2. Or deploy as a Static Site with `Publish Directory: frontend/dist` and build command:
   ```bash
   npm ci && npm run build --workspace=frontend
   ```
3. Set environment variable: `VITE_API_BASE_URL=https://sanjivani-backend-staging.onrender.com`.

---

## 5. Database Migrations Deployment (When using Supabase Staging)

When `DEMO_MODE=false`, database tables must be migrated using Supabase CLI or direct SQL migration scripts:

```bash
# Install Supabase CLI if not present
npm install -g supabase

# Link to your Supabase staging project
supabase link --project-ref your-staging-project-ref

# Apply all migrations sequentially from supabase/migrations/
supabase db push
```

### Verified Migration Order
1. `20261022000001_phase1_auth_family_patient_schema.sql`
2. `20261022000002_phase2_health_documents_ocr_schema.sql`
3. `20261022000003_phase3_health_memory_summary_schema.sql`
4. `20261022000004_phase4_medication_appointments_notifications_schema.sql`
5. `20261022000005_phase5_sos_emergency_schema.sql`
6. `20261022000006_phase6_live_test_telephony_schema.sql`
7. `20261022000007_phase7_offline_sync_schema.sql`
8. `20261022000008_phase8_community_groups_assistance_schema.sql`

---

## 6. Staging Operational Checklist

Before granting access to evaluators or investors:

- [ ] Execute `backend/tests/staging_smoke.test.ts` to confirm Tests A through L pass.
- [ ] Verify `GET /api/health` returns `status: "ok"`.
- [ ] Verify `GET /api/health/ready` returns `database: "in_memory_datastore"` or `"supabase_connected"`.
- [ ] Verify `POST /api/demo/seed` initializes the synthetic Sharma family.
- [ ] Verify `POST /api/demo/families/:familyId/patients/:patientId/reset` successfully resets active demo incidents.
- [ ] Verify that attempting to register `112` or `911` into live test mode fails with HTTP 400.
- [ ] Verify that non-family community members receive HTTP 403 when requesting family medical records.

---

*Certified for Sanjivani Staging Deployment — October 2026.*
