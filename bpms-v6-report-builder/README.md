# BPMS v2 — Business Process Management System

Declarative BPM platform with a fully redesigned Material Design 3 (MD3) interface.
This is **v2**: the complete UI redesign program (Phases 0–7) applied on top of the
E2E-verified v1 core. **v4** adds process starters, pending-only کارتابل, fully no-code
conditions and create-on-designer-save (see `docs/v4-changelog.md`). **v6** adds the
admin **report builder (گزارش‌ساز)** — custom per-process reports over instance data
and variables (see `docs/v6-changelog.md`).

## What's in this archive

| Path | Description |
|---|---|
| `frontend/` | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + MUI X DataGrid + bpmn-js 18 (port 3000) |
| `backend/` | NestJS 11 + Prisma 6 + SQLite + bpmn-engine 25 + Swagger (port 3001) |
| `docs/` | Architecture, API reference, domain guide, development guide, UI redesign plan |
| `scripts/` | E2E test suites (Node `.cjs`, run against a live stack) + QA helper scripts |
| `AGENTS.md` | Operational playbook: startup flow, invariants, QA conventions |
| `worklog.md` | Full multi-phase work log (planning → Phase 7 delivery) |

## What changed in v6 (report builder)

- **گزارش‌ساز** — admins build tabular reports per process from a field catalog:
  fixed instance fields (status/startedBy/dates/current step/duration/task counts)
  plus **process variables** (declared ∪ form-derived, select values shown with
  Persian category labels), selected via checkboxes with ordered chips.
- **Declarative filters** — STATUS, DATE_RANGE on start date, and VARIABLE
  conditions (eq/neq/contains), all stored as pure JSON config — no code, like
  task assignments.
- **Live execution** — `POST /reports/:id/execute` computes rows from instances +
  submissions on demand; `POST /reports/preview` runs unsaved configs so the
  builder's «پیش‌نمایش» always equals the saved result.
- **Runner UI** — KPI cards, dynamic grid (status chips / Persian dates / labels),
  row-click drill-down to the instance timeline, and **CSV export** (Excel-safe
  Persian BOM).

## What changed in v4

- **Process starters (شروع‌کنندگان)** — the START event's assignment: right-click the
  start element in the designer → «تعیین شروع‌کنندگان» → all-users or a selected group.
  Server-enforced 403 for everyone else; admins bypass; the «شروع فرآیند» dialog filters
  per user.
- **کارتابل = received tasks only** — `/tasks/mine` lists PENDING tasks exclusively;
  completed tasks leave the inbox immediately (history stays on the instance timeline).
- **No-code gateway conditions** — the condition dialog builds conditions from dropdowns
  (variable / operator / value); select values resolve from categories with Persian
  labels, exactly as the runtime form shows them.
- **Create-on-save** — «ایجاد فرآیند» opens the designer with ZERO server calls; the
  process row is created only by the designer's «ایجاد و ذخیره» button.

## What changed in v2 (UI redesign)

- **MD3 indigo theme** mapped onto existing shadcn CSS variables (`--primary`, `--background`, …)
  — light `#3B5BDB` / dark `#BAC3FF`, zero component rewrites
- **Dark mode** via `next-themes`, app-bar toggle, system-default, persisted
- **App Router migration** — real URLs for every view (`/dashboard`, `/tasks`, `/tasks/[id]`,
  `/instances`, `/instances/[id]`, `/processes`, `/processes/[id]/design`,
  `/admin/{departments,categories,users}`), role-guarded layouts
- **New shell** — top app bar + collapsible sidebar (drawer ⇄ icon rail) + breadcrumbs + Ctrl+K
  command palette
- **KPI dashboard** with `/api/dashboard` (fully user-scoped: tasks/instances per user, processes = startable; ADMIN global)
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
node backend/scripts/test-v4-features.cjs
node backend/scripts/test-v5-dashboard-scoping.cjs
node backend/scripts/test-report-builder.cjs
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
6. Starter set semantics: **empty = everyone may start**, non-empty = members + admins only
7. کارتابل endpoints (`/tasks`, `/tasks/mine`) return PENDING tasks only

## Documentation map

- `docs/architecture.md` — system architecture incl. §6 post-redesign frontend structure
- `docs/api-reference.md` — REST API surface
- `docs/domain-guide.md` — BPM domain model and declarative semantics
- `docs/development-guide.md` — day-to-day development workflow
- `docs/ui-redesign-plan.md` — the full v2 redesign plan (tokens, phases, risks, acceptance)
