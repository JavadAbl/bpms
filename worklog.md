# Project Worklog

---
Task ID: 1
Agent: Super Z (main agent)
Task: Extract uploaded bpms.zip and set it up as the primary fullstack project (NestJS backend + Next.js frontend)

Work Log:
- Initialized fullstack dev environment via init-fullstack.sh (base Next.js 16 scaffold at /home/z/my-project)
- Extracted /home/z/my-project/upload/bpms.zip → contained `bpms-backend/` (NestJS 11 + Prisma/SQLite + bpmn-engine) and `frontend/` (Next.js 16 + Tailwind 4 + shadcn/ui + bpmn-js designer, Persian RTL UI)
- Promoted frontend to project root: replaced src/, public/, and config files (next.config.ts, tailwind.config.ts, tsconfig.json, components.json, postcss.config.mjs, eslint.config.mjs)
- Root package.json merged: added @xyflow/react ^12.11.6 and bpmn-js ^18.27.0, plus allowScripts block; kept scaffold dev script (tee dev.log) and db:push (required by dev.sh)
- Moved NestJS backend to mini-services/bpms-backend (sandbox mini-service convention; auto-started by .zscripts/dev.sh via its `dev` script)
- Fixed frontend/src/lib/api.ts: replaced hardcoded LAN API base `http://192.168.1.44:3001/api` with relative `/api` (proxied by next.config.ts rewrites → localhost:3001)
- Backend env: created mini-services/bpms-backend/.env (PORT=3001, JWT_SECRET, DATABASE_URL); dev script pins DATABASE_URL explicitly because the sandbox shell exports DATABASE_URL=file:/home/z/my-project/db/custom.db globally (dotenv does not override existing env vars)
- Database: applied 4 existing migrations + generated reconciliation migration `20260902171705_sync_form_process_id` (uploaded project had schema/migration drift: forms.processId existed in schema.prisma but in no migration); seeded via bun prisma/seed.ts (4 users, 3 departments, 7 positions, 5 forms, 2 BPMN processes: Leave Approval, Expense Approval)
- Started Next.js dev (port 3000, setsid detached) and NestJS backend (port 3001, nest start --watch); logs: /home/z/my-project/dev.log and /home/z/my-project/.zscripts/mini-service-bpms-backend.log
- Verified end-to-end with agent-browser: login page renders (Persian RTL), admin login succeeds, dashboard navigation works, process definitions list shows seeded data, BPMN designer + forms panel render, zero console errors

Stage Summary:
- Primary project = BPMS fullstack system: Next.js frontend at root (port 3000) + NestJS backend at mini-services/bpms-backend (port 3001, auto-restart watch mode)
- API proxy chain verified: browser → :3000/api/* → Next.js rewrite → :3001/api/*
- Seeded accounts: admin@bpms.local/admin123 (ADMIN); john|jane|bob@bpms.local/user123 (USER)
- Swagger UI available at /api/docs (via proxy)
- Key files for future updates: src/ (frontend), mini-services/bpms-backend/src/ (backend), mini-services/bpms-backend/prisma/ (DB schema/migrations/seed)

---
Task ID: 2
Agent: Super Z (main agent)
Task: Fix BPMN designer console error "Keyboard binding is now implicit; explicit binding to an element got removed" (diagram-js >= 8 breaking change)

Work Log:
- Removed deprecated `keyboard: { bindTo: window }` option from BpmnModeler constructor in src/components/bpmn/bpmn-designer.tsx (binding is now implicit; shortcuts still work)
- While verifying, discovered a second pre-existing console error: "no diagram to display" — both seeded processes' BPMN XML had NO <bpmndi:BPMNDiagram> DI section (namespace declared but never used), so bpmn-js could not render them
- Added full DI sections (BPMNShape bounds + BPMNEdge waypoints) for both Leave Approval and Expense Approval XML templates in mini-services/bpms-backend/prisma/seed.ts, plus missing xmlns:di declaration
- Created one-off patch script (scripts/fix-seed-di.ts, runnable copy at mini-services/bpms-backend/scripts/) that injects the DI sections into the existing DB rows without re-seeding; ran successfully (Leave 2482→4592 chars, Expense 5514→10841 chars)
- Note: bun resolves imports from the script's own path upward — running scripts that use the backend's @prisma/client must live inside mini-services/bpms-backend/
- Browser-verified both processes: Leave Approval renders 15 djs-elements, Expense Approval renders 32 (inclusive gateway 3-branch routing + parallel split/join all visible), console 100% clean

Stage Summary:
- Designer now error-free: no keyboard.bindTo deprecation error, no "no diagram to display"
- Seeded diagrams fully visible/editable in the BPMN designer; future seeds (prisma/seed.ts) include DI from the start
- Screenshots for reference: download/bpms-designer-final.png, download/bpms-expense-final.png

---
Task ID: 3
Agent: Super Z (main agent)
Task: Add gateway condition editing to the BPMN process designer

Work Log:
- Reverse-engineered bpmn-engine/bpmn-elements condition evaluation (dist/condition.js, flows/SequenceFlow.js, bpmn-engine lib/index.cjs Scripts):
  * conditionExpression WITHOUT language attr falls back to the dumb template resolver — raw JS body returns as a truthy string, so gateway ALWAYS takes the first flow (verified: bug reproduced)
  * CORRECT format: <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, <js expr>)</bpmn:conditionExpression> — language="javascript" registers a node_vm ScriptCondition; body MUST call next(err, result) or the gateway hangs
  * Variables reachable as environment.variables.<name> (backend merges form data into api.environment.variables in signalTask); matches seed.ts format
- Created src/components/processes/gateway-condition-modal.tsx:
  * For XOR/inclusive gateways: lists all outgoing flows, per-flow condition editor (simple mode: variable select + operator ==/!=/>/>=/</<= + typed value with number/checkbox-aware quoting; expression mode: raw JS with variable chips)
  * Generates next(null, ...) wrapper + language="javascript"; parses existing conditions back into editor; preserves hand-written (non-wrapped) scripts untouched
  * Default-flow radio (gateway default attr, condition auto-cleared on default flow), XML preview per row, XOR-unguarded warning banner, clear-condition, validation errors
- Updated src/components/bpmn/bpmn-designer.tsx:
  * onConditionAction prop (latest-ref pattern), context menu items (مدیریت شرط‌ها on gateways / ویرایش شرط on flows), toolbar ⚡شرط button (enabled for gateways+flows)
  * syncConditionOverlays(): yellow ⚡ badge overlays on flows having conditionExpression (synced on import + debounced element.changed); clicking a badge opens the editor via data-container-id delegation
- Added badge CSS to bpmn-designer.css; wired modal into process-designer-view.tsx with merged dedup variables (process vars + form field vars); updated VariablesTab hint
- Browser-verified full cycle: badge click → modal parses seed conditions correctly (Leave Type ==/!= 'Sick') → edited/cleared/re-created conditions → header save → API confirms persisted XML has language="javascript" + next(null,...)
- Final integration test (scripts/test-final-integration.cjs): ran ACTUAL persisted XML through real bpmn-engine — Sick→Auto-Approved PASS, Annual→Approved PASS, Unpaid→Approved PASS
- Typecheck: zero new errors vs baseline (pre-existing unknown-type errors in designer unchanged; only 2 introduced by badge handler were fixed with casts)

Stage Summary:
- Users can now set/edit/clear gateway conditions via right-click menu, toolbar ⚡ button, or clicking the ⚡ badge on conditioned flows
- Generated XML is engine-exact (language="javascript" + next(null, expr) wrapper) — no silent always-first-branch bug
- New files: src/components/processes/gateway-condition-modal.tsx, scripts/test-final-integration.cjs; modified: bpmn-designer.tsx/.css, process-designer-view.tsx

---
Task ID: 4
Agent: Super Z (main agent)
Task: Add global "Categories" (دسته‌بندی‌ها) section — reusable value/label option lists for form dropdowns, with inline-option fallback in form builders

Work Log:
- Prisma: added Category (id, key unique, name, description) + CategoryItem (categoryId FK cascade, value, label, sortOrder, @@unique([categoryId, value])) models; migration 20260902194206_add_categories applied + client regenerated
- Backend: new categories NestJS module (dto/service/controller/module) registered in AppModule — GET open to all authenticated users (form fillers need it), POST/PATCH/DELETE admin-only; PATCH replaces the whole items list atomically (nested write); duplicate values → 409; key regex ^[a-zA-Z][a-zA-Z0-9_]*$ so values stay condition-safe
- Usage scan: CategoriesService.findAll parses every form's fields JSON and returns usage {formCount, formNames} per category so the UI can show/warn on delete
- Fixed latent DTO bug discovered by testing: ValidationPipe(whitelist) was silently stripping categoryId/placeholder/defaultValue from form field JSON — added these optional props to FormFieldDto (categoryId now persists)
- seed.ts: added leave_types category (Annual/Sick/Unpaid with Persian labels) + wired Leave Request Form's leaveType field to it (inline options kept as fallback snapshot)
- Frontend: categoriesApi + Category types in lib/api.ts; new use-categories hook (module-level cache, invalidateCategories(), loadCategories(force)); OptionSelect shared component (category-backed → item.value stored/item.label shown; inline fallback) + CategoryChip
- New views/categories-view.tsx (RTL, emerald theme): category cards with key chip, item badges, usage count, edit/delete (delete confirm lists referencing forms); create/edit dialog with auto-slug key from latin name, item rows editor (value LTR mono + label + reorder + delete)
- app-shell: sidebar «دسته‌بندیها» entry (Tags icon, admin-only) + categories view route
- form-builder.tsx + form-builder-panel.tsx (process designer): select fields now have «منبع گزینه‌ها» source picker (inline textarea vs reusable category); CategoryOptionsPreview lists live category items; CategoryChip on field cards; PreviewForm uses OptionSelect
- Runtime: dynamic-form.tsx + task-detail-view.tsx renderField select case now use OptionSelect (category items resolve at fill time)
- E2E verified via agent-browser: categories CRUD (created request_priority with 3 items), Leave Request Form properties show «انواع مرخصی (leave_types)» + live items, seeded leave_types via API and wired to the real form
- FULL LOOP TEST: logged in as john → opened pending Submit Request → dropdown showed Persian labels from category (مرخصی سالانه/استعلاجی/بدون حقوق) → selected Sick → submitted → engine evaluated leaveType==='Sick' → instance COMPLETED via Auto-Approved branch (verified in DB: submission stored value "Sick", instance d6813c86 completed with no Approve task)
- Logs clean: backend 0 TS errors, frontend dev.log clean, browser console clean; lint: only pre-existing errors (scripts/*.cjs, gateway-condition-modal)

Stage Summary:
- Categories are a first-class global entity: sidebar CRUD → forms reference by categoryId → dropdowns render live items everywhere (builder preview, runtime fill, DynamicForm)
- value/label split preserves gateway-condition semantics (labels are Persian, stored values are condition-safe identifiers)
- Deleting a category doesn't break forms — they fall back to their inline options snapshot
- Key files: mini-services/bpms-backend/src/categories/*, src/components/views/categories-view.tsx, src/components/common/option-select.tsx, src/hooks/use-categories.ts, src/components/forms/form-builder*.tsx, src/components/common/dynamic-form.tsx

---
Task ID: 5
Agent: Super Z (main agent)
Task: Read-only form fields to display data filled in previous tasks (prefill from process instance variables)

Work Log:
- Confirmed the approach: per-field readOnly flag in form builder + automatic prefill from the instance's earlier submissions + empty-readonly stripping on submit
- Backend FormFieldDto: added optional readOnly prop (ValidationPipe whitelist would otherwise strip it)
- Backend tasks.service.ts: new getInstanceVariables() — merges ALL FormSubmissions of ALL tasks in the instance (chronological), maps field keys to engine variable names (field.variable || field.name, raw key kept as alias); exposed as instanceVariables in GET /api/tasks/:id
- Frontend dynamic-form.tsx: FormField.readOnly support (per-field disabled = global readOnly || field.readOnly); validateDynamicForm skips readOnly required fields
- Frontend task-detail-view.tsx: prefill chain = instanceVariables (by variable||name) → field defaultValue → own latest submission (highest priority); readonly fields render disabled with gray bg + Lock icon + contextual hint («مقدار واردشده در وظیفه قبلی» when populated, «این فیلد از داده‌های وظایف قبلی...» when empty); blue info banner when form has any readonly field; added client-side required validation on complete (readOnly excluded); empty readonly values are stripped from the completion payload so they never overwrite real variables
- Form builders (form-builder.tsx + form-builder-panel.tsx): «فقط‌خواندنی» checkbox in field properties with hint, Lock badge on field cards
- i18n: readOnlyField / readOnlyHint / readOnlySourceHint / invalidFormTitle (Persian)
- Seed.ts: Approval Form now includes 5 readOnly mirrors of the Submit Request fields (employeeName, leaveType with leave_types category, startDate, endDate, reason) before decision/comment
- DB patch script mini-services/bpms-backend/scripts/add-readonly-approval-fields.cjs (idempotent, mirrors metadata from the request form; must run with pinned DATABASE_URL=file:.../db/bpms.db — sandbox global override strikes again); patched live Approval Form (5 readonly mirrors added)
- E2E (agent-browser): john submitted Sick leave (all fields) → instance auto-approved via gateway (correct, no Approve task); john submitted Annual leave (full data) → jane's Approve Request form showed ALL readonly fields locked + populated (John Doe, «مرخصی سالانه», dates, reason) with editable Decision/Comment → approved → instance COMPLETED (verified via API); also verified old instances display only what was actually submitted back then; zero console errors
- Typecheck: only pre-existing baseline errors remain (bpmn-designer unknowns, form-builder processId type mismatch, i18n description_ dup — all present in stale frontend/ copy too); one new TS error (duplicate t import) fixed

Stage Summary:
- Later task forms can now display earlier tasks' data as locked fields: builder marks field readOnly → runtime pre-fills from instance variables → user cannot edit → engine still completes normally
- Empty readonly fields never submitted, so no variable can be overwritten with empty values
- Key files: tasks.service.ts (getInstanceVariables), task-detail-view.tsx (prefill+readonly render+validation), dynamic-form.tsx, form-builder*.tsx, scripts/add-readonly-approval-fields.cjs
- Remaining approved backlog: gateway-condition follow-ups (E2E instance routing live-test tooling → condition dry-run tester → save-time validation → condition labels in print/preview)

---
Task ID: 6
Agent: Super Z (main agent)
Task: Save-time gateway-condition validation + condition labels on print/preview views

Work Log:
- Save-time validation now enforced at 3 layers:
  * Backend (authoritative): new mini-services/bpms-backend/src/bpmn/condition-validator.ts — regex-scans sequenceFlow/conditionExpression pairs (handles bpmn:/bpmn2:/bare ns + self-closing flows AND self-closing empty conditions, decodes XML entities before compiling). Rejects: (a) JS SyntaxError via new Function compile, (b) missing/non-"javascript" language attr (the always-first-branch template trap; engine accepts javascript|js case-insensitive per lib/index.cjs), (c) javascript body without a next( call (gateway hang), (d) empty condition bodies. Wired into ProcessesService.create + update (when bpmnXml given) AND activation gate: PATCH status=ACTIVE validates stored-or-new XML and 400s with per-flow messages.
  * Frontend designer gate: new src/lib/condition-validation.ts (browser mirror, Persian messages) — process-designer-view.tsx handleSave + handleActivate run validateConditionXml(bpmnXml) before any API call and abort with a destructive toast listing each invalid flow («ذخیره انجام نشد — شرط نامعتبر» / «فعال‌سازی انجام نشد — شرط نامعتبر»). Condition modal's own per-row validation (pre-existing) remains the first line of defense.
  * IMPORTANT FIX found by own E2E: original FLOW_RE paired each self-closing <sequenceFlow/> with the NEXT flow's closing tag, misattributing conditions to the wrong flow id — fixed regex to /<(?:bpmn:|bpmn2:)?sequenceFlow\b([^>]*?)(?:\/>|>([\s\S]*?)<\/...>)/ with inner group; both mirrors updated (error messages now name the real flow, e.g. «مسیر شرطی» Flow_bad).
- Condition labels on print/preview:
  * process-preview-dialog.tsx: added «چاپ» button (window.print) in the dialog header; printable content (diagram + routing-condition list) wrapped in .process-print-area; print-only header (process name + fa-IR date) via hidden print:block; hint row class .process-print-hide.
  * globals.css @media print isolation: body:has(.process-print-area) > *:not(:has(.process-print-area)) display:none (hides app shell + modal overlay without JS class toggling); dialog-content reset to static full-width; dialog-header/close/hints hidden; condition <code> labels un-truncated on paper; print-color-adjust: exact.
  * TWO HARD-WON CSS GOTCHAS (documented in globals.css comments): (1) Tailwind 4 dialogs center via the INDIVIDUAL `translate` property — resetting `transform` does nothing; (2) Next 16's LightningCSS minifier silently DROPS identity resets (`translate: none`, even `translate: 0 0` gets merged into `transform: none`) — the surviving fix is zeroing the Tailwind custom properties: --tw-translate-x: 0 !important; --tw-translate-y: 0 !important. Verified in the compiled chunk.
- E2E verified:
  * scripts/test-condition-validation.cjs: 9/9 PASS — 4 broken XML variants rejected 400 on create (syntax error / missing language / no next() / empty condition, each naming the right flow), valid XML 201, activation 200, broken-XML PATCH 400, cleanup 200; seeded Leave/Expense re-save regression PASS (no false positives on real next()-wrapped conditions).
  * Browser (agent-browser): broken process injected directly into DB (scripts/insert-broken-process.cjs, DATABASE_URL pinned) → designer Save blocked with Persian toast, Activate blocked, version stayed 1, XML unchanged, API activation 400; Leave Approval preview shows چاپ button + ⚡ badges + condition list; print PDFs (download/bpms-process-print-preview.pdf) show clean page: print header + full diagram with condition labels + routing list, zero app chrome; console 0 errors.
  * Typecheck: 16 pre-existing src/ baseline errors, count identical with changes stashed — zero new.
- ENV NOTE: frontend hit OS inotify limit (8192) — backend `nest start --watch` (bun run dev) alone holds ~7669 watches, starving Turbopack → persistent 500s + stale CSS chunks. Workaround applied: backend now runs WITHOUT watch (node dist/main, DATABASE_URL pinned to db/bpms.db), dev server restarted with rm -rf .next. To restore watch mode later, first raise fs.inotify.max_user_watches (not permitted in this sandbox) or nest-watch fewer dirs. Also hit stale served CSS after edits — full .next delete + restart was required; never trust dev.log (old server logged to /dev/null, check .zscripts/mini-service-bpms-backend.log).

Stage Summary:
- Invalid gateway JS can no longer reach the DB: blocked in the condition modal, at the designer Save/Activate buttons, and server-side on create/update/activate — with correct flow attribution and actionable messages
- Process preview is now printable: one click produces a paper-ready page (diagram + ⚡ condition labels + full routing-condition list)
- New files: mini-services/bpms-backend/src/bpmn/condition-validator.ts, src/lib/condition-validation.ts, scripts/test-condition-validation.cjs, scripts/insert-broken-process.cjs
- Modified: processes.service.ts, process-designer-view.tsx, process-preview-dialog.tsx, globals.css
- Artifacts: download/bpms-save-gate-rejection.png, download/bpms-preview-dialog-print-button.png, download/bpms-process-print-preview.pdf
- Remaining approved backlog: gateway-condition E2E live instance-routing tooling (dry-run tester + integration test already exist; live in-app instance test view remains)

---
Task ID: seed-persian-reset
Agent: main (Super Z)
Task: Clear DB (keep users) + seed a complete working Persian process example

Work Log:
- Rewrote mini-services/bpms-backend/prisma/seed.ts: wipes ALL data EXCEPT users (submissions→tasks→assignments→instances→variables→processes→forms→categories→userPositions→positions→departments); existing users looked up by email and reused (ids/passwords untouched); created only if missing
- Seeded Persian org structure: departments مهندسی/منابع انسانی/مالی + 4 positions (کارشناس فنی، مدیر مهندسی، مدیر منابع انسانی، کارشناس مالی) linked to preserved users (john→کارشناس، jane→مدیر مهندسی+کارشناس مالی، bob→مدیر منابع انسانی)
- Seeded category leave_types «انواع مرخصی»: values Annual/Sick/Unpaid with Persian labels (مرخصی استحقاقی/استعلاجی/بدون حقوق)
- Seeded process «فرآیند درخواست مرخصی» (ACTIVE): شروع → ثبت درخواست مرخصی → XOR تصمیم نوع مرخصی → {Sick→پایان تایید خودکار | Annual→تایید مدیر مستقیم | Unpaid→تایید منابع انسانی} → XOR ادامه مسیر → اطلاع‌رسانی نتیجه → پایان تکمیل شد; conditions use engine format next(null, environment.variables.leaveType === 'X'); full BPMNDI layout included
- 3 Persian forms (فرم درخواست/فرم تایید with readOnly mirrors + Persian decision options تایید/رد/فرم اطلاع‌رسانی), 7 ProcessVariables (Persian labels), 4 TaskAssignments (taskName matches Persian userTask names exactly)
- Restarted backend via watch (content edit) — clean bootstrap, no stale instance recovery
- Wrote + ran scripts/test-persian-process-e2e.cjs: 3 scenarios via real API (john starts instance, completes ثبت; jane/bob approve; john notifies)

Stage Summary:
- DB state: 1 Persian process, 3 forms, 1 category (3 items), 4 positions, 4 assignments, 4 users preserved, 0 instances/tasks
- E2E ALL PASS: Sick→auto-approve COMPLETED (no approval task), Annual→jane→notify→COMPLETED, Unpaid→bob→notify→COMPLETED; gateway conditions verified end-to-end
- Files: prisma/seed.ts (rewritten), scripts/test-persian-process-e2e.cjs (new)
- Known sandbox quirks: DATABASE_URL must be pinned for any direct prisma/seed run; nest watch restarts only on real content changes (touch alone insufficient)

---
Task ID: remove-condition-badges
Agent: main (Super Z)
Task: Remove ⚡ condition labels/badges on gateways (restore original bpmn-js canvas form)

Work Log:
- bpmn-designer.tsx: removed syncConditionOverlays (⚡ badge overlays showing 34-char condition text), overlayIdsRef, escapeHtml helper, and the badge click handler; removed the 2 overlay sync call sites. Context-menu (مدیریت شرط‌ها/ویرایش شرط) and toolbar (شرط) condition editing entry points preserved
- process-preview-dialog.tsx: removed ⚡ badges and «⤵ پیش‌فرض» badge overlays from the preview diagram; kept the routing-condition summary list below the diagram (incl. default-flow entries + print). Updated doc comment and print footer wording
- bpmn-designer.css: deleted .bpmn-condition-badge style blocks (now unused)
- globals.css: updated stale print comment (badges no longer exist; diagram + routing list print cleanly)
- Verified: zero bpmn-condition-badge/syncConditionOverlays/overlayIdsRef references in src; tsc errors in touched files are pre-existing strict-mode noise also present in untouched files (forms-view, form-builder, api.ts); frontend serves 200 with no compile errors

Stage Summary:
- Gateways/condition flows now render in original bpmn-js form (only standard element/flow name labels) in BOTH the designer and the preview dialog
- Condition info remains accessible: designer right-click/toolbar editing; preview summary list + print
- Files touched: src/components/bpmn/bpmn-designer.tsx, src/components/processes/process-preview-dialog.tsx, src/components/bpmn/bpmn-designer.css, src/app/globals.css

---
Task ID: declarative-assignment-strategies
Agent: main (Super Z)
Task: Route tasks to the logged-in user's manager WITHOUT triggers (high-level declarative assignment)

Work Log:
- Answer to "what can we do here": declarative relative assignment strategies on TaskAssignment — the backend resolves them to concrete users at task-creation time; no ProcessMaker-style triggers, no code for process designers
- schema.prisma: Position.isManager Boolean @default(false) (department-head flag); TaskAssignment.strategy String @default("FIXED_USER"); migration 20260903074215_declarative_assignment_strategy applied
- process.dto.ts: ASSIGNMENT_STRATEGIES = FIXED_USER | POSITION | INITIATOR | INITIATOR_MANAGER; strategy added to TaskAssignmentDto with @IsIn validation
- processes.service.ts: setAssignments persists strategy; serialize() includes it
- process-instances.service.ts: createCallbacks now takes startedById (both call sites updated: start() + recovery); new resolveAssignment() switch (INITIATOR → startedById; INITIATOR_MANAGER → findInitiatorManager; POSITION → pool; FIXED_USER → assigneeId); findInitiatorManager(): initiator → UserPosition → Position(s) → Department(s) → isManager position → holder(s), prefers manager ≠ initiator; fallback to first ADMIN when no manager (no position / dept without head) so flows never dead-end
- task-assignment-modal.tsx: strategy selector with Persian labels + hints (کاربر مشخص / سمت مشخص / شروع‌کننده فرآیند / مدیر شروع‌کننده); user picker (NEW, users prop) for FIXED_USER; position picker + selfService only shown for POSITION
- process-designer-view.tsx: loads users via usersApi.findAll(); assignment map + save payload include strategy (legacy rows inferred from assigneeId/positionId)
- seed.ts: مدیر مهندسی + مدیر منابع انسانی marked isManager:true; Persian leave process assignments switched to strategies (ثبت→INITIATOR, تایید مدیر مستقیم→INITIATOR_MANAGER, تایید منابع انسانی→POSITION hrManager, اطلاع‌رسانی→INITIATOR); seed re-run
- scripts/test-declarative-assignment-e2e.cjs (new): 9 checks — INITIATOR, INITIATOR_MANAGER (john→jane dynamic), notify-back, sick auto-approve, POSITION (bob), admin fallback (no-position initiator), 4 full-path completions. One initial FAIL was a test-script bug (john.id undefined — login returns only token); fixed by comparing assignee.email

Stage Summary:
- ALL 9 E2E checks PASS: john (کارشناس مهندسی) starts leave request → approval task lands in JANE's queue purely via org structure (initiator→dept→manager position), no hardcoded users; admin (no position) falls back to admin
- Backend logs confirm dynamic resolution: "INITIATOR_MANAGER resolved: initiator ... → manager ... (Jane Smith)"
- Frontend serves 200; assignment modal now offers 4 declarative strategies in Persian
- Files: schema.prisma, process.dto.ts, processes.service.ts, process-instances.service.ts, task-assignment-modal.tsx, process-designer-view.tsx, seed.ts, scripts/test-declarative-assignment-e2e.cjs

---
Task ID: process-versioning
Agent: main (Super Z)
Task: Process versioning — immutable version history + restore (Camunda-style), high-level no-triggers design

Work Log:
- Design chosen: Process = container (keeps denormalized CURRENT bpmnXml + version int); new immutable ProcessVersion row appended on every save that ACTUALLY changes the XML (name/description/status/no-op saves never create versions). Restore = append-copy (new version from old one, history never rewritten). In-flight instances already pinned via ProcessInstance.bpmnXmlSnapshot — new instances start on latest. No read-path refactors (start/designer still read Process.bpmnXml).
- schema.prisma: ProcessVersion (processId FK cascade, version, bpmnXml, note?, createdById→User "ProcessVersionCreatedBy", @@unique([processId, version])); User.processVersions + Process.versions relations; migration 20260903084544_process_version_history applied with hand-added SQL backfill (INSERT...SELECT randomblob ids for all existing processes — verified 3 rows)
- processes.service.ts: create() nests versions.create v1; update(id, dto, userId) bumps version + appends history row (with optional dto.note) ONLY when dto.bpmnXml !== existing.bpmnXml (string compare — also fixed old behavior that incremented even on identical XML); new getVersions(id) (metadata newest-first, isCurrent, author, xmlSize), getVersionXml(id, version), restoreVersion(id, version, userId, note) (400 if already current; default note «بازگردانی نسخه N»; $transaction append+update)
- process.dto.ts: UpdateProcessDto.note (changelog, ignored when XML unchanged) + RestoreVersionDto; processes.controller.ts: GET :id/versions, GET :id/versions/:version (ParseIntPipe), POST :id/versions/:version/restore (ADMIN), update() now passes req.user.id
- Frontend: new src/components/processes/process-versions-dialog.tsx (RTL emerald: version rows with «فعلی» badge, fa-IR datetime, author, note, lazy «مشاهده XML» toggle in LTR pre, inline restore confirm with optional note input + warning that current diagram is replaced); processesApi.getVersions/getVersion/restoreVersion in lib/api.ts
- process-designer-view.tsx: header «نسخه N» outline chip (clickable) + «نسخه‌ها» History button; save captures update() response → chip updates; BpmnDesigner remount via key={designerNonce}; onRestored → setBpmnXml + version bump + nonce++ + toast (canvas re-renders with restored XML)
- seed.ts: Persian process creates its v1 history row via nested versions.create (note: «نسخه اولیه»); seed re-run
- tsconfig.json: excluded stale frontend/ copy, mini-services, skills, examples from frontend typecheck (stale copy resolving root @/ alias against new modal Props produced false positives)
- scripts/test-process-versioning-e2e.cjs (new): 14/14 PASS — create→v1; XML change→v2; name-only & identical-XML saves→no bump; list newest-first with isCurrent/note/author; v1 detail XML exact; restore v1→v3 (append, xml===v1); in-flight instance started on v2 COMPLETES on its snapshot while current is v3; guardrails (restore current→400, unknown→404, non-admin→403)
- Regression: scripts/test-task-starter-assignment-e2e.cjs ALL PASS after reseed
- Browser-verified (agent-browser): designer header chip «نسخه 3», dialog lists 3 versions with notes/authors, restore v2 → chip «نسخه 4» + canvas remounted + note stored, XML preview renders, versioning-test process left ACTIVE (doubles as demo); zero console/page errors; screenshot download/bpms-versions-dialog.png
- tsc: zero errors in touched files (remaining 13 are pre-existing baseline in bpmn-designer/forms-view/form-builder/lib + scripts)

Stage Summary:
- Processes now have full immutable version history: auto-version on real XML change (with optional changelog note), version list/preview, restore-as-new-version (never rewrite), instances pinned to the version they started on
- APIs: GET/POST /api/processes/:id/versions[/:version][/restore]; UI: designer «نسخه‌ها» dialog + header chip; processes list v column (pre-existing)
- Files: schema.prisma + migration, processes.{service,controller}.ts, process.dto.ts, process-versions-dialog.tsx (new), process-designer-view.tsx, lib/api.ts, seed.ts, tsconfig.json, scripts/test-process-versioning-e2e.cjs (new)
- Note: first designer save of hand-written seed XML may create one extra version (bpmn-js re-serializes to its canonical format) — expected normalization, stable afterwards

---
Task ID: form-file-attachments
Agent: main (Super Z)
Task: File/multi-file upload in forms — upload at fill time, download by next users/tasks

Work Log:
- Design: file fields submit lightweight metas {id, name, size, mimeType} stored in the submission JSON (value is ALWAYS an array); bytes live on disk under <backend>/uploads/<uuid>.<ext>; upload happens immediately on file pick (POST /api/files multipart, 10MB cap); FileAttachment.taskId/instanceId are stamped server-side at task completion by scanning submission values; later tasks get metas through the existing instanceVariables prefill chain and render download-only readOnly mirrors
- schema.prisma: FileAttachment (originalName UTF-8, storedName unique uuid+ext, mimeType, size, taskId?, instanceId?, submittedById→User); migration 202609030900xx file_attachments applied
- Backend new module src/files/: FilesService (UPLOADS_DIR=resolve(cwd,'uploads') auto-created, createUploadStorage() diskStorage factory with latin1→UTF-8 originalname recovery + sanitized ext, save/resolveForDownload/stampFromSubmissionData/findByInstance, MAX_FILE_SIZE 10MB), FilesController (POST /api/files FileInterceptor('file') JwtAuthGuard; GET /api/files/by-instance/:instanceId declared BEFORE GET /api/files/:id; GET /api/files/:id → res.download with RFC5987 Persian-safe disposition), registered in AppModule + FilesModule imported into TasksModule
- tasks.service.completeTask: stamps attachments after persisting submission ("Stamped N file attachment(s)" log)
- forms DTO: FormFieldDto.multiple (@IsBoolean — whitelist would strip it otherwise)
- Frontend: lib/api.ts filesApi.upload (FormData, no Content-Type header so browser sets boundary) + filesApi.download (blob); new src/components/common/file-upload-field.tsx (dashed picker button, per-file chips with name/size/download/remove, uploading spinner, multiple/single room logic, previewMode for builders, fromPreviousTask hint, disabled mode = readOnly download-only); dynamic-form.tsx type 'file' + multiple prop (normalizes legacy single-object values); form-builder.tsx + form-builder-panel.tsx: «فایل» type (Paperclip icon), «چند فایل» checkbox, defaultValue hidden for file fields, preview renderers; task-detail-view renderField file case + previous-submissions now render file-like values as attachment chips instead of raw JSON (looksLikeFileList helper)
- seed.ts: leave request form gains optional multiple file field «attachments» «پیوست مدارک»; approval form gains readOnly mirror «پیوست‌های درخواست» (approvers see + download); seed re-run
- scripts/test-file-upload-e2e.cjs (new): 11/11 PASS — UTF-8 name+size preserved (گواهی پزشک.txt), 2 uploads, bytes on disk with sanitized ext, stamping (taskId+instanceId+uploader), approval prefill carries metas, jane downloads john's file byte-identical, 401/404/413 guardrails, flow completes
- scripts/cleanup-file-e2e-instances.cjs (new, one-off): closed the orphan instance left by the first (crashed) E2E attempt + browser-test instance; 0 running instances remain
- Browser-verified (agent-browser): john's task shows dashed picker → picked fixtures-test-doc.txt → POST /api/files 201 → chip "fixtures-test-doc.txt 80 بایت"; completed task; jane's approval task renders readOnly «پیوست‌های درخواست» chips with دانلود buttons (download click → no console errors); NOTE a11y snapshot truncates the chips list — verified via DOM eval; Fast Refresh remount mid-test caused one stale-input false alarm (both uploads actually landed, 2× 201)
- tsc: fixed one new error (TS2873 sloppy undefined||x in file-upload-field); remaining errors pre-existing baseline; screenshots download/bpms-file-attachments-approval.png

Stage Summary:
- Forms support file + multi-file fields end-to-end: immediate upload with progress, removable chips before submit, server-side stamping to task/instance, per-instance isolation, download-only readOnly mirrors for next tasks, authenticated download with original (Persian) filename, 10MB cap
- Files survive on disk independently of task/instance lifecycle; metadata queryable via GET /api/files/by-instance/:instanceId (ready for a future instance-attachments panel)
- Files: prisma schema+migration, src/files/* (new), tasks.{service,module}.ts, forms/dto, app.module.ts, lib/api.ts, file-upload-field.tsx (new), dynamic-form.tsx, form-builder{,-panel}.tsx, task-detail-view.tsx, seed.ts, scripts/test-file-upload-e2e.cjs (new)
