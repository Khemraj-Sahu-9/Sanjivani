# PHASE 10 — BACKUP, RESTORATION & DISASTER RECOVERY PLAN

> **Sanjivani (Health Memory Agent)**  
> **Document:** Business Continuity, Backup Architecture, and Disaster Recovery Runbook  
> **Target Standards:** ISO/IEC 27001 Annex A.12.3, HIPAA Security Rule § 164.308(a)(7)  
> **Date:** October 2026  

---

## 1. Recovery Objectives (RTO & RPO)

In accordance with healthcare application reliability standards, Sanjivani sets strict Recovery Point and Recovery Time Objectives:

| Metric | Target | Description & Measurement |
| :--- | :---: | :--- |
| **Recovery Point Objective (RPO)** | **< 5 Minutes** | Maximum acceptable data loss interval in the event of an catastrophic failure. Achieved via continuous Write-Ahead Log (WAL) archiving. |
| **Recovery Time Objective (RTO)** | **< 30 Minutes** | Maximum allowable downtime from disaster declaration to restored user operations. |
| **Storage Object RPO** | **0 Minutes** | Enabled via object versioning and multi-region replication. |

---

## 2. Relational Database Backup Strategy (PostgreSQL / Supabase)

### 2.1 Point-in-Time Recovery (PITR)
- **Continuous WAL Archival:** Every database transaction write-ahead log is streamed to encrypted object storage.
- **Retention Period:** 30 days of continuous rollback capability in production; 7 days in staging.
- **Daily Automated Physical Snapshots:** Taken at 02:00 IST every 24 hours.

### 2.2 Logical Backup Script (`pg_dump`)
In addition to cloud provider PITR, daily logical schema and encrypted data dumps are archived to an isolated backup bucket:
```bash
# Automated Daily Logical Backup Job
pg_dump -h db.supabase.co -U postgres -d postgres \
  --format=custom \
  --file=/backups/sanjivani_$(date +%Y%m%d_%H%M%S).dump

# Encrypt backup with recipient public key
gpg --encrypt --recipient ops@sanjivani.health /backups/sanjivani_*.dump
```

---

## 3. Storage Bucket Replication & Interrupted Upload Recovery

### 3.1 Object Versioning & Lifecycle Rules
- **Versioning Enabled:** Overwrites or deletions in the `medical-records` bucket create noncurrent versions, preventing accidental permanent deletion.
- **Cross-Region Bucket Replication:** In production, files are replicated from Asia-South1 (Mumbai) to Asia-South2 (Delhi) asynchronously within 15 minutes.

### 3.2 Resilient Upload Pipeline
- **Interrupted File Uploads:** Uploads use chunked resumable protocols or multipart uploads. Unfinished multipart sessions older than 24 hours are automatically aborted to free bucket storage.
- **Deduplication Checksum Invariant:** Every document record stores a SHA-256 hash. If an upload is retried after a network drop, the server checks the hash and reconciles the record without duplicate storage consumption.

---

## 4. Offline Sync Queue Replay & Conflict Recovery

### 4.1 Idempotent Transaction Replay
- Every offline mutation generated on the client has a unique client UUID (`operation_id`).
- When a client reconnects and replays its queue, the server sync endpoint (`POST /api/sync`) checks previously committed `operation_id` records in the `sync_operations` audit table.
- Duplicate replays return the previously calculated result without executing mutations twice.

### 4.2 Stale Mutation Rollback
- If a client attempts to update a medication schedule or patient record that was modified by another caregiver while the client was offline, an optimistic locking conflict (`version` mismatch) is triggered.
- The server rejects the stale update with HTTP 409 Conflict, preserves the authoritative server state, and sends the updated entity back to the client to update local IndexedDB.

---

## 5. Disaster Recovery Runbook (Step-by-Step Restoration)

```
[Incident Declared] ---> [1. DNS Failover to Maintenance]
                                  |
                                  v
                      [2. Database PITR Restoration]
                                  |
                                  v
                      [3. Storage Bucket Link Verification]
                                  |
                                  v
                      [4. Health Check & Route Verification]
                                  |
                                  v
                      [5. Live Traffic Rerouted (DNS Active)]
```

### Step 1: Activate Maintenance Mode
Route edge CDN / Cloudflare traffic to a static maintenance page:
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_online" \
  -H "Authorization: Bearer $CF_API_KEY" -d '{"value":"on"}'
```

### Step 2: Restore PostgreSQL to Target Timestamp
In Supabase dashboard or via CLI:
```bash
supabase projects restore --timestamp "2026-10-22T21:45:00Z"
```

### Step 3: Verify Integrity & Rerun Migrations
Verify schema migrations from `supabase/migrations/` to guarantee schema coherence:
```bash
npm run type-check:backend
npm run test:backend
```

### Step 4: Re-enable Traffic & Monitor Observability
Disable maintenance mode, verify `/api/health/ready` returns HTTP 200, and monitor Sentry/Cloud Logging for error spikes.
