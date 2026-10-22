# OFFLINE_SYNC.md — Sanjivani Offline-First & Synchronization Architecture

> **Phase 7 Specification & Implementation Guide**  
> Covers local data storage, operation queueing, service worker caching, conflict resolution, and security safeguards.

---

## 1. Overview & Core Philosophy

**Sanjivani** uses an **offline-first, server-authoritative** architecture. The authoritative database (PostgreSQL via Supabase) remains the single source of truth for medical records, access permissions, and medication schedules.

Local browser persistence (IndexedDB) provides high-performance cached viewing and resilient change queueing when network connectivity is lost, intermittent, or high-latency.

---

## 2. Operation Classification

Not all medical operations can be safely performed offline. Operations are explicitly categorized into four tiers:

| Tier | Operation | Offline Support | Behavior When Offline |
|---|---|---|---|
| **Tier 1: Supported Offline (Queued)** | `PATIENT_UPDATE` | Full | Persisted locally in IndexedDB; queued in `sync_queue` with client ID & base revision. |
| **Tier 1: Supported Offline (Queued)** | `APPOINTMENT_CREATE` | Full | Stored in IndexedDB; queued for server creation upon reconnect. |
| **Tier 1: Supported Offline (Queued)** | `APPOINTMENT_UPDATE` | Full | Revalidated on server; cancelled appointments rejected. |
| **Tier 1: Supported Offline (Queued)** | `MEDICATION_DOSE_RECORD` | Full | Recorded as discrete, timestamped dose occurrence. Prevents schedule clobbering. |
| **Tier 1: Supported Offline (Queued)** | `MEDICATION_SCHEDULE_CREATE`| Full | Stored in offline queue; idempotent write on reconnection. |
| **Tier 1: Supported Offline (Queued)** | `DOCUMENT_UPLOAD` | Full (File Stored) | File stored in IndexedDB `document_files` blob store; uploaded & OCR-queued when online. |
| **Tier 2: Read-Only Offline** | Patient Health Summary | Cached View | Displays previously downloaded health snapshot with clear "Cached Copy" indicator. |
| **Tier 2: Read-Only Offline** | Doctor Summaries & Timeline | Cached View | Accessible if previously fetched; source references linked. |
| **Tier 2: Read-Only Offline** | Downloaded Original Docs | Cached Files | Available only if explicitly downloaded to device. Uncached files clearly show "Requires Internet". |
| **Tier 3: Requires Connectivity** | AI Health Memory Chat | Online Only | Clear UI message: *"AI Health Memory requires an active internet connection to query documents."* |
| **Tier 3: Requires Connectivity** | Hospital SOS & Telephony | Online Only | Clear UI message: *"Live emergency calls and hospital handoff require connectivity. If in danger, dial 112 directly."* |
| **Tier 4: Server-Enforced Only** | Permission Grants / Revocation | Online Only | Modifying family member roles or granting caregiver access requires immediate server authorization. |

---

## 3. PWA & Service Worker Caching Strategy

```
Browser Request
   │
   ├── /api/* ─────────────────────────► NETWORK ONLY (Bypasses Service Worker Cache)
   │                                     Private medical records, JWT tokens, and signed URLs
   │                                     are NEVER stored in CacheStorage.
   │
   ├── Navigation (HTML) ──────────────► Network-First with Offline Fallback to /index.html
   │
   └── Static Assets (JS, CSS, SVG) ───► Stale-While-Revalidate from 'sanjivani-shell-v1'
```

### Key Service Worker Rules:
1. **Zero Clinical Data in CacheStorage**: Only application shell assets (`/index.html`, bundles, favicon, manifest) are cached in CacheStorage.
2. **Private Data Isolation**: All medical records and snapshots live strictly within the user-partitioned IndexedDB store (`sanjivani_offline_db`).

---

## 4. Local Storage (IndexedDB) Architecture

Database: `sanjivani_offline_db` (Version 1)

### Object Stores:
1. `patient_snapshots`: Keyed by `${userId}:${patientId}`. Stores demographic summary, Health ID, and confirmed history.
2. `document_snapshots`: Keyed by `${userId}:${documentId}`. Stores metadata and `is_downloaded_offline` flag.
3. `document_files`: Keyed by `${userId}:${documentId}`. Stores raw ArrayBuffer/Blob for explicitly downloaded files.
4. `appointment_snapshots`: Keyed by `${userId}:${appointmentId}`.
5. `medication_snapshots`: Keyed by `${userId}:${scheduleId}`.
6. `dose_snapshots`: Keyed by `${userId}:${doseId}`.
7. `sync_queue`: Keyed by `clientOperationId`. Stores pending operations and retry state.
8. `sync_metadata`: Keyed by `${userId}:${familyId}`. Stores last sync timestamp and heartbeat state.

---

## 5. Conflict Resolution Strategy

Sanjivani strictly rejects blanket "Last Write Wins" (LWW) for clinical data.

```
Client Submits Queued Operation with baseRevision
                      │
        Server checks updated_at > baseRevision?
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
          NO                    YES
     Apply update       Diff Edited Fields
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
            Disjoint Fields       Same Field Modified
             Auto-Merge Cleanly    Create SyncConflict Record
             Status: 'synced'      Status: 'conflict'
                                          │
                                 Surfaced in UI for
                                 Human Reconciliation
```

### Conflict Resolution Choices:
1. **Keep Device Version (`resolved_client`)**: Applies local offline edit to server entity.
2. **Keep Server Version (`resolved_server`)**: Retains server authoritative state; marks conflict resolved.
3. **Merge Changes (`resolved_merged`)**: Applies human-reviewed combination of fields.

### Specific Safeguards:
- **Cancelled Appointments**: If an appointment was cancelled on the server while the client was offline, an offline update will NOT silently revive it. It is rejected with `errorCategory: 'conflict'`.
- **Discontinued Medications**: Dose occurrences cannot be recorded against discontinued schedules.
- **Discrete Dose Logging**: Dose acknowledgements are stored as discrete timestamped occurrences rather than overwriting schedule records.

---

## 6. Server-Side Idempotency & Duplicate Prevention

Every queued operation generated by the client includes:
- `clientOperationId`: Client UUID
- `idempotencyKey`: Unique string (`idem_${clientOperationId}`)

On the server:
- `sync_operations` table enforces `UNIQUE(family_id, idempotency_key)` and `UNIQUE(family_id, client_operation_id)`.
- If an operation with the same idempotency key was previously processed, the server returns the cached response with `status: 'synced'`. No duplicate database side-effects occur.

---

## 7. Security, Account Isolation & Storage Limits

1. **User Partitioning**: All IndexedDB keys are prefixed by `userId`. Users on shared devices cannot view each other's cached records.
2. **Sign-out Cleanup**: Calling `logout()` triggers `offlineStorage.clearUserData(user.id)`, wiping local patient snapshots, medication records, and completed sync items from IndexedDB.
3. **Storage Quota & Eviction**:
   - `navigator.storage.estimate()` monitors storage consumption.
   - Storage gauge and "Clear Local Cache" button in Sync Dashboard allow manual cleanup.
4. **Offline Revocation Limitation**: An offline device cannot immediately know that a caregiver's permissions were revoked on the server. When connectivity returns, the server re-validates permissions on every sync write and rejects unauthorized actions with HTTP 403 / `errorCategory: 'auth'`.
