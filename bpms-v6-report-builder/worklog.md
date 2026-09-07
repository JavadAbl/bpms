# BPMS Worklog (append-only — add your entry at the end, never overwrite)

Template:

```
---
Task ID: <id>
Agent: <who>
Task: <what was requested>

Work Log:
- <concrete step>

Stage Summary:
- <key results / decisions / artifacts>
```

---
Task ID: v4-1
Agent: Super Z (GLM)
Task: Implement the four v4 requirements on top of the v3 baseline

Work Log:
- Read the full v3 codebase (docs, designer, modals, views, backend services, schema, seed)
- Feature 2 (کارتابل pending-only): `tasks.service.findMine/findAll` filter `status: 'PENDING'`;
  tasks-view dropped the all/DONE status filter; controller docs updated
- Feature 1 (process starters): new `ProcessStarter` model + migration
  `20260906062800_add_process_starters`; `GET/PUT /processes/:id/starters` (admin PUT,
  replace-all transaction, unknown ids → 400); `POST /processes` accepts `starterIds[]`;
  list/detail serialize starters; `start()` takes the full user and enforces the restriction
  (403 «شما مجاز به شروع این فرآیند نیستید…», admin bypass); new StartProcessDialog filter
  (per-user + «محدود» badge); designer: start-event context-menu entry «تعیین شروع‌کنندگان»,
  `ProcessStartersModal` (all-users vs selected group, searchable, role badges), «شروع: …»
  header chip; restrictions staged and applied on designer Save
- Feature 4 (create-on-save): designer "new" mode no longer POSTs a draft on open — the only
  creation point is «ایجاد و ذخیره» (then assignments/variables/starters applied, URL
  replace to the real id, edit-mode UI); forms tab disabled in new mode; variables/starters
  staged locally
- Feature 3 (no-code conditions): `ConditionVariable.options` became `{value,label}[]`;
  designer resolves field options EXACTLY like the runtime form (category items with Persian
  labels, inline fallback) and enriches declared process variables with same-named field
  options; the condition modal renders a value dropdown for select-type variables (both in
  the builder and the dry-run tester); context-menu entries already existed for
  gateways/flows — verified
- Added `backend/scripts/test-v4-features.cjs` (28 checks) — starter restriction paths,
  pending-only inbox, condition contract + full Annual routing, create-with-starters;
  idempotent reruns (reuses the leftover test process — terminated instances block deletion)
- seed.ts: explicit `processStarter.deleteMany()` in the wipe; seeded demo stays unrestricted
- Docs: `docs/v4-changelog.md`, domain-guide §2.0 + §3, api-reference, development-guide,
  README invariants 6–7

Stage Summary:
- Verification: `test-v4-features.cjs` **28/28 passed** (three consecutive runs, including
  one against modal-generated `==` conditions); browser pass (admin/john/jane) with ZERO
  console errors — designer new-mode creates nothing until Save (process count unchanged),
  starters dialog → save → starters=[john] on the server, jane's start dialog hides the
  john-restricted process while john sees it with «محدود» badge, کارتابل shows pending
  only and the completed task disappears after submission, condition modal saves
  language="javascript" + next(null,…) XML and the version bumps 1→2→3 on revert
- Frontend `tsc --noEmit`: 16 src errors = the documented baseline minus the 2
  `scripts/fix-seed-di.ts` ones (folder now excluded) — zero new errors
- Backend: `nest build` clean; Prisma client regenerated after migration
- DB re-seeded to the pristine demo after testing (single «فرآیند درخواست مرخصی» v1, starters=[])

---
Task ID: v6-1
Agent: Super Z (GLM)
Task: Report builder for admin — create per-process reports by selecting among process data and vars

Work Log:
- Read the full v5 codebase (docs, AGENTS.md, schema, all backend services, frontend views/shell/api/i18n, seed)
- Schema: new `ReportDefinition` model (columns/filters JSON, process FK cascade, createdBy) +
  migration `20260907083020_add_report_definitions`; relations added to Process/User
- Backend: new `reports` module — CRUD (admin writes; reads open to all users like the global
  instance report), `GET /reports/field-catalog/:processId` (8 fixed instance fields +
  variables = declared ProcessVariable ∪ form-field variables, select options resolved from
  categories with Persian labels), `POST /reports/preview` (unsaved config) and
  `POST /reports/:id/execute` (live rows) sharing one execution path; filters: STATUS /
  DATE_RANGE (inclusive, pure-date "to" covers the day) / VARIABLE (eq|neq|contains on the
  merged instance variables, independent of selected columns); Persian 400 validation
  (empty columns, duplicate keys, unknown INSTANCE fieldKeys, bad statuses, inverted range)
- Variable merge in `ReportsService` deliberately mirrors `TasksService.getInstanceVariables`
  (prefill-chain semantics) so report values always match runtime form data
- Frontend: `/admin/reports` route + sidebar «گزارش‌ساز» + command palette entry;
  `reports-view` (list grid + delete confirm + empty state), `report-builder-dialog`
  (process select → catalog checkbox groups with ordered removable chips → status/date/
  variable filters → live preview table → save; edit mode prefilled), `report-runner-dialog`
  (KPI cards, client-side status/search, dynamic DataGrid rendered by column type with
  status chips + Persian dates + select labels + بله/خیر + file counts, row click → instance
  timeline, CSV export with BOM), `report-value.tsx` single formatter for grid/preview/CSV
- Fixed a controlled/uncontrolled Select warning (process + variable-filter selects →
  defaultValue pattern + stable row uid keys)
- Ops for this checkout: backend `dev` script DATABASE_URL repointed to `backend/db/bpms.db`,
  FrontendSupervisor cwd resolved relative to backend (`FRONT_DIR` env override), `.env` created
- Seed: wipes reportDefinition + seeds «گزارش مرخصی‌ها» (9 cols) and «مرخصی‌های تکمیل‌شده»
  (5 cols, STATUS=COMPLETED); added `scripts/create-demo-report-data.cjs` (realistic
  completed Annual instance)
- E2E: `backend/scripts/test-report-builder.cjs` — 53 checks (seeded regression, catalog merge
  + Persian options, USER read/execute vs 403 writes/preview, validation 400s, full instance
  flow values RUNNING→COMPLETED, all filter kinds, preview ≡ execute, PATCH custom label,
  cleanup)
- Docs: v6-changelog, api-reference (Reports section), domain-guide §4 note, README v6 section,
  AGENTS.md module map + verification list

Stage Summary:
- Verification: test-report-builder.cjs **53/53**; regression suites on a fresh seed:
  test-v5-dashboard-scoping.cjs **23/23**, test-v4-features.cjs **33/33**; admin browser pass
  (login → list → run seeded report → builder create/preview/save → edit prefilled → CSV
  click → john blocked with «شما به این بخش دسترسی ندارید») with ZERO console errors after
  the Select fix; backend `tsc --noEmit` clean; frontend tsc = documented baseline (16 src
  errors, zero new — the duplicate `holders` key is pre-existing)
- Final DB state: fresh seed + one realistic demo instance (علی رضایی — Annual — تایید) so the
  گزارش‌ساز shows meaningful data on first open
- Artifacts: migration 20260907083020, `backend/src/reports/*`, `frontend/src/components/reports/*`,
  `components/views/reports-view.tsx`, `app/(app)/admin/reports/page.tsx`,
  `backend/scripts/test-report-builder.cjs`, `backend/scripts/create-demo-report-data.cjs`,
  `docs/v6-changelog.md`, `docs/screenshot-report-runner.png`
