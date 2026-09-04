# Development guide

## 1. Running the stack

```bash
# Backend — cd backend
cp .env.example .env                 # fix DATABASE_URL to an ABSOLUTE path of your checkout
npm install && npx prisma generate
npx prisma migrate deploy            # or: npx prisma migrate dev (dev iterations)
npm run prisma:seed                  # seeded demo (see below)
npm run dev                          # nest --watch on :3001 (spawns frontend if down)

# Frontend — cd frontend
npm install
npm run dev                          # :3000, /api/* proxied to :3001
```

`.env` keys: `DATABASE_URL` (absolute `file:` path), `PORT=3001`, `JWT_SECRET` (any dev secret). `backend/src/main.ts` refuses port 3000 (frontend's port) and falls back to 3001.

`npm run prisma:seed` is **idempotent for users** (looked up by email, created only if missing) and destructive for everything else: it wipes org structure, processes, forms, categories, instances, tasks, submissions and recreates the Persian demo (see `docs/domain-guide.md` §7).

## 2. E2E test inventory (`scripts/`, plain node, no framework)

Run with the backend up: `node scripts/<name>.cjs` — suites print `✓/✗` lines and exit non-zero on failure.

| Script | Covers | Side effects |
|---|---|---|
| `test-persian-process-e2e.cjs` | seeded leave process: Sick auto-approve / Annual manager / Unpaid HR / notify-back (original static-assignment regression) | creates completed instances |
| `test-task-starter-assignment-e2e.cjs` | all assignment strategies incl. task-scoped `TASK_STARTER*`, multi-manager parallel demo, admin fallback, server-side guardrails (400s) | creates + leaves «فرآیند نمونه تخصیص چندمدیریتی» (idempotent by name) |
| `test-process-versioning-e2e.cjs` | version bump rules, metadata, restore-as-append, instance pinning across restore, 400/404/403 guardrails | creates + leaves «فرآیند تست نسخه‌بندی» (idempotent) |
| `test-file-upload-e2e.cjs` | upload (UTF-8 names), stamping, prefill metas, byte-identical download, 401/404/413 | uploads files, creates completed instances |
| `test-condition-validation.cjs` | save-gate rejects 4 classes of broken condition XML; valid XML + activation pass; no false positives on seeded processes | creates + deletes a temp process |
| `test-declarative-assignment-e2e.cjs` | ⚠ superseded (tests removed `INITIATOR*` strategies) — kept for history, will fail against current seed | — |
| `test-final-integration.cjs`, `test-gateway-conditions.cjs`, `test-live-routing.cjs` | earlier engine-integration probes (condition formats) | — |
| `insert-broken-process.cjs`, `fix-seed-di.ts`, `cleanup-file-e2e-instances.cjs` | one-off helpers (broken-XML fixture, DI patch, instance cleanup) | — |

After any seed or strategy change: re-seed, then re-run at least the first four suites.

## 3. Making schema changes

1. Edit `backend/prisma/schema.prisma`
2. `DATABASE_URL=file:<abs>/db/bpms.db npx prisma migrate dev --name <change>` (regenerates the client)
3. Update `backend/prisma/seed.ts` if the demo must exercise the new model
4. Re-seed + re-run E2E suites
5. Restart backend so the running process picks up the regenerated client (nest watch does not reload `node_modules`)

## 4. Frontend patterns to follow

- New view: add `src/components/views/<x>-view.tsx`, register in the app shell sidebar (Persian label + lucide icon) and the view router.
- All data through `src/lib/api.ts` (add typed helpers there; multipart needs the raw-fetch pattern used by `filesApi.upload`).
- New form-field type: touch **all five** places — `FormFieldDto` (backend, with decorators!), `dynamic-form.tsx` (render + `FIELD_TYPES`), `form-builder.tsx`, `form-builder-panel.tsx`, `task-detail-view.tsx` (its own `renderField`), and optionally `docs/domain-guide.md` §4.
- Persian strings inline or via `src/lib/i18n.ts`; `dir="rtl"` on dialogs/sections that need it.
- Toasts for user feedback (`useToast`), destructive actions get confirm dialogs.

## 5. Debugging checklist

- **Backend log**: `.zscripts/mini-service-bpms-backend.log` (workspace) or the terminal running `npm run dev`. Assignment resolutions, engine waits, stamped files, and all errors are logged there.
- **DB inspection**: `DATABASE_URL=file:<abs>/db/bpms.db npx prisma studio`, or node one-liners with an explicit datasource URL (copy the pattern from any E2E script).
- **Stuck instance**: check `status` + `lastError` on `ProcessInstance`; `FAILED` rows usually have the engine error; restart of the backend re-runs recovery.
- **Frontend**: `frontend/dev.log`; on weird 500s/stale CSS `rm -rf .next` and restart. Console must end at zero errors after UI work.
- **Engine not advancing**: the task's `executionId` must exist; look for `Signaled task execution=…`; a gateway without a valid condition/default flow hangs silently — check `condition-validator` output.

## 6. Known sandbox quirks (original workspace — may not apply elsewhere)

Read `AGENTS.md` §5 first. Summary: global `PORT=3000`/`DATABASE_URL` env overrides; ephemeral one-off shells reaped (rely on the backend's FrontendSupervisor to keep the frontend alive); `nest --watch` needs a real content change; Turbopack recovery via `rm -rf .next`; `ValidationPipe` whitelist strips undecorated DTO props.

## 7. Type-check baseline

`npx tsc --noEmit` at the frontend root reports a small **pre-existing** baseline (~13 errors in `bpmn-designer.tsx` strict-mode unknowns, `forms-view`, `form-builder` processId typing, `lib/api.ts` header typing, plus `scripts/*.ts` helpers). Backend compiles with 0 errors. **Rule: zero NEW errors** — compare against the baseline before/after your change. The zip's `frontend/tsconfig.json` already excludes non-app folders (`frontend` stale copy, `mini-services`, `skills`, `examples`).

## 8. Version 1 scope

**Included and E2E-verified:**

- Auth (JWT, ADMIN/USER), org structure (departments, positions, isManager, M2M)
- BPMN designer (bpmn-js) with DI, save-time condition validation (3 layers), gateway condition editor, read-only preview + printable condition list
- Declarative task assignment: FIXED_USER / POSITION (pool + claim/release) / TASK_STARTER / TASK_STARTER_MANAGER (+ legacy aliases), server-side guardrails, admin fallbacks
- Runtime: instances with XML snapshot + engine-state persistence + crash recovery, terminate, task queues, instance/task detail
- Dynamic forms: 8 field types, reusable categories, readOnly mirrors with prefill chain, file + multi-file uploads with download for later tasks
- Immutable process versioning: auto-versions on real XML change, changelog notes, history dialog, XML preview, restore-as-append
- Persian RTL UI end-to-end; Swagger; 5 E2E suites; seeded working example

**Known gaps / roadmap (suggested order):**

1. Harden `POST /process-instances/:id/terminate` to ADMIN (currently any authenticated user).
2. Instance attachments panel using the ready `GET /files/by-instance/:instanceId`.
3. Version diff viewer (side-by-side XML) and per-version activation status.
4. Instance migration between versions (Camunda-style) — requires mapping running executions to the new XML.
5. Condition dry-run tester (evaluate expressions against a chosen instance's variables).
6. Real notifications (the «اطلاع‌رسانی» step is currently just a task — no email/SMS integration).
7. File storage hardening: per-file ACLs, orphan GC, image thumbnails, extension allowlists.
8. Auth hardening: refresh tokens, password change UI, rate limiting.
9. Multi-language UI (currently Persian-only), Jalali date picker.
10. Tests: introduce a proper test runner (vitest/jest) around services; E2E scripts are plain node today.

## 9. Release checklist (v1)

- [ ] `npm run build` succeeds in both apps (frontend `next build`; backend `nest build`)
- [ ] Fresh checkout: `.env` configured → `migrate deploy` → seed → all 4 main E2E suites pass
- [ ] Change `JWT_SECRET` from the dev default
- [ ] SQLite file is outside the repo or backed up; `uploads/` dir writable by the process user
- [ ] Frontend served via `npm run start` (standalone build) or any static host proxying `/api/*` to the backend
