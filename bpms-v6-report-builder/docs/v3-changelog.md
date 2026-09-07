# BPMS v3 Changelog

All changes shipped in v3 on top of the v2 baseline. UI labels are Persian (RTL interface); this summary is in English for the dev team.

## UX & Theming
- **Light theme by default** — first-load theme is now light; the dark toggle remains and stored user preferences are still respected.
- **Wider form builder** — the create/edit form drawer in process design widened from 640px to 900px (`max-w-full` retained).
- **Data grid height fix** — grids gained a 320px minimum-height floor for empty states. With rows present, `autoHeight` hugs the content so the pagination footer sits directly under the last row (no blank gap between rows and pagination).

## Process lifecycle
- **ARCHIVE status removed** — `ProcessStatus` is now `DRAFT | ACTIVE` only (Prisma schema, DTO validation, UI status filter and chips).
- **Sidebar rename** — the admin-only `بایگانی فرآیندها` entry is now `گزارش فرآیندها` (process report).

## Process report (گزارش فرآیندها, admin)
- Admin sees **all started process instances** with status, current pending step (`مرحله فعلی`), starter and timestamps.
- **4 KPI summary cards**: total / in-progress / completed / ended (terminated + failed), computed from the loaded scope.
- **Filters**: by process (options derived from loaded instances) and by status.
- Non-admins degrade gracefully to their own instances (403 → mine fallback); the terminate action is only shown for admin or the instance starter.

## Starting processes
- **Top-bar entry for every user** — a `شروع فرآیند` button in the app header opens a global start dialog listing ACTIVE processes (shared `StartProcessDialog` component).
- After starting, the user is redirected **straight to the first pending task form** when that task is visible to them (TASK_STARTER / FIXED_USER=self / held position pool); otherwise to the instance detail page.

## کارتابل privacy (per-user task isolation) — enforced server-side
- `GET /tasks` (all tasks) is **admin-only**.
- Task detail, complete, claim and release enforce visibility: admin, direct assignee, claimer, unclaimed position-pool task for a held position, or fully open (owner-less) task — otherwise **403**. Another user's task is inaccessible even by direct URL or API call.
- Users see only their own tasks in کارتابل (`/tasks/mine`).
- **Instance detail** follows the same rule (participants only: admin, starter, task assignees, position-pool holders); unauthorized users get a proper `دسترسی غیرمجاز` card instead of a blank page.
- Instance termination restricted to the starter or admin.

## Roles & i18n
- `SENIOR_EXPERT` (`کارشناس ارشد`) role added alongside `کارشناس` in DTO, schema and the users view.
- Cartable/archive/report labels and role labels updated across the i18n dictionary.

## Ops / infrastructure notes
- **`.env.example` added for the backend** — copy to `.env` before running (`PORT`, `JWT_SECRET`, `DATABASE_URL`).
- Dev-only helper route `GET /ensure-backend` (frontend) idempotently probes port 3001 and (re)spawns the backend if silent; a no-op when the backend is already running.
- The backend dev script runs `node dist/main.js` (non-watch). Do not reintroduce `nest --watch` while `next dev` is running — the combined watchers exhaust the inotify limit.

## Verification (v3 sign-off)
- API isolation suite `scripts/test-task-isolation.mjs`: **16/16 passed**.
- Multi-user browser E2E (admin / john / jane): کارتابل isolation, denied-access cards, report KPIs + filters, top-bar start → form redirect, terminate gating — **zero console errors**.
- TypeScript: 18 pre-existing baseline errors, unchanged set. ESLint: no new issues.
