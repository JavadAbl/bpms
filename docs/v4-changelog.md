# BPMS v4 Changelog

All changes shipped in v4 on top of the v3 baseline. UI labels are Persian (RTL interface);
this summary is in English for the dev team. Verified by `backend/scripts/test-v4-features.cjs`
(**28/28 passed**) plus a multi-user browser pass (admin / john / jane) with zero console errors.

## 1) Process starters — the START event's assignment (شروع‌کنندگان مجاز)
- **New `ProcessStarter` model** (`process_starters`, migration `20260906062800_add_process_starters`):
  `processId + userId` unique. An **empty set means every user may start** (default,
  backward compatible with all v1–v3 flows); a non-empty set restricts starting to its
  members, and **ADMINs always may** (god-mode so flows never dead-end).
- Configured **declaratively from the BPMN designer**: right-click the **start event** →
  «تعیین شروع‌کنندگان» opens the assignment dialog (all-users vs. selected group,
  searchable user list with role badges). Also reachable from the «شروع: …» chip in the
  designer header. The chip shows the current state («شروع: همه کاربران» / «شروع: N کاربر»).
- **Server-enforced** in `POST /process-instances`: non-starters get **403** with the Persian
  message «شما مجاز به شروع این فرآیند نیستید…». Starters and admins pass.
- Endpoints: `GET /processes/:id/starters`, `PUT /processes/:id/starters {userIds}`
  (admin-only, replace-all transaction; unknown ids → 400; empty array lifts the restriction).
  `POST /processes` accepts an optional `starterIds[]` so the restriction is created together
  with the process (see feature 4). Process list/detail serialize `starters[]` with user info.
- **«شروع فرآیند» dialog filters per user**: processes whose starter list excludes the
  current user (and who is not admin) never appear; restricted ones carry a «محدود» badge.

## 2) کارتابل = received tasks only (وظایف دریافتی)
- `GET /tasks/mine` (and the admin `GET /tasks`) now return **PENDING tasks exclusively** —
  a completed/passed task leaves the inbox immediately. History stays visible on the
  instance timeline (گزارش فرآیندها / instance detail), which is where it belongs.
- **سوابق کارتابل (follow-up):** the dedicated participated-tasks view landed on top of
  this — new `GET /tasks/participated` returns the caller's once-received tasks that have
  since passed (`COMPLETED` by them, `CANCELLED` when the instance ended), newest first,
  strictly disjoint from the pending inbox. UI: `/tasks/participated` («سوابق کارتابل»
  in the sidebar & command palette) with status filter chips, search, instance-status
  column and read-only task detail deep-links (`?from=participated` makes the breadcrumb
  return there). Completing "open" tasks (no assignee/position) now also records the
  completer so those land in their history too.
- The کارتابل page dropped its «همه/در انتظار/انجام‌شده» status filter (it is meaningless
  now) and shows the pending count as «N در انتظار اقدام».

## 3) Fully no-code gateway conditions
- The condition dialog (right-click a gateway → «مدیریت شرط‌ها», or a flow → «ویرایش شرط»)
  builds conditions **without any code**: variable dropdown (Persian labels) + operator
  dropdown + **value dropdown** for select-type variables. The generated XML still uses the
  engine-mandated contract (`language="javascript"` + `next(null, …)`) — invisible to the
  designer. The raw-JS «عبارت» mode remains available as an advanced escape hatch.
- **Value options mirror the runtime form exactly**: category-backed fields resolve their
  items from the global category (stable `value` + Persian `label` — e.g. `Sick` /
  «مرخصی استعلاجی»); inline options fall back as before. Declared process variables are
  enriched with the options of a same-named form field, so the seeded «leaveType» gets its
  dropdown too.
- Verified end-to-end: dialog → canvas → designer Save → server XML (version bump) → a live
  instance routed correctly through the XOR gateway (E2E feature-3 section, 13 checks).

## 4) Create-on-save: no process row until the designer saves it
- Clicking «ایجاد فرآیند» (processes page) now opens the designer at
  `/processes/new/design` in **new mode** with a blank diagram and **zero server calls**.
- The header gets name (+ description) inputs, a «ایجاد جدید — هنوز ذخیره نشده» badge and
  the button reads «ایجاد و ذخیره». The **only** creation point is that button:
  `POST /processes {name, description, bpmnXml, starterIds?}` — then assignments,
  variables and starters are applied, the URL silently becomes
  `/processes/<real-id>/design` (refresh-safe) and the designer switches to edit mode
  («نسخه 1» chip, «فعال‌سازی» button).
- New-mode guards: form creation is disabled with a hint («ابتدا فرآیند را ذخیره کنید» —
  forms need a processId); variables and starters are staged locally and applied on save.

## Ops notes
- Verification suite: `node backend/scripts/test-v4-features.cjs` (backend must be running
  on :3001; idempotent reruns reuse the leftover test process because terminated instances
  block process deletion via FK restrict).
- `prisma/seed.ts` now also wipes `process_starters` (FK-safe order). The seeded demo
  remains **unrestricted** (starters = []) so all existing E2E flows keep working.
- Frontend `tsc --noEmit` baseline is unchanged (16 src errors after excluding `scripts/`;
  zero new errors introduced).
