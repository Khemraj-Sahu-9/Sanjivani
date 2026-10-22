# Architecture — Health Memory Agent

**Version:** 0.1 (Phase 0)  
**Last Updated:** Phase 0 — Initial Setup

---

## 1. System Overview

Health Memory Agent is organized as a monorepo containing a React frontend, an Express.js backend, and Supabase-managed database infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (User)                        │
│                   React + TypeScript SPA                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express.js Backend                        │
│              Node.js + TypeScript + REST API                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Routes  │→ │Controllers│→ │ Services │→ │  Repos   │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                   │          │
│              ┌────────────────────────────────────┘          │
│              ▼                                               │
│   ┌──────────────────────┐  ┌─────────────────────────────┐ │
│   │  Supabase Client     │  │    Integrations (future)    │ │
│   │  (service-role key)  │  │  OCR / AI / SMS / Voice     │ │
│   └──────────────────────┘  └─────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ PostgreSQL (SSL)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                             │
│         PostgreSQL  │  Auth  │  Storage  │  Realtime        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

The project uses **npm workspaces**:

```
health-memory-agent/
├── frontend/      (workspace: frontend)
├── backend/       (workspace: backend)
├── supabase/      (database migrations and config — not a workspace)
├── docs/
└── package.json   (root workspace config)
```

A `packages/shared` workspace will be added in a future phase when types need to be shared between frontend and backend.

---

## 3. Frontend Architecture

### Technology
- React 18 with TypeScript (strict mode)
- Vite 5 for bundling and development server
- React Router v6 for client-side routing
- CSS Modules + CSS Custom Properties for styling

### Directory Responsibilities

```
frontend/src/
├── app/           # Router, providers, global app bootstrap
├── components/
│   ├── ui/        # Stateless, reusable UI primitives
│   └── layout/    # Page shells and navigation
├── features/      # Feature-specific modules (self-contained)
│   └── <feature>/ # Each feature owns: components, hooks, types, services
├── hooks/         # Shared custom React hooks
├── lib/           # Third-party library configs (API client, Supabase)
├── services/      # Frontend API call functions
├── types/         # Shared TypeScript types
└── styles/        # Global CSS, design tokens
```

### Feature Module Pattern

Each product feature lives in `features/<feature-name>/` and contains:
- `components/` — feature-specific React components
- `hooks/` — feature-specific hooks
- `services/` — feature-specific API calls
- `types.ts` — feature-specific TypeScript types

This prevents large cross-feature dependencies and makes features independently testable.

### API Communication

The frontend communicates with the backend through a typed API client configured in `lib/apiClient.ts`. The base URL is set via the `VITE_API_BASE_URL` environment variable.

**The frontend NEVER accesses Supabase with the service-role key.** Public Supabase operations (future: real-time subscriptions, direct auth) use the anon/public key only.

---

## 4. Backend Architecture

### Technology
- Node.js with Express.js
- TypeScript (strict mode)
- Supabase JS client (server-side, service-role key)

### Request Lifecycle

```
HTTP Request
    │
    ▼
Express Router  (routes/)
    │  Registers handler + middleware chain
    ▼
Request Middleware  (middlewares/)
    │  Auth validation, request logging, input parsing
    ▼
Validator  (validators/)
    │  Schema validation (Zod)
    ▼
Controller  (controllers/)
    │  Thin: parse → call service → respond
    ▼
Service  (services/)
    │  Business logic, orchestration
    ▼
Repository  (repositories/)
    │  Database queries — only place DB is accessed
    ▼
Supabase PostgreSQL
```

### Error Handling

All errors propagate to the centralized `errorHandler` middleware in `middlewares/errorHandler.ts`. This ensures:
- Consistent error response format
- No stack traces leaked to clients in production
- Structured error logging

### Configuration

All environment variables are loaded and validated in `config/env.ts`. The exported `config` object is the single source of truth for application configuration. No other file reads `process.env` directly.

---

## 5. Database Architecture

### Primary Database
**PostgreSQL via Supabase** — single database, no secondary databases.

### Access Strategy

| Operation Type | Access Method | Key Used |
|---------------|---------------|----------|
| Backend privileged operations | Supabase JS client in repositories/ | Service-role key (server-side only) |
| Future: Frontend auth operations | Supabase Auth client | Anon/public key |
| Future: Frontend real-time | Supabase Realtime client | Anon/public key |

### Row Level Security (RLS)

Every table will have RLS enabled. RLS policies enforce that:
- Users can only access their own data
- Family members can access shared records only within their family group
- No cross-family data leakage is possible at the database level

RLS is a defense-in-depth layer supplementing server-side authorization checks.

### Migration Strategy

All schema changes are version-controlled migrations in `supabase/migrations/`:
- File naming: `YYYYMMDDHHMMSS_description.sql`
- Migrations are additive where possible
- Destructive changes require explicit documentation
- Local testing with `supabase db reset` before committing

### Planned Schema (Phase 1+)

The full schema design is documented in `docs/DATABASE_SCHEMA.md`. Phase 0 does not create any application tables.

---

## 6. Authentication Architecture (Phase 1 — Not Yet Implemented)

**Planned approach:** Supabase Auth with JWT tokens.

```
User logs in
    │
    ▼ (frontend)
Supabase Auth (email/password or OAuth)
    │  Returns: access_token (JWT), refresh_token
    ▼
Frontend stores token (memory or httpOnly cookie — TBD in Phase 1)
    │
    ▼ (API request)
Bearer token sent in Authorization header
    │
    ▼ (backend)
Auth middleware validates JWT with Supabase
    │  Extracts user ID and role
    ▼
Controller / Service / Repository
    │  Uses validated user context
    ▼
Supabase (RLS uses authenticated user ID from JWT)
```

**Decision to make in Phase 1:** httpOnly cookie vs. in-memory token storage. Cookie approach is more XSS-resistant; in-memory requires careful SPA lifecycle management.

---

## 7. Authorization Model (Phase 1+)

**Planned permission model:**

| Role | Description |
|------|-------------|
| `owner` | Primary account holder — full access to all family records |
| `family_member` | Added family member — access to shared records |
| `caregiver` | External caregiver — limited, explicit access grant |
| `read_only` | Viewing access only |

Authorization is enforced at two levels:
1. **Server-side middleware** — checks role before reaching controllers
2. **Database RLS policies** — enforces at the data layer as a safety net

---

## 8. Future Integration Architecture

External integrations (AI, OCR, SMS, voice) are isolated in `backend/src/integrations/`. Each integration implements a defined interface so the provider can be swapped without changing business logic.

```typescript
// Example interface pattern (to be implemented per phase)
interface OcrProvider {
  extractText(imageBuffer: Buffer): Promise<OcrResult>;
}

interface AiProvider {
  summarize(text: string): Promise<string>;
}
```

This allows:
- Easy mocking in tests
- Provider switching (e.g., Google Vision → AWS Textract)
- Clear documentation of external dependencies

---

## 9. Security Architecture

See `docs/SECURITY.md` for the full security baseline.

Key points:
- No secrets in source code
- Service-role key restricted to backend server
- Input validation on all API endpoints
- Centralized error handling with sanitized client responses
- HTTP security headers via helmet
- CORS restricted to known origins
- Future: medical record encryption at rest (Supabase Storage private buckets)

---

## 10. Key Trade-off Decisions

### 10.1 CSS Modules over a UI Component Library
**Decision:** CSS Modules with design tokens, not MUI/Chakra/shadcn.  
**Why:** No runtime JS overhead; no version-lock to a third-party design system; easy to replace in Phase 9 (UI polish). The UI shell in Phase 0 is intentionally minimal.  
**Revisit:** If a component library is needed for Phase 3+ (complex date pickers, data tables), evaluate adding shadcn/ui or Radix at that time.

### 10.2 No ORM
**Decision:** Direct Supabase client queries in repositories, not Prisma or TypeORM.  
**Why:** Supabase's JS client handles type safety through generated types; adding an ORM layer introduces additional complexity and migration tooling conflicts with Supabase's native migration system.  
**Revisit:** If query complexity grows significantly in Phase 3+, evaluate Kysely (type-safe query builder) as a middle ground.

### 10.3 Express.js over Fastify/Hono
**Decision:** Express.js.  
**Why:** Widest ecosystem, most familiar to beginners, extensive middleware support, specified in requirements.  
**Trade-off:** Slower than Fastify/Hono at high concurrency — acceptable for a healthcare record app where volume is low and correctness matters more than raw throughput.

### 10.4 Monorepo vs. Separate Repos
**Decision:** npm workspaces monorepo.  
**Why:** Simpler shared type evolution, single repository for a small team, easier cross-workspace scripts.  
**Trade-off:** Slightly more complex CI configuration — acceptable for the project scale.

---

## 11. Future Architecture Considerations

| Topic | Decision Needed In |
|-------|-------------------|
| Token storage strategy (cookie vs. memory) | Phase 1 |
| Supabase Realtime for family notifications | Phase 4 |
| Queue system for background jobs (reminders, AI) | Phase 4 |
| OCR provider selection | Phase 2 |
| AI model selection | Phase 3 |
| Offline-first strategy (service workers, local DB) | Phase 7 |
| HIPAA/privacy compliance requirements | Phase 9 |
## 12. Phase 5 SOS Emergency Response Architecture

Phase 5 introduces a server-controlled emergency response simulation architecture designed for deterministic, repeatable demonstration of emergency assistance without any real external communications.

```
┌────────────────────────────────────────────────────────────────────────┐
│               Frontend: EmergencyDashboard.tsx                         │
│  - Persistent DEMO MODE warning banner                                │
│  - SOS Trigger button & Status Stepper                                │
│  - Family acknowledgement controls ("I am responding", etc.)          │
│  - Caregiver escalation card & controls                               │
│  - Fictional Hospital Receiving Desk Modal                            │
│  - Live Event Timeline & Demo Control Panel                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Backend SOS Engine                                   │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   sosController.ts    │  │        emergencyContactService.ts     │  │
│  └───────────┬───────────┘  └───────────────────┬───────────────────┘  │
│              ▼                                  │                      │
│  ┌──────────────────────────────────────────────▼───────────────────┐  │
│  │                  sosService.ts (State Machine)                   │  │
│  │  - Transitions: CREATED -> AWAITING_FAMILY_RESPONSE              │  │
│  │    -> ESCALATING_CAREGIVER -> HOSPITAL_HANDOFF_SIMULATED         │  │
│  │    -> RESOLVED / CANCELLED                                       │  │
│  │  - Idempotent duplicate protection (HTTP 409)                    │  │
│  │  - Synthetic Emergency Summary Packet compiler                   │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│  ┌───────────────────────────────▼──────────────────────────────────┐  │
│  │      reminderScheduler.ts (Background Worker)                    │  │
│  │  - Executes 'sos_family_timeout' and 'sos_caregiver_timeout'      │  │
│  │  - Durable execution across server process restarts              │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│  ┌───────────────────────────────▼──────────────────────────────────┐  │
│  │          Database Repository (Dual-Mode: Supabase / In-Memory)    │  │
│  │  - emergency_incidents & emergency_incident_events               │  │
│  │  - emergency_contacts & emergency_escalation_policies            │  │
│  │  - emergency_contact_attempts & hospital_handoffs                │  │
│  │  - Simulation Provenance: 'DEMO_SIMULATION_ONLY'                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Phase 6 Live Test Mode & Telephony Integration Architecture

Phase 6 extends the emergency subsystem with a strictly guarded **Live Test Mode** capable of sending real, labelled test SMS and placing automated voice calls exclusively to verified, allowlisted, consenting team members while ensuring remaining escalations remain simulated.

```
┌────────────────────────────────────────────────────────────────────────┐
│               Frontend: EmergencyDashboard.tsx & Modals                │
│  - Mode Indicators: DEMO MODE vs. LIVE TEST MODE                       │
│  - LiveTestRecipientManager.tsx: Verified member onboarding & consent  │
│  - LiveTestPreflightModal.tsx: Mandatory operator authorization screen │
│  - Real-time Live Provider Dispatches Card & Human Ack Button          │
│  - Timeline badges: LIVE_PROVIDER vs. HUMAN_ACK vs. SIMULATED          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Backend Live Test Engine                             │
│  ┌─────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │   liveTestController.ts │   │   telephonyRouter.ts (Webhooks)     │ │
│  └────────────┬────────────┘   └──────────────────┬──────────────────┘ │
│               ▼                                   │                    │
│  ┌────────────────────────────────────────────────▼──────────────────┐ │
│  │                     liveTestService.ts                            │ │
│  │  - Allowlist Verification & Explicit Consent Tracking             │ │
│  │  - Strict Rejection of Fictional Demo & 112 Emergency Numbers     │ │
│  │  - Safety Caps (Max 3 recipients) & Rate Limit Cooldown           │ │
│  │  - Preflight Inspection & Exact Script Preview                    │ │
│  │  - Cryptographic Signature Verification & Idempotency Cache       │ │
│  └────────────────────────────┬──────────────────────────────────────┘ │
│                               │                                        │
│  ┌────────────────────────────▼──────────────────────────────────────┐ │
│  │          Pluggable Telephony Integration Layer                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                 ITelephonyProvider Interface                 │ │ │
│  │  └──────────────┬──────────────────┬─────────────────┬──────────┘ │ │
│  │                 ▼                  ▼                 ▼            │ │
│  │       TwilioProvider.ts     ExotelProvider.ts  MockProvider.ts    │ │
│  │       (Global / India)      (Indian DLT TRAI)  (Offline Tests)    │ │
│  │       - TwiML Polly Voice   - Header & Temp.   - Zero Network     │ │
│  │       - HMAC-SHA1 Webhook   - Token Auth       - Deterministic    │ │
│  └────────────────────────────┬──────────────────────────────────────┘ │
│                               │                                        │
│  ┌────────────────────────────▼──────────────────────────────────────┐ │
│  │          Database Layer (live_test_recipients, audit_logs)        │ │
│  │  - Records provider request IDs, raw responses, delivery evidence │ │
│  │  - Separates carrier evidence from human acknowledgment           │ │
│  │  - Provenance tagging: 'LIVE_PROVIDER', 'HUMAN_ACKNOWLEDGEMENT'   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Phase 7: Offline-First & Data Synchronization Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Client Browser / PWA Shell                        │
│  ┌──────────────────────────────┐      ┌────────────────────────────┐  │
│  │   Service Worker (sw.js)     │      │   React Frontend (App)     │  │
│  │  - App Shell Pre-caching     │      │  - Connectivity Banner     │  │
│  │  - Stale-While-Revalidate    │      │  - Sync Dashboard Modal    │  │
│  │  - STRICT: /api/* Excluded   │      │  - Conflict Resolution UI  │  │
│  └──────────────┬───────────────┘      └─────────────┬──────────────┘  │
│                 │                                    │                 │
│                 ▼                                    ▼                 │
│  ┌──────────────────────────────┐      ┌────────────────────────────┐  │
│  │    Browser CacheStorage      │      │  Sync Engine & Hooks       │  │
│  │   (HTML, JS, CSS, Icons)     │      │  - Bounded Retries         │  │
│  └──────────────────────────────┘      │  - Exponential Backoff     │  │
│                                        └─────────────┬──────────────┘  │
│                                                      │                 │
│                                        ┌─────────────▼──────────────┐  │
│                                        │  User-Partitioned IDB      │  │
│                                        │  - Patient Snapshots       │  │
│                                        │  - Offline Document Blobs  │  │
│                                        │  - Discrete Dose Events    │  │
│                                        │  - Persistent Sync Queue   │  │
│                                        └─────────────┬──────────────┘  │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │
                                  POST /api/families/:id/sync/batch
                                  GET  /api/families/:id/sync/delta
                                                       │
┌──────────────────────────────────────────────────────▼─────────────────┐
│                      Authoritative Backend Server                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      SyncService.ts                              │  │
│  │  - Server-Side Idempotency Check (uq_sync_ops_idempotency)       │  │
│  │  - RBAC & Patient Family Membership Revalidation                 │  │
│  │  - Optimistic Concurrency Diffing (baseRevision vs updated_at)   │  │
│  │  - Non-Conflicting Field Merging                                 │  │
│  │  - Conflict Logging (sync_conflicts table)                       │  │
│  │  - Discrete Dose Occurrence Logging (No Schedule Clashing)       │  │
│  │  - Cancelled Appointment Revocation Protection                   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │                  PostgreSQL Datastore (Supabase)                 │  │
│  │  - sync_operations (execution logs & cached idempotency payload) │  │
│  │  - sync_conflicts (local vs server payloads & audit trail)       │  │
│  │  - patient_profiles, appointments, medication_schedules          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Phase 8 — Health Community, Society Groups & Elderly Assistance Network Architecture

Phase 8 introduces a Hyperlocal Community Layer connecting residential societies, apartment buildings, and neighborhood circles for mutual non-emergency elderly assistance and blood donor coordination, while enforcing strict healthcare privacy boundaries.

### 15.1 Healthcare Privacy Isolation Boundary

Community data structures are completely isolated from family medical workspaces:

```
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│        Private Family Workspace        │       │       Community & Society Domain       │
│                                        │       │                                        │
│  - family_memberships                  │  NOT  │  - community_groups                    │
│  - patient_profiles                    │ EQUAL │  - community_memberships               │
│  - medical_documents & OCR texts       │ <───> │  - assistance_requests                 │
│  - ai_health_memories                  │       │  - blood_donor_requests                │
│  - medication_schedules & doses        │       │  - contact_sharing_grants              │
│  - doctor_summaries (PDFs)             │       │  - community_reports & moderation      │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
```

- **Zero Medical Record Leakage**: Community members, owners, and moderators cannot access patient profiles, prescriptions, OCR text, or health timelines.
- **Route Authorization**: Calls to `/api/families/:familyId/*` enforce family membership checks (`403 Forbidden` for non-family users, even if they are community owners).

### 15.2 Privacy-First Contact Sharing Model

```
Community Member (Public/General)
       │
       ▼
Assistance Request View
       │
       ├── approximate_locality: "Tower B, 4th Floor" (Visible)
       ├── contact_phone: NULL (Masked)
       └── exact_address: NULL (Masked)

                 │
        (Requester explicitly assigns volunteer)
                 │
                 ▼
       ContactSharingGrant Created
       - grantee_user_id: assigned_volunteer
       - granted_fields: ["contact_phone", "exact_address"]
       - expires_at: NOW() + 72 hours
                 │
                 ▼
Assigned Volunteer View
       │
       ├── approximate_locality: "Tower B, 4th Floor"
       ├── contact_phone: "+919876543210" (Revealed)
       └── exact_address: "Flat 402, Tower B" (Revealed)
```

### 15.3 Non-Emergency & Blood-Donor Safeguards

1. **Non-Emergency Assistance Limits**: Mandatory non-emergency confirmation prevents using community requests as emergency dispatch. Acute situations direct users to 112 / Ambulance services.
2. **Clinical Blood Donor Disclaimers**: Clear visual disclaimers state that Sanjivani coordinates voluntary contact only. Blood screening, infectious testing, and cross-matching remain exclusively under the authority of licensed blood banks and hospital pathology departments.
3. **Audit-Logged Moderation Actions**: Owners and moderators manage community safety with structured actions (`warn_user`, `hide_content`, `suspend_member`, `remove_member`, `dismiss`) recorded with timestamps, moderator IDs, and justification notes in `moderation_actions`.
