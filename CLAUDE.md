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
- Modules live in `modules/<name>/` as `<name>.routes.js` (HTTP parsing and validation) plus `<name>.service.js` (SQL). The modules are auth, attendance, branches, cashbook, customers, dashboard, debts, inventory, notifications, orders, pos, reports and staff. `domain-options.js` holds the enums exposed via `GET /api/v1/meta`.
- **Roles and permissions** (`modules/auth/auth.permissions.js`): the DB roles are `manager`, `cashier` and `staff`. `manager` has every permission except `attendance:self`. `cashier` has `pos:use` (POS and debts) and `cashbook:write` (create vouchers, see today's vouchers only). `finance:read` (fund balances, cancel/transfer vouchers, profit report) is manager-only. `staff` has only `attendance:self`. Add a new endpoint group by mounting it in `app.js` with the right permission.
- **Branch scoping**: services receive `request.account.branchId` from the session. Never accept `branchId` from the client. Every query filters by `branch_id`.
- **Errors**: throw `new HttpError(status, CODE, vietnameseMessage)` from `lib/http.js`, and wrap async handlers in `asyncRoute`. `apiErrorHandler` in `app.js` produces `{ error: { status, code, message, requestId, details? } }`. For 5xx responses it hides the message. Common server codes are `AUTH_REQUIRED` (401), `ACCESS_DENIED` (403), `ROUTE_NOT_FOUND` (404), `MALFORMED_JSON`, `PAYLOAD_TOO_LARGE` and `INVALID_ARGUMENT`. The frontend client makes up `NETWORK_ERROR` (503), `REQUEST_TIMEOUT` (504) and `INVALID_RESPONSE` (502) for failures on its side.
- **Transactions**: mutations use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`. Analytics reads use `BEGIN READ ONLY`. All SQL is parameterized.
- **Cashbook** (`modules/cashbook/`): `cash_transactions` is the voucher ledger (`PT`/`PC` codes per branch, `fund` = `cash` | `bank`, soft cancel). Every money movement goes through `recordCashEntry()` in `cashbook.ledger.js` inside the caller's transaction (POS, debt collection, payroll payment, received purchase orders). Wallet (prepaid card) payments are not written to a fund. Categories and their `countsInProfit` flag live in `domain-options.js`.
- **Profit report** (`modules/reports/`): revenue = paid invoices by branch-local `issued_at` with the invoice discount spread over lines; account-card sales are deposits, not revenue; cost = quantity × current `cost_price`; expenses = active vouchers whose category `countsInProfit`.
- **Realtime**: `lib/ws.js` authenticates the WS upgrade with the session cookie and exposes `broadcastToBranch(branchId, event, data)`. Events (`realtimeEvents`) are published only **after** the transaction commits. They are invalidation signals, and clients refetch rather than trusting the payload.

### Database schema changes
`database/init/*.sql` (`001_schema.sql`, `002_seed.sql`) runs only when the Postgres volume (`./data`) is first created. Existing deployments are upgraded by the **idempotent SQL in `runMigrations()` in `backend/src/db.js`** (plus `migrations/customer-debt.js`), which runs on every API start. For a schema change, update `001_schema.sql` **and** add an idempotent `ADD COLUMN IF NOT EXISTS` / `CREATE ... IF NOT EXISTS` step to the migrations. Migrations must never reset live data. In `NODE_ENV=production`, `assertProductionDatabaseSafety()` refuses to start while demo password hashes remain.

### Frontend (`frontend/src/`)
- `app/router.tsx`: React Router data router with lazy-loaded pages. The desktop admin uses `layouts/AdminLayout`. A separate mobile/PWA shell lives under `/m/*` (`layouts/MobileAppLayout`, `pages/**/Mobile*Page.tsx`, `features/mobile-*`).
- `pages/` holds thin route components. `features/<domain>/` holds the `*.api.ts` query functions, types and domain UI. `components/` holds shared UI. The `@/` alias maps to `src/`.
- `services/api-client.ts` is the typed fetch wrapper for relative `/api/v1` URLs. It expects the `{ data, meta }` envelope and has a 20s timeout. Server state lives only in TanStack Query. `context/RealtimeQuerySynchronizer.tsx` maps WebSocket events to query invalidations.
- There is no mock or fallback data. Pages render API responses and show skeleton, error and retry states.
- Forms never pre-fill sample business values (salary, allowances, prices); edit forms load what the API saved. A control whose feature is not built yet calls `useComingSoon()` (`components/ui/Toast/useComingSoon.ts`) to show the shared "Tính năng đang triển khai" toast.

## Seed Accounts (fresh volume only)
All seeded accounts use the password `12345678`. `admin` and `manager` are managers with full access. `cashier` can only use `/pos`. `staff`, `trangvu`, `hau` and `emhue` are staff accounts limited to `/attendance`. README.md says `Anna@123`, which is stale.

## Environment Variables
Must be changed in production: `DB_PASSWORD` (≥16 chars), `ATTENDANCE_QR_SECRET` (≥32 chars), and `AUTH_COOKIE_SECURE=true` behind TLS. `AUTH_TRUSTED_ORIGINS` must list the web origin, or mutating requests are rejected. QR attendance uses GPS, and camera/GPS need HTTPS outside localhost. Containers run in `Asia/Ho_Chi_Minh`.

## Design System
CSS only, with no framework. System sans-serif stack, blue accent `#0756CC`, light theme only, KiotViet-inspired SaaS look. Icons come from `@phosphor-icons/web`. The visual spec is `DESIGN_REQUIREMENTS.md`; the template design is `docs/superpowers/specs/2026-09-25-unified-ui-template-design.md`; mobile page recipes are in `docs/mobile-ui-header-template.md`.

- **Tokens**: `frontend/src/styles/tokens.css` is the only place with literal colours. Each status tone has `--x`, `--x-soft` and `--x-line`; appointment statuses use `--appt-*`. Mobile only changes density (`--control-h` 44px inside `.mobile-app-shell` and `.sheet`).
- **Stylesheets**: every CSS file is imported once, in order, from `src/styles/index.css`; components never import CSS (Leaflet's is the only exception). Standard classes are defined only in `src/styles/ui/`: `btn*`, `field*`/`input`/`input-suffix`/`switch`/`form-section`, `card*`, `badge*`/`chip*`, `tabs`/`segmented`, `data-table`/`data-panel`, `detail.css` (inline row detail + `detail-table`), `state`/`alert`, `modal*`/`sheet*`, `page*`/`m-*`. `text.css` utilities (`text-primary|success|danger|warning|muted|faint|strong|right`) load last. Feature CSS holds feature layout only, under a feature prefix.
- **React primitives**: `Modal` and `BottomSheet` (focus trap, Escape, scroll lock), `PageHeader` (desktop, `backTo`/`onBack`), `MobilePageHeader` + `MobileHeaderAction`, `LoadingState`/`EmptyState`/`ErrorState` (`compact` on mobile), and `InlineDetail`/`DetailHead`/`ValueStrip`/`DetailFacts` for expanded table rows.
- **Guard rails**: `src/styles/styles.contract.test.ts` fails on hex colours outside tokens (CSS and TSX), decorative inline styles (only computed geometry may be inline, including `*Style={{…}}` props), btn modifiers without `btn`, component CSS imports, stylesheets missing from the manifest, standard classes defined outside `styles/ui`, and Phosphor weights other than regular (`ph-fill` etc. are not loaded).
- **Select**: `variant="filter"` in filter panels, `variant="pill"` for chip-style selects in mobile chip strips, `variant="ghost"` inside a `.chip`. Desktop board pages (Lịch làm, Chấm công) use `PageHeader` + `.attendance-toolbar-card`.
- A DEV-only living reference renders at `/ui-kit` and `/ui-kit/mobile` (`npm run dev`).

## Further Docs
`docs/architecture/ARCHITECTURE.md` and `adr-001-modular-monolith.md`. Module research and progress notes are in `docs/inventory-purchasing/`, `docs/operations-pages/`, `docs/frontend-react-refactor/` and `docs/testing/`.

## Git Workflow (Solo Developer)
- **Branches**: Do not create new branches unless a branch already exists in the repository and the user explicitly asks to change work on that branch. Work on `master` or `main` by default.
- **Commits**: Do not auto-commit or push to remote. Only commit when the user asks, or at the end of a session if the user has granted standing permission. Never force-push.
