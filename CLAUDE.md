# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AnnaChillBeauty Salon— a KiotViet-style POS and salon management system built with a modular monolith architecture: React + TypeScript frontend (Vite), Node.js + Express REST API, and PostgreSQL. The system runs entirely in Docker Compose.

## Development Commands

### Full Stack (Docker Compose)
```bash
# First time setup
cp .env.example .env
docker compose up --build

# Stop services, keep database
docker compose down

# Reset everything including database
docker compose down -v
docker compose up --build

# View logs
docker compose logs -f
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server
npm run build        # Typecheck + build for production
npm run typecheck    # TypeScript only
npm run test         # Run vitest tests
```

### Backend Development
```bash
cd backend
npm install
npm run dev          # Start with --watch for hot reload
npm run start        # Production start
npm run check        # Syntax check + run tests
```

### Database
- Schema and seed data are in `database/init/001_schema.sql` and `002_seed.sql`
- Data persists in `data/` volume
- To reinitialize: `docker compose down -v && docker compose up --build`

## Architecture

### Service Boundaries
- **Frontend** (`frontend/`): React 19 + TypeScript + Vite + TanStack Query. Calls relative path `/api/v1`. No mock data — renders only API responses. Supports PWA.
- **Backend** (`backend/src/`): Node.js 22 + Express 5. REST API at `/api/v1`. Modular structure under `modules/`: `auth`, `dashboard`, `orders`, `customers`, `pos`, `staff`, `inventory`, `branches`, `attendance`.
- **Database**: PostgreSQL 16 with connection pooling. Transaction-based mutations. All queries use parameterized statements.

### Key Patterns
- Backend uses read-only transactions for dashboard/analytics queries
- API validates all inputs at HTTP boundary
- Error responses follow a consistent structure: `{ error: { status, code, message, requestId } }`
- Frontend uses TanStack Query for server state, React Router for routing
- Branch-scoped data: `branchId` is enforced server-side from session, not client-provided

### API Error Codes
| Code | Meaning |
|------|---------|
| `INVALID_ARGUMENT` | 400 — malformed request |
| `NETWORK_ERROR` | 503 — connection failure |
| `REQUEST_TIMEOUT` | 504 — timeout |
| `INVALID_RESPONSE` | 502 — bad JSON from upstream |

## User Roles
Three account types created on fresh database init:
- `admin` / `12345678` — full access
- `cashier` / `12345678` — POS only (`/pos`)
- `staff` / `12345678` — attendance only (`/attendance`)

## Environment Variables
Critical variables (must be changed in production):
- `DB_PASSWORD` — minimum 16 characters
- `ATTENDANCE_QR_SECRET` — minimum 32 characters
- `AUTH_COOKIE_SECURE` — must be `true` behind TLS

## Design System
- CSS-only styling with design tokens (no CSS framework)
- Typography: system sans-serif stack (SF Pro, Segoe UI, Arial)
- Colors: Blue accent (`#0756CC`), light theme only
- Components follow KiotViet-inspired SaaS aesthetic
- Frontend displays skeleton/loading states while fetching; shows error with retry on failure

## Additional Context
- All pages are server-rendered from API (no fallback data)
- QR attendance uses GPS verification; requires HTTPS outside localhost
- Detailed architecture decisions in `docs/architecture/ARCHITECTURE.md`
- Module-specific research and progress docs in `docs/inventory-purchasing/`, `docs/operations-pages/`, `docs/frontend-react-refactor/`

## Git Workflow (Solo Developer)
- **Branches**: Do not create new branches unless a branch already exists in the repository and the user explicitly asks to change work on that branch. Work on `master` or `main` by default.
- **Commits**: Do not auto-commit or push to remote. Only commit when the user asks, or at the end of a session if the user has granted standing permission. Never force-push.
