# Sanjivani (Health Memory Agent)

> **AI-powered healthcare record management for individuals and families.**

---

## Current Status

**Phase 0 — Project Foundation Complete**

The technical scaffold is in place. No product features have been implemented yet. This repository is ready for Phase 1 development.

---

## Project Vision

Health Memory Agent will help individuals and families:

- Organize and search medical records
- Extract information from prescriptions using OCR and AI
- Track medications and appointments
- Coordinate elderly care across family members
- Respond to medical emergencies with an SOS demo mode

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router |
| Styling | CSS Modules + CSS Custom Properties |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (Phase 1) |
| Storage | Supabase Storage (Phase 2) |
| Testing | Vitest, React Testing Library, Supertest |
| Linting | ESLint, TypeScript strict mode |

---

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Git

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd Sanjivni

# Install all workspace dependencies
npm install
```

### Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env with your configuration
# See docs/SETUP_GUIDE.md for details
```

### Start Development Servers

```bash
# Start backend (terminal 1)
npm run dev:backend

# Start frontend (terminal 2)
npm run dev:frontend
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/api/health

### Run Tests

```bash
npm run test           # All tests
npm run test:backend   # Backend only
npm run test:frontend  # Frontend only
```

### Type Check and Lint

```bash
npm run type-check     # TypeScript compilation check
npm run lint           # ESLint
```

### Build for Production

```bash
npm run build
```

---

## Project Structure

```
health-memory-agent/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Express.js + TypeScript
├── supabase/          # Database migrations and config
├── docs/              # Architecture and setup documentation
├── AGENTS.md          # Development conventions for all agents
└── README.md
```

See `docs/ARCHITECTURE.md` for the full architecture description.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | Development conventions for all phases |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture decisions |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Database design (planned) |
| [docs/SECURITY.md](docs/SECURITY.md) | Security baseline and future requirements |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Detailed setup instructions |
| [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) | Implementation phases |
| [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) | Workspace inspection findings |

---

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Initial setup and architecture | ✅ Complete |
| 1 | Authentication, family profiles, permissions | 🔜 Next |
| 2 | Health records, document upload, OCR | Planned |
| 3 | AI Health Memory and doctor-ready summaries | Planned |
| 4 | Medication schedules, appointments, reminders | Planned |
| 5 | SOS Demo Mode | Planned |
| 6 | Live test SMS/voice | Planned |
| 7 | Offline access and sync | Planned |
| 8 | Community health features | Planned |
| 9 | Testing, security review, deployment | Planned |
| 10 | Hospital/healthcare system integrations | Planned |

---

## License

UNLICENSED — Private project.
# Sanjivani
