# PHASE 10 — DEPLOYMENT, MONITORING & OPERATIONAL HARDENING GUIDE

> **Sanjivani (Health Memory Agent)**  
> **Document:** Production Deployment Architecture, Secret Management, and Observability  
> **Status:** Production-Ready Hardening Specification  
> **Date:** October 2026  

---

## 1. Environment Separation Architecture

To prevent test data from contaminating clinical environments and ensure strict security boundaries, Sanjivani establishes five distinct deployment tiers:

```
+---------------------------------------------------------------------------------------+
|  Environment   | Primary Purpose          | Database Mode      | Integrations         |
+----------------+--------------------------+--------------------+----------------------+
|  Development   | Local Feature Dev        | In-Memory / SQLite | Mocks (No real SMS)  |
|  Testing (CI)  | Automated CI Vitest      | In-Memory DB       | Strict Mocks         |
|  Demo Mode     | Investor / Pitch Demos   | In-Memory (Seeded) | Twilio/Exotel Live*  |
|  Staging       | Pre-pilot & QA           | Supabase Staging   | ABDM Sandbox + Mocks |
|  Production    | Controlled Pilot Trials  | Supabase Dedicated | ABDM + Telephony DLT |
+---------------------------------------------------------------------------------------+
* Only to allowlisted team test recipients with written consent.
```

### Environment Invariants
1. `NODE_ENV=production` **strictly forbids** `DEMO_MODE=true`. Startup will intentionally crash if both flags are present.
2. In production, Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) are mandatory.
3. Live Telephony is enabled only when `LIVE_TEST_MODE_ENABLED=true` and explicit recipient allowlists are configured.

---

## 2. Secrets Management & Key Lifecycle

Under Section 5 of `AGENTS.md`, secrets are never committed to version control, hardcoded in source files, or logged to outputs.

### 2.1 Production Secret Store Hierarchy
- **Cloud Runtime:** Google Cloud Secret Manager or AWS Secrets Manager.
- **Environment Ingestion:** Secrets injected as container environment variables at runtime through Kubernetes Secrets or Cloud Run service bindings.
- **Validation:** Validated at application boot via `backend/src/config/env.ts` with fail-fast Zod/string schemas.

### 2.2 Key Rotation Procedures
| Secret | Rotation Frequency | Impact & Zero-Downtime Strategy |
| :--- | :--- | :--- |
| **Supabase JWT Secret** | 180 Days | Regenerate via Supabase dashboard; update backend env; existing tokens expire within 1 hour. |
| **Supabase Service Key** | 90 Days | Generate secondary service key, update backend config, verify connectivity, revoke old key. |
| **Gemini API Key** | 90 Days | Provision new key in Google AI Studio, update secret manager, zero downtime. |
| **Twilio / Exotel Auth Token** | 90 Days | Dual-key rotation supported on carrier developer console. |
| **Hospital Gateway API Key** | Per Hospital SLA | Coordinated rotation with hospital IT receiving desk administration. |

---

## 3. Containerization & Deployment Topologies

### 3.1 Recommended Production Architecture (Google Cloud Platform)
```
       [Cloudflare / Cloud Armor WAF]
                    |
                    v
       [Global Cloud Load Balancer (TLS 1.3)]
         /                             \
        v                               v
[Cloud Run: Frontend SPA]      [Cloud Run: Backend API (Auto-scaled)]
(Vite Nginx dist container)              |
                                         +---> [Supabase PostgreSQL (mTLS)]
                                         +---> [Google Cloud Storage / Supabase]
                                         +---> [Google Gemini 1.5 Pro API]
                                         +---> [Exotel DLT SMS Gateway]
```

### 3.2 Backend Dockerfile Specification
```dockerfile
# Multi-stage production build for Sanjivani Backend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --workspace=backend
COPY backend/ ./backend/
RUN npm run build --workspace=backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN apk add --no-cache curl
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --workspace=backend --only=production
COPY --from=builder /app/backend/dist ./backend/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "backend/dist/server.js"]
```

---

## 4. Health Checks, Readiness & Liveness Probes

Sanjivani provides three dedicated operational observability endpoints:

1. **Liveness Probe (`GET /api/health`):**
   - Returns HTTP 200 `{ status: "ok", timestamp }`
   - Validates that the Node event loop is responsive.
2. **Readiness Probe (`GET /api/health/ready`):**
   - Verifies database connectivity, memory usage, and repository initialization.
   - Returns HTTP 200 `{ ready: true, database: "connected" }` or HTTP 503 if disconnected.
3. **Hospital Gateway Health (`GET /api/pilot/hospital/health`):**
   - Actively reports emergency receiving gateway connectivity and mode (`simulated` vs `live`).

---

## 5. Structured Logging & PII Masking Rules

### 5.1 JSON Log Format
All server output is formatted as structured JSON streamed to `stdout` for ingestion by CloudWatch, Google Cloud Logging, or Datadog:
```json
{
  "timestamp": "2026-10-22T22:30:15.120Z",
  "level": "info",
  "correlationId": "req_8f192b01",
  "method": "POST",
  "path": "/api/families/fam_1/documents",
  "status": 200,
  "durationMs": 142
}
```

### 5.2 Strict PII Sanitization Checklist
Under the DPDP Act 2023, personal health data must never leak into operational logs:
- **Phone Numbers:** Mask all but the last 4 digits (e.g., `+91XXXXXX9824`).
- **Medical Text / Extractions:** Never log raw OCR text, diagnoses, or prescription dosage lines to application stdout.
- **Auth Tokens:** Authorization header is explicitly stripped from request logger output.
- **Passwords:** Never printed or returned in error payloads.
