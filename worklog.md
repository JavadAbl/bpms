# Project Worklog

---
Task ID: 1
Agent: Super Z (main agent)
Task: Extract uploaded bpms-v2.zip and read all docs to understand the project

Work Log:
- Extracted /home/z/my-project/upload/bpms-v2.zip → /home/z/my-project/bpms-v2/ (frontend/, backend/, docs/, scripts/, AGENTS.md, worklog.md)
- Read README.md, AGENTS.md, docs/architecture.md, docs/domain-guide.md, docs/api-reference.md, docs/development-guide.md
- Read project worklog.md (512 lines, 20+ entries): v1 feature build → seed/reset → declarative assignments → versioning → file uploads → v2 UI redesign Phases 0–7 (all delivered, E2E green)
- Mapped frontend structure: Next.js 16 App Router under src/app/(app) with role-guarded routes; backend NestJS modules (auth, users, departments, positions, processes, process-instances, tasks, forms, categories, files, dashboard, bpmn)

Stage Summary:
- Project understood end-to-end; ready for follow-up tasks
- Project root for future work: /home/z/my-project/bpms-v2/
- Critical invariants: gateway condition contract (language="javascript" + next(null, expr)), TaskAssignment.taskName byte-exact match, append-only versions/snapshots, Persian RTL UI, ValidationPipe whitelist DTO trap, DATABASE_URL absolute-path pinning

---
Task ID: 2
Agent: Super Z (main agent)
Task: BPMS sidebar renames (archive admin-only + cartable) + SENIOR_EXPERT role addition

Work Log:
- Implemented 3 user requests on BPMS v2 (project at /home/z/my-project, frontend root + mini-services/bpms-backend)
- Backend: SENIOR_EXPERT added to DTO enum + prisma schema (TEXT column, no migration needed)
- Frontend: i18n renames (کارتابل, بایگانی فرآیندها, کارشناس, +کارشناس ارشد), roleLabel helper, admin-only archive in sidebar/palette/dashboard, 3-role users view
- Environment rebuilt from zip: init scaffold, promote, install, migrate, seed; fixed inotify exhaustion (nest --watch ate 8192 watches → ran backend without watch)
- Verified: browser (admin+john, light+dark, zero console errors), E2E 6/6, tsc 18=baseline, backend 0 errors, lint clean
- Screenshots → download/bpms-sidebar-changes/

Stage Summary:
- All 3 changes delivered and verified end-to-end; stack running (3000/3001); demo user sara@bpms.local/user123 has SENIOR_EXPERT role

---
Task ID: 3
Agent: Super Z (main agent)
Task: BPMS UX fixes — light theme default, wider form builder, DataGrid min-height, start→form redirect

Work Log:
- theme-provider.tsx: defaultTheme "system" → "light" (toggle still available; stored prefs respected)
- form-builder-panel.tsx: create/edit form drawer widened w-[640px] → w-[900px] (max-w-full retained)
- material-data-grid.tsx: added minHeight prop (default 320px) applied via DataGrid sx; fixes collapsed autoHeight grids with few/no rows — applies to every DataTable consumer automatically
- instances-view.tsx handleStart: after processInstancesApi.start (backend already waits for first task), call tasksApi.mine(), filter to new instance + status PENDING; if found push /tasks/{id} (form opens immediately), else fallback /instances/{id}
- Verified in browser: html.theme="light" with cleared localStorage; empty filtered grid renders 320px; form panel measured 900px; John starts leave process → lands on /tasks/{id} with form; admin (first task FIXED_USER john) → falls back to instance detail; terminated admin test instance via API
- tsc 18 errors = exact baseline match; eslint clean on changed files (1 pre-existing warning); 0 console errors

Stage Summary:
- All 4 UX changes delivered and verified end-to-end; stack on 3000/3001 untouched (frontend-only changes, no migrations)
- Note: "go to form" redirects only when the first task is visible to the starter (TASK_STARTER/FIXED_USER=starter/position pool they hold); otherwise instance detail opens

---
Task ID: 3-b
Agent: Super Z (main agent)
Task: Fix blank gap between rows and pagination on data grids (reported on تعریف فرایندها)

Work Log:
- Root cause: Task 3 put minHeight:320 on the DataGrid root unconditionally; with autoHeight the root stretches but rows don't fill it, so the pagination footer (pinned to root bottom) drifted away from the last row — large white gap on short lists (1-2 rows / filtered views)
- Fix in material-data-grid.tsx: apply the minHeight floor ONLY when rows.length === 0 (the original collapse problem was the empty state); with rows present the grid hugs content so pagination sits directly under the last row
- Verified in browser on /processes: 4 rows → rootH 316 = content, gap 0; filter DRAFT (1 row) → gap 0, compact card; empty search → rootH 320 with centered empty message; 0 console errors
- tsc 18 = baseline, eslint clean

Stage Summary:
- Grid height logic: empty → 320px floor; non-empty → natural content height, no footer gap
- Pre-existing cosmetic issue NOT in scope: 2-line description cells clip at the 52px row boundary on /processes (rowHeight) — candidate follow-up if user wants taller description rows

---
Task ID: 4
Agent: Super Z (main agent)
Task: Remove ARCHIVE process status, rename report to گزارش فرآیندها, admin all-instances report, top-bar start for every user

Work Log:
- Audited workspace: most changes were already present (platform checkpoint commits): ProcessStatus enum reduced to DRAFT|ACTIVE in schema.prisma + DTO; i18n t.instances='گزارش فرآیندها'; new shared src/components/processes/start-process-dialog.tsx (exports navigateToInstanceEntry redirect helper); app-shell top-bar شروع فرآیند button (all users) + global dialog; instances-view refactored to shared dialog + ADMIN-only findAll with 403→mine() fallback + new مرحله فعلی (current pending task) column; backend controller @Roles('ADMIN') on GET /process-instances with tasks included; ARCHIVE removed from processes-view filter/chips; DB had zero ARCHIVE rows (3 ACTIVE, 1 DRAFT)
- Ops fix: frontend was 500ing from inotify exhaustion (nest --watch + turbopack both watching; sysctl raise denied). Rebuilt backend dist, changed bpms-backend package.json "dev" from `nest start --watch` to plain `node dist/main.js` (Task 2 precedent), recreated missing bpms-backend/.env (PORT/JWT_SECRET/DATABASE_URL), relaunched stack via official .zscripts/dev.sh (setsid) — survives across tool calls, fe:200 be:201
- Browser E2E verified: admin sidebar گزارش فرآیندها; processes filter only همه/پیشنویس/فعال; report shows ALL 12 instances with وضعیت + مرحله فعلی + شروع‌کننده + dates; top-bar dialog lists only ACTIVE processes; admin start → instance-detail fallback (first task FIXED_USER john); john: no report link, top-bar start leave → lands directly on /tasks/{id} form; john GET /process-instances → 403 → /mine 200 graceful; 0 console errors; test instance defa0f7d terminated
- tsc 18 = baseline; eslint clean (1 pre-existing warning)

Stage Summary:
- ARCHIVE status fully removed from process lifecycle (DRAFT/ACTIVE only)
- /instances is now گزارش فرآیندها (admin-only all-instances report with current-step info); non-admins degrade to own instances
- Every user can start a process from the top bar; redirect-to-form logic shared via navigateToInstanceEntry
- Stack stabilization: backend dev script is non-watch now — do not reintroduce nest --watch while next dev runs (8192 inotify cap)

---
Task ID: 5
Agent: Super Z (main agent)
Task: کارتابل per-user task isolation (users must only see their own tasks) + process report upgrade (the proposed idea)

Work Log:
- Backend tasks: GET /tasks (findAll) now @Roles('ADMIN'); findOne(id, user) enforces visibility via assertVisible — ADMIN / direct assignee / claimed-by-me / unclaimed position-pool task for a held position / fully open task (no owner) — else 403 "You can only view your own tasks"; complete/claim/release thread user context through findOne so completing/claiming also requires visibility
- Backend instances: findOne(id, user) enforces assertParticipant — ADMIN / starter / task assignee on the instance / holder of a position with an unclaimed pool task on it — else 403; terminate(id, user) restricted to starter or ADMIN (was open to any authenticated user); start() return path passes starter context
- Frontend: task-detail-view + instance-detail-view render a proper دسترسی غیرمجاز card (ShieldAlert + explanation + back) on 403 instead of blank page + toast
- Report (گزارش فرآیندها /instances): 4 KPI summary cards (کل/در جریان/تکمیل‌شده/خاتمه‌یافته-ناکام) computed from the loaded scope; new process filter Select (options derived from loaded instances) alongside status filter; terminate button only for ADMIN or row starter (startedById)
- i18n: allProcesses, kpiAllInstances, kpiEndedInstances, accessDeniedTitle, accessDeniedTask, accessDeniedInstance
- Ops discoveries: (1) sandbox shell exports DATABASE_URL=file:/home/z/my-project/db/custom.db (scaffold DB) — backend spawned from a tool shell must pin its own absolute URL or dotenv won't override; (2) sandbox reaps processes spawned from one-off tool shells (documented in bpms-backend main.ts) — new src/app/ensure-backend/route.ts mirrors the existing FrontendSupervisor glue: idempotent GET probes :3001 and spawns backend detached as a child of the long-lived next-server tree (must strip next dev's PORT=3000 env or the backend binds 3000 and crashes — string 3000 also defeats the numeric guard)
- Tests: scripts/test-task-isolation.mjs 16/16 (findAll admin-only; task detail visibility for john/jane/admin; participant checks on a fresh jane-started instance — bob 403, john-as-assignee 200, starter 200; terminate 403 for non-starter, 2xx for starter; mine endpoints healthy). Browser E2E: john cartable 11 rows all "John Doe"; direct URL to jane's task → denied card; admin report shows 4 KPI cards + process filter (11→3 rows when filtered); jane report (mine fallback) KPIs scoped, terminate hidden on john-started rows, visible on her own running row; UI terminate flow toast + row clears; john start→form redirect intact, API complete 201 COMPLETED, cross-user complete 403; 0 console errors; all test instances terminated (0 running)
- tsc: 18 errors identical to baseline except a benign message-text delta on the pre-existing src/lib/api.ts(45,9) TS2322 (same file/line/code; .next/types regeneration changes Headers type rendering); eslint 0 errors, 3 pre-existing unused-directive warnings

Stage Summary:
- کارتابل privacy is now enforced end-to-end: list (mine), detail (findOne visibility), completion/claim/release (authorization behind visibility) — a user cannot view another user's task even by URL or API
- Instance detail + terminate closed the same way (participants only; starter/admin can terminate)
- گزارش فرآیندها upgraded with KPI summary cards + process filter; non-admins keep the graceful own-scope fallback
- ensure-backend route is the sanctioned way to (re)start the backend in this sandbox: curl http://localhost:3000/ensure-backend
