# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AnnaChill Beauty Salon — a KiotViet-style POS and salon management system. Modular monolith: React 19 + TypeScript SPA (Vite, served by Nginx in Docker), Node.js + Express 5 REST API (plain ESM JavaScript, no TypeScript), PostgreSQL 16. Everything runs in Docker Compose. UI copy and API error messages are in Vietnamese.

## Development Commands

### Full stack (Docker Compose)
```bash
cp .env.example .env          # first time only
docker compose up --build     # web :8080, API :3000, Postgres :5432 (localhost only)
docker compose down           # stop, keep database
docker compose down -v && docker compose up --build   # reset DB and re-run database/init/*.sql
docker compose logs -f
```

### Local dev without the Docker frontend
`.claude/launch.json` defines `backend` (`npm --prefix backend run dev`, port 3000) and `frontend` (`npm --prefix frontend run dev`, port 5173). The Vite dev server proxies `/api` (including the WebSocket) to `http://localhost:3000`. The backend still needs Postgres, e.g. `docker compose up database`.

### Frontend (`frontend/`)
```bash
npm run dev                          # Vite dev server
npm run build                        # tsc --noEmit + vite build
npm run typecheck
npm run test                         # vitest run (jsdom, setup in src/test/setup.ts)
npx vitest run src/lib/format.test.ts   # single test file
npx vitest run -t "test name"           # single test by name
```

### Backend (`backend/`)
```bash
npm run dev      # node --watch src/server.js
npm run check    # node --check on every src/**/*.js, then node --test (all tests)
node --test src/modules/pos/pos.test.js                  # single test file
node --test --test-name-pattern="pattern" src/app.test.js
```
Backend tests are colocated as `*.test.js` (some under `__tests__/`). `*.integration.test.js` and some others run against an in-memory **PGlite** database: they load `database/init/001_schema.sql` plus migrations, then monkey-patch `pool.query` from `src/db.js`. They need no running Postgres.

Node 24 in the Dockerfiles and `backend/package.json` engines. CI (`.github/workflows/ci.yml`) uses Node 22 and also runs a full-stack smoke test through `compose.yaml` + `compose.ci.yaml`.

## Architecture

### Backend (`backend/src/`)
- `server.js` runs `runMigrations()` **before** it starts listening. It then creates the Express app (`app.js`) and attaches the WebSocket server (`lib/ws.js`) to the same HTTP server.
- `app.js` sets up the middleware chain on `/api/v1`: request ID → security headers → trusted-origin check (`AUTH_TRUSTED_ORIGINS`) → rate limit → JSON body. `/health`, `/ready` and `/auth` are public. Everything mounted after `requireAuth` needs a session cookie. Each module is mounted with `requirePermissions(...)`.
- Modules live in `modules/<name>/` as `<name>.routes.js` (HTTP parsing and validation) plus `<name>.service.js` (SQL). The modules are auth, attendance, branches, customers, dashboard, debts, inventory, notifications, orders, pos and staff. `domain-options.js` holds the enums exposed via `GET /api/v1/meta`.
- **Roles and permissions** (`modules/auth/auth.permissions.js`): the DB roles are `manager`, `cashier` and `staff`. `manager` has every permission except `attendance:self`. `cashier` has only `pos:use` (POS and debts). `staff` has only `attendance:self`. Add a new endpoint group by mounting it in `app.js` with the right permission.
- **Branch scoping**: services receive `request.account.branchId` from the session. Never accept `branchId` from the client. Every query filters by `branch_id`.
- **Errors**: throw `new HttpError(status, CODE, vietnameseMessage)` from `lib/http.js`, and wrap async handlers in `asyncRoute`. `apiErrorHandler` in `app.js` produces `{ error: { status, code, message, requestId, details? } }`. For 5xx responses it hides the message. Common server codes are `AUTH_REQUIRED` (401), `ACCESS_DENIED` (403), `ROUTE_NOT_FOUND` (404), `MALFORMED_JSON`, `PAYLOAD_TOO_LARGE` and `INVALID_ARGUMENT`. The frontend client makes up `NETWORK_ERROR` (503), `REQUEST_TIMEOUT` (504) and `INVALID_RESPONSE` (502) for failures on its side.
- **Transactions**: mutations use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`. Analytics reads use `BEGIN READ ONLY`. All SQL is parameterized.
- **Realtime**: `lib/ws.js` authenticates the WS upgrade with the session cookie and exposes `broadcastToBranch(branchId, event, data)`. Events (`realtimeEvents`) are published only **after** the transaction commits. They are invalidation signals, and clients refetch rather than trusting the payload.

### Database schema changes
`database/init/*.sql` (`001_schema.sql`, `002_seed.sql`) runs only when the Postgres volume (`./data`) is first created. Existing deployments are upgraded by the **idempotent SQL in `runMigrations()` in `backend/src/db.js`** (plus `migrations/customer-debt.js`), which runs on every API start. For a schema change, update `001_schema.sql` **and** add an idempotent `ADD COLUMN IF NOT EXISTS` / `CREATE ... IF NOT EXISTS` step to the migrations. Migrations must never reset live data. In `NODE_ENV=production`, `assertProductionDatabaseSafety()` refuses to start while demo password hashes remain.

### Frontend (`frontend/src/`)
- `app/router.tsx`: React Router data router with lazy-loaded pages. The desktop admin uses `layouts/AdminLayout`. A separate mobile/PWA shell lives under `/m/*` (`layouts/MobileAppLayout`, `pages/**/Mobile*Page.tsx`, `features/mobile-*`).
- `pages/` holds thin route components. `features/<domain>/` holds the `*.api.ts` query functions, types and domain UI. `components/` holds shared UI. The `@/` alias maps to `src/`.
- `services/api-client.ts` is the typed fetch wrapper for relative `/api/v1` URLs. It expects the `{ data, meta }` envelope and has a 20s timeout. Server state lives only in TanStack Query. `context/RealtimeQuerySynchronizer.tsx` maps WebSocket events to query invalidations.
- There is no mock or fallback data. Pages render API responses and show skeleton, error and retry states.

## Seed Accounts (fresh volume only)
All seeded accounts use the password `12345678`. `admin` and `manager` are managers with full access. `cashier` can only use `/pos`. `staff`, `trangvu`, `hau` and `emhue` are staff accounts limited to `/attendance`. README.md says `Anna@123`, which is stale.

## Environment Variables
Must be changed in production: `DB_PASSWORD` (≥16 chars), `ATTENDANCE_QR_SECRET` (≥32 chars), and `AUTH_COOKIE_SECURE=true` behind TLS. `AUTH_TRUSTED_ORIGINS` must list the web origin, or mutating requests are rejected. QR attendance uses GPS, and camera/GPS need HTTPS outside localhost. Containers run in `Asia/Ho_Chi_Minh`.

## Design System
CSS only, with no framework. Tokens are in `frontend/src/styles/tokens.css`. System sans-serif stack, blue accent `#0756CC`, light theme only, KiotViet-inspired SaaS look. The full visual spec (radii, shadows, density) is in `DESIGN_REQUIREMENTS.md`. Icons come from `@phosphor-icons/web`.

## Further Docs
`docs/architecture/ARCHITECTURE.md` and `adr-001-modular-monolith.md`. Module research and progress notes are in `docs/inventory-purchasing/`, `docs/operations-pages/`, `docs/frontend-react-refactor/` and `docs/testing/`.

## Git Workflow (Solo Developer)
- **Branches**: Do not create new branches unless a branch already exists in the repository and the user explicitly asks to change work on that branch. Work on `master` or `main` by default.
- **Commits**: Do not auto-commit or push to remote. Only commit when the user asks, or at the end of a session if the user has granted standing permission. Never force-push.
