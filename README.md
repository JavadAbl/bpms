# BPMS v2 — Business Process Management System

Declarative BPM platform with a fully redesigned Material Design 3 (MD3) interface.
This is **v2**: the complete UI redesign program (Phases 0–7) applied on top of the
E2E-verified v1 core.

## What's in this archive

| Path | Description |
|---|---|
| `frontend/` | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + MUI X DataGrid + bpmn-js 18 (port 3000) |
| `backend/` | NestJS 11 + Prisma 6 + SQLite + bpmn-engine 25 + Swagger (port 3001) |
| `docs/` | Architecture, API reference, domain guide, development guide, UI redesign plan |
| `scripts/` | E2E test suites (Node `.cjs`, run against a live stack) + QA helper scripts |
| `AGENTS.md` | Operational playbook: startup flow, invariants, QA conventions |
| `worklog.md` | Full multi-phase work log (planning → Phase 7 delivery) |

## What changed in v2 (UI redesign)

- **MD3 indigo theme** mapped onto existing shadcn CSS variables (`--primary`, `--background`, …)
  — light `#3B5BDB` / dark `#BAC3FF`, zero component rewrites
- **Dark mode** via `next-themes`, app-bar toggle, system-default, persisted
- **App Router migration** — real URLs for every view (`/dashboard`, `/tasks`, `/tasks/[id]`,
  `/instances`, `/instances/[id]`, `/processes`, `/processes/[id]/design`,
  `/admin/{departments,categories,users}`), role-guarded layouts
- **New shell** — top app bar + collapsible sidebar (drawer ⇄ icon rail) + breadcrumbs + Ctrl+K
  command palette
- **KPI dashboard** with `/api/dashboard` (role-scoped: ADMIN global / USER own data)
- **MUI X DataGrid** (RTL-aware, faIR locale) on all list views, lazy-loaded per route
- **Micro-interactions** — ripple, skeleton loaders, staggered lists, animated status badges,
  focus-visible rings, full `prefers-reduced-motion` support
- **BPMN designer chrome restyled** (panels/toolbars/dialogs); bpmn-js canvas logic untouched;
  print pipeline preserved and verified
- **MD3 login** with one-click demo-account chips; designer route ADMIN-guarded
- **Dependency prune** — 28 dead scaffold wrappers and 23 unused packages removed

## Running the stack

### Backend (port 3001)

```bash
cd backend
bun install            # or: npm install
npx prisma migrate dev # creates db/bpms.db and applies all migrations
npx prisma db seed     # demo data + accounts
bun run start:dev      # or: npm run start:dev
# Swagger: http://localhost:3001/api/docs
```

> Note: the `dev` script pins `DATABASE_URL` to
> `file:/home/z/my-project/mini-services/bpms-backend/db/bpms.db` — adjust the path if you
> relocate the project.

### Frontend (port 3000)

```bash
cd frontend
bun install            # or: npm install
rm -rf .next           # avoid stale Turbopack CSS
bun run dev            # or: npm run dev
# App: http://localhost:3000  (proxies /api/* to :3001)
```

## Demo accounts

| Login | Password | Role |
|---|---|---|
| `admin@bpms.local` | `admin123` | ADMIN |
| `john@bpms.local` | `user123` | USER |
| `jane@bpms.local` | `user123` | USER |
| `bob@bpms.local` | `user123` | USER |

The login screen also offers one-click quick-login chips for all four accounts.

## E2E verification

With both servers running:

```bash
node scripts/test-condition-validation.cjs
node scripts/test-dashboard-e2e.cjs
node scripts/test-persian-process-e2e.cjs
node scripts/test-process-versioning-e2e.cjs
node scripts/test-file-upload-e2e.cjs
node scripts/test-task-starter-assignment-e2e.cjs
```

All six suites were green at delivery. `docs/tsc-baseline-phase0.txt` records the known
18-error `tsc --noEmit` baseline (zero new errors introduced by the redesign).

## Key invariants (do not break)

1. Gateway conditions: `language="javascript"` + body calls `next(null, env.variables.x === 'Y')`
2. `TaskAssignment.taskName` must match the userTask `name` byte-for-byte
3. `ValidationPipe(whitelist: true)` silently strips undecorated DTO properties
4. ProcessVersion history and instance snapshots are append-only
5. All user-facing strings are Persian; the UI is RTL-only (`dir="rtl"`, Vazirmatn font)

## Documentation map

- `docs/architecture.md` — system architecture incl. §6 post-redesign frontend structure
- `docs/api-reference.md` — REST API surface
- `docs/domain-guide.md` — BPM domain model and declarative semantics
- `docs/development-guide.md` — day-to-day development workflow
- `docs/ui-redesign-plan.md` — the full v2 redesign plan (tokens, phases, risks, acceptance)
