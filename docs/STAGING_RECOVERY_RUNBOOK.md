# Sanjivani (Health Memory Agent) — Staging Recovery & Troubleshooting Runbook

> **Document Type:** Operational Incident Response, Disaster Recovery & Troubleshooting Guide  
> **Release Candidate:** Phase 12 Staging Candidate  
> **Audience:** DevOps Engineers, System Administrators & Demonstration Operators  
> **Date:** October 2026

---

## 1. Quick Emergency Triage Cheatsheet

```bash
# 1. Check container health status
docker compose -f docker-compose.staging.yml ps

# 2. Inspect backend error logs
docker compose -f docker-compose.staging.yml logs backend --tail 100

# 3. Test liveness probe
curl -i http://localhost:3001/api/health

# 4. Test readiness probe
curl -i http://localhost:3001/api/health/ready

# 5. Reset synthetic demonstration environment (if in demo mode)
curl -X POST http://localhost:3001/api/demo/families/:familyId/patients/:patientId/reset \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

---

## 2. Detailed Remediation Procedures for 12 Failure Modes

---

### Failure Mode 1: Application Startup Failure

- **Symptoms:** Container exits immediately with status `1` or `137`; `docker ps` shows container in restart loop.
- **Root Causes:** Port conflict (3001 or 8080 already in use); syntax error in configuration; Node version mismatch (<18.0.0); Out-Of-Memory (OOM).
- **Diagnostics:**
  ```bash
  # Check exit reason and crash traceback
  docker compose -f docker-compose.staging.yml logs backend --tail 50
  # Check if port 3001 is already bound on host
  lsof -i :3001 || netstat -tuln | grep 3001
  ```
- **Remediation:**
  1. If port is occupied: change host port mapping in `docker-compose.staging.yml` (e.g., `"3002:3001"`).
  2. If OOM occurred: increase Docker memory allocation to at least 1GB.
  3. Rebuild and restart:
     ```bash
     docker compose -f docker-compose.staging.yml down
     docker compose -f docker-compose.staging.yml up -d --build
     ```

---

### Failure Mode 2: Missing Environment Variables

- **Symptoms:** Server startup crashes with log message: `[Config] Missing required environment variable: KEY`.
- **Root Causes:** Missing `.env.staging` file; variable omitted when transitioning from `DEMO_MODE=true` to `DEMO_MODE=false`.
- **Diagnostics:**
  Inspect `backend/src/config/env.ts` lines 17–27 (`requireEnv` validator).
- **Remediation:**
  1. Compare your active `.env.staging` against `.env.staging.example`.
  2. If running without Supabase, ensure `DEMO_MODE=true` is set.
  3. If running in production mode (`NODE_ENV=production`), ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are all populated. Remember: `DEMO_MODE=true` is strictly disallowed in production.

---

### Failure Mode 3: Database Connectivity Failure

- **Symptoms:** API endpoints return `500 Internal Server Error`; `/api/health/ready` returns `database: disconnected` (HTTP 503).
- **Root Causes:** Supabase project paused or IP allowlist blocking traffic; network interruption; invalid service role key; database pool exhaustion.
- **Diagnostics:**
  ```bash
  # Check readiness probe output
  curl -s http://localhost:3001/api/health/ready | jq .
  ```
- **Remediation:**
  1. In Supabase Dashboard: verify project is **Active** (not paused due to free tier inactivity).
  2. Verify database connection string and SSL requirements (`sslmode=require`).
  3. If Supabase is unreachable and a demonstration is imminent: temporarily switch to `DEMO_MODE=true` in `.env.staging` and restart backend. This activates the transactional in-memory datastore with zero downtime.

---

### Failure Mode 4: Private Storage Failure

- **Symptoms:** Document upload fails with `500 Error` or `Storage upload failed`; document download returns `404 Not Found`.
- **Root Causes:** Supabase storage bucket `medical-records` does not exist or has incorrect RLS policies; storage quota exceeded; file exceeds 25MB limit.
- **Diagnostics:**
  ```bash
  # In Supabase SQL Editor:
  SELECT * FROM storage.buckets WHERE name = 'medical-records';
  ```
- **Remediation:**
  1. Ensure bucket `medical-records` is created and marked **private** (Public: false).
  2. Verify migration `20261022000002_phase2_health_documents_ocr_schema.sql` ran to apply storage RLS policies.
  3. If using in-memory mode, verify node process has sufficient heap memory to buffer uploaded file streams.

---

### Failure Mode 5: Authentication Configuration Errors

- **Symptoms:** Login returns `401 Unauthorized` for known credentials; token validation fails with `Invalid token signature`.
- **Root Causes:** Clock drift between servers (>5 minutes); mismatched `SUPABASE_JWT_SECRET`; corrupted session storage in browser.
- **Diagnostics:**
  ```bash
  # Check server time synchronization
  curl -s http://localhost:3001/api/health | jq .timestamp
  date -u
  ```
- **Remediation:**
  1. Synchronize host clock via NTP (`ntpdate -u pool.ntp.org` or systemd-timesyncd).
  2. Clear browser `sessionStorage`:
     ```javascript
     sessionStorage.removeItem('sanjivani_auth_token');
     ```
  3. Re-login using staging credentials from `docs/STAGING_DEMO_RUNBOOK.md`.

---

### Failure Mode 6: OCR Provider Failure

- **Symptoms:** Upload completes but OCR fields remain blank or extraction status is `failed`.
- **Root Causes:** Uploaded image is corrupted or has unsupported MIME type; `tesseract.js` worker crash under heavy load; digital PDF has non-extractable raster layers without fallback.
- **Diagnostics:**
  Inspect backend log for `[DocumentService] OCR extraction failed`.
- **Remediation:**
  1. Ensure uploaded document is valid PNG, JPEG, WebP, or text-embedded PDF.
  2. Sanjivani provides built-in graceful degradation: if automated OCR cannot extract text, the document review status is set to `needs_review` with empty proposed fields, allowing the user to manually enter prescription items.

---

### Failure Mode 7: AI Provider Failure (Gemini API)

- **Symptoms:** AI Health Memory query takes >15 seconds or returns `AI service temporarily unavailable`.
- **Root Causes:** Gemini API key quota exhausted, invalid key, or network timeout to Google servers.
- **Diagnostics:**
  ```bash
  # Check Gemini API key configuration
  curl -s http://localhost:3001/api/health/ready | jq .
  ```
- **Remediation:**
  1. Sanjivani includes a **deterministic clinical grounding fallback engine** in `backend/src/integrations/ai/aiService.ts`.
  2. If Gemini API is offline or unconfigured, the fallback engine automatically parses confirmed medical records, extracts dosages and lab values, and generates grounded responses with exact source citations.
  3. Zero presentation impact: The UI displays grounded citations without showing an error to the user.

---

### Failure Mode 8: Background Worker / Job Failure

- **Symptoms:** Dose occurrences are not generated; appointment reminder notifications are delayed.
- **Root Causes:** Scheduled job crashed or timeout expired; duplicate job lock contention.
- **Diagnostics:**
  Inspect backend log for `[MedicationService] Dose occurrence generation error`.
- **Remediation:**
  1. Trigger manual dose generation via API:
     ```bash
     POST /api/families/:familyId/medications/doses/generate
     Body: {"patientProfileId": "<ID>", "daysAhead": 7}
     ```
  2. Verify system time matches UTC timezone.

---

### Failure Mode 9: Notification Provider Failure (Telephony)

- **Symptoms:** Live test SMS is not delivered; carrier returns error code.
- **Root Causes:** Twilio account balance exhausted; carrier DLT template unregistered in India; invalid recipient phone format.
- **Diagnostics:**
  Inspect `backend/src/services/liveTestService.ts` audit logs for `LIVE_TEST_FAILED`.
- **Remediation:**
  1. Verify recipient phone number uses E.164 format (`+919876543210`).
  2. Verify recipient is registered on the allowlist with `consentGiven: true`.
  3. In Staging, live telephony is optional. If provider is offline, the application gracefully operates in `LIVE_TEST_TELEPHONY_PROVIDER=mock`, simulating delivery with tamper-evident audit logs.

---

### Failure Mode 10: Database Migration Errors

- **Symptoms:** `supabase db push` fails with SQL syntax error or `relation already exists`.
- **Root Causes:** Manual table schema modifications; out-of-order migration execution; migration script modified after previous application.
- **Diagnostics:**
  ```bash
  supabase migration list
  ```
- **Remediation:**
  1. Never edit an already-applied migration file.
  2. Always add a new numbered migration: `YYYYMMDDHHMMSS_description.sql`.
  3. If staging database state is corrupt:
     ```bash
     # Reset staging database to clean state
     supabase db reset
     ```

---

### Failure Mode 11: Failed Staging Deployment & Rollback

- **Symptoms:** New build fails smoke tests; frontend cannot communicate with backend API.
- **Root Causes:** Breaking API schema change; missing migration; reverse proxy misconfiguration.
- **Remediation (Instant Rollback):**
  1. Rollback container images to previous release tag:
     ```bash
     docker compose -f docker-compose.staging.yml down
     # Point compose file to previous stable tag (e.g., :rc1-backup)
     docker compose -f docker-compose.staging.yml up -d
     ```
  2. If git-based deployment:
     ```bash
     git checkout tags/v0.11.0-rc1
     npm run build
     npm run start
     ```

---

### Failure Mode 12: Restoring the Synthetic Demonstration Environment

- **Symptoms:** Evaluator pressed SOS button during practice, and active incident blocks new demonstration triggers (HTTP 409 Conflict).
- **Safety Rule:** Never perform destructive reset or restoration operations against production records.
- **Remediation:**
  Execute isolated scenario reset:
  ```bash
  # Cleanly resets active SOS incidents and dose logs for the demo patient:
  curl -s -X POST "http://localhost:3001/api/demo/families/$FAMILY_ID/patients/$PATIENT_ID/reset" \
    -H "Authorization: Bearer $OWNER_TOKEN" | jq .
  ```
  This immediately sets any open incident to `CANCELLED` and clears unconfirmed doses, restoring the demonstration scenario to a pristine state in <100ms.

---

*Certified for Sanjivani Staging Incident Response — October 2026.*
