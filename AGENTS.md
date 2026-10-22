# AGENTS.md — Sanjivani Development Conventions

> **Read this file before every development session.**
> These conventions apply to all phases and all AI coding agents working on this project.

---

## 1. Project Overview

**Sanjivani** (Health Memory Agent) is an AI-powered healthcare record management platform being developed incrementally. The project is organized into numbered phases, each with a separate prompt and requirements document.

The current phase is recorded in `docs/DEVELOPMENT_ROADMAP.md`.

---

## 2. Mandatory Pre-Phase Checklist

Before implementing any phase, every agent MUST:

1. **Inspect the repository** — read `docs/PROJECT_AUDIT.md`, `docs/ARCHITECTURE.md`, and the `DEVELOPMENT_ROADMAP.md`.
2. **Read the relevant PRD** — locate the phase-specific requirements document in `docs/`.
3. **Examine existing code** — understand what is already implemented before writing a single line.
4. **Identify reusable patterns** — use existing services, hooks, components, and database access patterns.
5. **Check the migration directory** — review `supabase/migrations/` before any schema change.

---

## 3. Scope Discipline

- Implement **only** what the current phase prompt explicitly requests.
- Do not add features, screens, or logic that belong to a future phase.
- Do not refactor unrelated code unless it is blocking the current phase.
- If scope creep is tempting, document it in `docs/DEVELOPMENT_ROADMAP.md` under the appropriate future phase instead.

---

## 4. Folder Structure and Naming Conventions

### Frontend (`frontend/src/`)
| Directory | Purpose |
|-----------|---------|
| `app/` | Router configuration, providers, global app setup |
| `components/ui/` | Reusable, stateless UI primitives (Button, Input, Card, etc.) |
| `components/layout/` | Layout shells (Navbar, Sidebar, PageWrapper, etc.) |
| `features/` | Feature modules — each feature owns its own components, hooks, and types |
| `hooks/` | Shared custom React hooks |
| `lib/` | Third-party library configuration (api client, supabase client, etc.) |
| `services/` | Frontend API call functions (thin wrappers over fetch/axios) |
| `types/` | Shared TypeScript type definitions |
| `styles/` | Global CSS, design tokens, theme configuration |

### Backend (`backend/src/`)
| Directory | Purpose |
|-----------|---------|
| `config/` | Environment loading, validated config object, logger setup |
| `controllers/` | Thin request/response handlers — call services, return responses |
| `routes/` | Express router registration — no business logic |
| `services/` | Business logic — orchestrate repositories and integrations |
| `repositories/` | Database access — all Supabase/PostgreSQL queries live here |
| `integrations/` | External provider interfaces (AI, OCR, SMS, voice, etc.) |
| `jobs/` | Background tasks and scheduled jobs |
| `middlewares/` | Express middleware (auth, error handling, validation, logging) |
| `validators/` | Request schema validation (Zod or similar) |
| `utils/` | Pure utility functions with no side effects |
| `types/` | Shared TypeScript interfaces and type definitions |
| `models/` | Domain model definitions (not ORM models) |

---

## 5. Architecture Rules (Non-Negotiable)

1. **Controllers must be thin.** Business logic belongs in services. A controller should only: parse input → call service → return response.
2. **Routes must not contain logic.** Routes register handlers only.
3. **Request validation is separate.** Use validators/middleware — never inline validation in controllers.
4. **One database access pattern.** All DB access goes through `repositories/`. Never query the database directly from controllers or services.
5. **External services through integrations.** All third-party API calls (AI, SMS, OCR) go through `integrations/` interfaces so they can be swapped or mocked.
6. **No circular dependencies.** Keep dependency direction: `routes → controllers → services → repositories`.
7. **Environment config is isolated.** Never read `process.env` directly in business logic — use the validated config object from `config/`.
8. **Errors are handled centrally.** All errors bubble up to the centralized error handler middleware. Do not swallow errors silently.
9. **No hardcoded secrets.** No API keys, passwords, or credentials in source files — ever.
10. **Schema changes require migrations.** Every database change must be a numbered migration in `supabase/migrations/`.
11. **Authorization is server-enforced.** Never trust client-provided user IDs or permissions. Validate authorization in middleware or services, and use RLS policies in the database.
12. **Tests are independent.** Each module's tests should run without depending on other modules' state.

---

## 6. Database and Supabase Rules

- The primary database is **PostgreSQL via Supabase**.
- Do not add a second database (no MongoDB, Redis for persistence, etc.).
- Use Supabase Auth for authentication — do not build a custom auth system.
- All user-facing database calls from the frontend MUST use the **anon/public key** only.
- The **service-role key** is restricted to the backend server — never expose it to the browser.
- Every table must have **Row Level Security (RLS)** enabled with appropriate policies.
- Database migrations must be:
  - Numbered sequentially: `YYYYMMDDHHMMSS_description.sql`
  - Additive where possible (avoid destructive changes)
  - Tested locally before committing

---

## 7. Security Requirements

- Never log secrets, tokens, passwords, or PII.
- Never expose stack traces or internal error details in API responses — use sanitized error messages in production.
- Validate all user input on the server side — never trust client input.
- Set secure HTTP headers using helmet or equivalent.
- Configure CORS to restrict allowed origins.
- Medical record data requires special handling — document specific privacy decisions in `docs/SECURITY.md`.
- When in doubt about a security decision, document it and flag it for review rather than silently implementing an insecure approach.

---

## 8. Testing Requirements

- Write tests for every feature implemented in a phase before marking the phase done.
- **Backend:** Use Vitest + Supertest for API route tests; unit test services and validators independently.
- **Frontend:** Use Vitest + React Testing Library for component and hook tests.
- Tests must not depend on real external services — mock integrations.
- Tests must not require real Supabase credentials — use test doubles or environment overrides.
- Run all available tests before marking a phase complete. Report actual results.

---

## 9. Build and Quality Checks

Run these commands before marking any phase complete:

```bash
# From repo root:
npm run type-check        # TypeScript compilation (both workspaces)
npm run lint              # ESLint (both workspaces)
npm run test              # All tests
npm run build             # Production builds
```

Report the actual output of each command. Do not claim success for commands not run.

---

## 10. Environment and Configuration

- `.env.example` files document all required environment variables.
- Never commit `.env` files.
- Validate required environment variables at application startup.
- If a required variable is missing, the application must fail fast with a clear error — not silently use a wrong default.
- External integrations (AI, OCR, SMS, voice) must clearly indicate when they are not configured — do not fake responses.

---

## 11. Preserving Existing Work

- Read and understand the current implementation before modifying anything.
- Do not overwrite or delete working code from previous phases.
- If a refactor is necessary, document the reason in the commit message and PR description.
- If a previous phase has a known bug, fix it with a clearly scoped patch — do not rewrite the whole module.

---

## 12. Session Continuity

- If an agent session is interrupted, the next session must resume from the last working state.
- Check git status and recent commits before resuming.
- Do not re-implement what is already done.
- Document incomplete work in `docs/PROJECT_AUDIT.md` under "Outstanding Items."

---

## 13. Reporting Requirements

At the end of every phase, provide:

1. **Files created or modified** — with file paths.
2. **Commands executed and their actual output** — copy the real output, do not paraphrase.
3. **Tests run and results** — pass/fail counts.
4. **Outstanding blockers** — what could not be completed and why.
5. **Features NOT implemented** — explicitly list what was intentionally excluded.
6. **Next steps** — what Phase N+1 should begin with.

---

## 14. What NOT to Do

- ❌ Do not mark tests as passing without running them.
- ❌ Do not claim a service is connected when it is not configured.
- ❌ Do not simulate real external events (calls, SMS, hospital notifications) without clearly marking them as simulated.
- ❌ Do not add dependencies "just in case" — only install what the current phase requires.
- ❌ Do not implement future-phase features during the current phase.
- ❌ Do not put business logic in route files or controllers.
- ❌ Do not access environment variables directly in services or repositories.
- ❌ Do not create multiple competing ways to query the same database.
- ❌ Do not expose the Supabase service-role key to the frontend.

---

*Last updated: Phase 0 — Initial Setup*
