# BPMS v6 Changelog

The **report builder (گزارش‌ساز)** on top of v5 — admin-built custom reports per process.
UI labels are Persian (RTL interface); this summary is in English for the dev team.
Verified by `backend/scripts/test-report-builder.cjs` (**53/53 passed**), the regression
suites (`test-v4-features.cjs` 33/33, `test-v5-dashboard-scoping.cjs` 23/23 on a fresh
seed) and a full admin browser pass (build → preview → save → run → CSV export,
zero console errors).

## 1) Report definitions — declarative, per-process, no code

Admin can now create tabular reports for each process by selecting among the
process's **data fields** and **variables**:

- New `ReportDefinition` model (migration `20260907083020_add_report_definitions`):
  `name`, `description`, `processId`, `columns` (JSON), `filters` (JSON), `createdById`.
  Pure configuration like task assignments — no triggers, no user code. Deleting a
  process cascades its reports.
- **Column sources**:
  - `INSTANCE` — fixed instance fields: status, startedBy, startedAt, completedAt,
    currentStep, durationDays, taskCount, completedTaskCount.
  - `VARIABLE` — a process variable resolved per instance from the merged form
    submissions, using **exactly the same merge semantics as the readOnly prefill
    chain** (`field.variable || field.name`, chronological, later wins) — report
    values can never disagree with what the runtime forms show.
- Column keys follow the `field:<key>` / `var:<name>` convention; optional custom
  Persian `label` per column (default = catalog label).
- **Filters** (all optional, AND-ed):
  - `STATUS` — keep only the listed instance statuses (empty = all)
  - `DATE_RANGE` — inclusive bounds on `startedAt` (pure `YYYY-MM-DD` "to" covers
    the whole day)
  - `VARIABLE` — `name` + `op` (`eq` / `neq` / `contains`) + string value; evaluated
    on the merged variables **independently of the selected columns** (a filter may
    reference a variable the report doesn't display)
- Execution is live on demand — nothing is materialized; rows are computed from
  `ProcessInstance` + `FormSubmission` at call time, newest instance first.

## 2) Backend module (`backend/src/reports/`)

| Method & path | Role | Notes |
|---|---|---|
| `GET /reports` · `GET /reports/:id` | 🌐 | list/detail with parsed columns/filters + process + createdBy |
| `GET /reports/field-catalog/:processId` | 🌐 | selectable fields: 8 fixed instance fields + variables = declared `ProcessVariable` ∪ form-field variables, **select options resolved from categories with Persian labels** (inline fallback — same resolution as the runtime form) |
| `POST /reports` · `PATCH /reports/:id` · `DELETE /reports/:id` | 🔒 | admin writes; validation: ≥1 column, unique keys, known INSTANCE fieldKeys, statuses∈enum, `from ≤ to`, variable-filter completeness — Persian 400 messages |
| `POST /reports/preview` | 🔒 | execute an **unsaved** config (the builder's «پیش‌نمایش») — same code path as execute, so preview ≡ saved result |
| `POST /reports/:id/execute` | 🌐 | run a saved report → `{ report, process, columns[], rows[], total, byStatus, generatedAt }`; column meta carries `type` + `options` so clients render rich cells |

Reads/execute stay open to every authenticated user (same visibility as the global
instance report); the builder UI itself lives under the ADMIN-guarded `/admin/reports`.

## 3) Frontend

- New route **`/admin/reports`** (ADMIN guard via the `/admin` layout), sidebar item
  «گزارش‌ساز» (icon rail + command palette entry).
- `components/views/reports-view.tsx` — list of saved reports (MUI DataGrid: name,
  process, column/filter counts, createdBy, updated) with run/edit/delete actions
  and an empty-state card.
- `components/reports/report-builder-dialog.tsx` — the no-code designer: name /
  description / process pick → **column checkboxes in two groups**
  («داده‌های نمونه فرآیند» + «متغیرهای فرآیند» with `code` hints), ordered
  removable selection chips, filters (status checkboxes, date range, dynamic
  variable-filter rows), **live preview table** before saving, create & edit modes.
- `components/reports/report-runner-dialog.tsx` — executes a saved report: KPI row
  (total/running/completed/ended), client-side status filter + search, dynamic
  DataGrid columns rendered by type (status chips, Persian dates, select labels,
  boolean بله/خیر, file counts, durations), row-click → instance timeline,
  **CSV export** (BOM so Persian survives Excel) and refresh.
- `components/reports/report-value.tsx` — the ONE value formatter feeding the
  grid, the preview table and the CSV so all three can never disagree.
- `lib/api.ts` gained a fully typed `reportsApi`; `lib/i18n.ts` the Persian
  dictionary block.

## 4) Seed & ops

- Seed now also wipes `reportDefinition` and seeds two example reports for the
  leave process: «گزارش مرخصی‌ها» (9 columns, no filters) and «مرخصی‌های تکمیل‌شده»
  (5 columns, STATUS=COMPLETED). `backend/scripts/create-demo-report-data.cjs`
  optionally adds one realistic completed instance.
- Checkout-relocation fixes: the backend `dev` script's absolute `DATABASE_URL` now
  points at `backend/db/bpms.db` of this checkout, and the `main.ts`
  FrontendSupervisor resolves the frontend dir **relative to the backend**
  (`FRONTEND_DIR` env overrides) instead of the old hardcoded workspace path.
- New E2E: `node backend/scripts/test-report-builder.cjs` — 53 checks: seeded
  regression, catalog merging, permissions (USER read/execute OK, writes/preview
  403), validation 400s, full instance data flow (values appear while RUNNING and
  after COMPLETED), all three filter kinds, preview ≡ execute, PATCH, cleanup.
