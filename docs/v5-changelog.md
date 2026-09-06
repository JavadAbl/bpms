# BPMS v5 Changelog

Two targeted fixes on top of v4. UI labels are Persian (RTL interface); this summary is in
English for the dev team. Verified by `backend/scripts/test-v5-dashboard-scoping.cjs`
(**23/23 passed**) plus a three-user browser pass (admin / jane / john, zero console errors).

## 1) Dashboard KPIs are fully user-scoped (only ADMIN sees global numbers)

The v3/v4 dashboard already scoped tasks and instances per user, but the
«فرآیندهای فعال» (active processes) KPI was a **global** count — a regular user saw
processes of the whole system, including ones they are not allowed to start.

- `GET /api/dashboard` now computes `activeProcesses` per caller:
  - **USER** → count of ACTIVE processes **they may start** — no starter restriction,
    or they are on the starter list. This is exactly the gate
    `POST /process-instances` enforces (v4 feature 1) and exactly what the
    «شروع فرآیند» dialog offers, so the KPI and the dialog can never disagree.
  - **ADMIN** → global count of all ACTIVE processes (admins bypass the gate).
- All other KPIs were already scoped and are unchanged: pending tasks
  (= `/tasks/mine`), running/completed/terminated instances, 7-day completion trend,
  recent tasks/instances (started by me or has a task for me).
- Frontend «گزارش فرآیندها» (instances page) now calls `GET /process-instances/mine`
  **directly** for non-admins instead of triggering the ADMIN-only global report and
  falling back on 403 (same visible data, one wasted error round-trip less).

## 2) Modal close buttons back at the top corner (was: stretched across the footer)

Every shadcn dialog/sheet showed its ✕ close button as a wide row **at the bottom** of
the modal (reported as "the close btn is in bot in modals").

- **Root cause:** the MD3 `.state-layer` primitive in `globals.css` sets
  `position: relative` and lives in the same Tailwind `@layer utilities` as the
  `.absolute` utility. Source order decides ties inside one cascade layer, so
  `position: relative` silently won over the close button's `absolute top-4 right-4` —
  the ✕ became a relative grid item, stretched to the dialog's full width below the
  footer.
- **Fix (CSS):** `.state-layer:where(:not(.absolute, .fixed, .sticky))` — the
  `position: relative` host rule no longer applies to elements that carry an explicit
  Tailwind position utility. Fixes both `dialog.tsx` and `sheet.tsx` (and any future
  combination) without touching the MD3 hover/press overlay behavior.
- **Fix (RTL):** the ✕ moved from physical `top-4 right-4` to logical
  `top-4 end-4` (top-**left** in the RTL interface) — the mirrored corner, so it can
  never collide with the start-aligned (right) Persian title. `DialogHeader` alignment
  switched `sm:text-left` → `sm:text-start`. Dialogs that place action buttons at the
  header's end side reserve the corner with `pe-12` (form-builder, process-preview).
- Verified visually: start-process dialog, process-preview dialog and the mobile nav
  sheet all show a small absolute ✕ in the top-left corner; no title overlap.

## Ops notes

- Verification suite: `node backend/scripts/test-v5-dashboard-scoping.cjs` (backend on
  :3001; run on a freshly seeded DB — the suite deactivates its test process but
  re-running after residue still passes except the baseline-equality check; re-seed with
  `npx prisma db seed` for a pristine state).
- `tsc --noEmit` baseline unchanged (16 src errors, zero new); eslint clean on all
  changed files (one stale disable-directive removed from `instances-view.tsx`).
