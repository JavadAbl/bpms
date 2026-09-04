# AGENTS.md — BPMS (Business Process Management System)

**Read this file first.** It is the entry point for any human or AI agent continuing work on this project. Detailed docs live in [`docs/`](docs/); the full multi-agent history lives in [`worklog.md`](worklog.md) (append-only — always add your entry at the end, never overwrite).

## 1. What this is

A high-level BPMS in the spirit of ProcessMaker/Camunda, but **declarative — no triggers, no low-level scripting for process designers**:

- Design BPMN 2.0 diagrams in an embedded bpmn-js designer (Persian RTL UI)
- Bind tasks to users/positions with **declarative assignment strategies** (including "manager of the performer of a chosen earlier task")
- Route through **XOR/inclusive gateways with validated JavaScript conditions**
- Build dynamic forms (text/number/date/select/checkbox/**file uploads**) with reusable option categories
- Run instances with persistent engine state, crash recovery, task queues, claim/release
- **Immutable process versioning** with restore-as-append and instance pinning

Version: **1.0** (feature-complete MVP; see `docs/development-guide.md` §8 for scope and known gaps).

## 2. Repository map

```
frontend/     Next.js 16 app (this is the OLD repo root layout — see below)
backend/      NestJS 11 API + Prisma/SQLite + bpmn-engine
docs/         Architecture, domain semantics, API reference, development guide
scripts/      E2E test suites (node scripts/*.cjs) + one-off helpers
worklog.md    Append-only multi-agent work history — READ IT, then APPEND to it
AGENTS.md     This file
```

> In the original workspace the frontend lives at the project root (`src/`, `next.config.ts`, …) and the backend at `mini-services/bpms-backend/`. The zip ships them as `frontend/` and `backend/`. All paths in the docs are relative to this layout.

## 3. Quick start

```bash
# Backend (terminal 1) — port 3001, watch mode
cd backend
cp .env.example .env                    # then fix DATABASE_URL to an ABSOLUTE path (see §5)
npm install && npx prisma generate
npx prisma migrate deploy               # creates db/bpms.db (SQLite)
npm run prisma:seed                     # seeds org structure + Persian demo process
npm run dev                             # nest start --watch on :3001

# Frontend (terminal 2) — port 3000
cd frontend
npm install
npm run dev                             # Next dev on :3000 (proxies /api/* → :3001)
```

Open http://localhost:3000 — Persian RTL login. Swagger: http://localhost:3001/api/docs (or :3000/api/docs through the proxy).

**Seeded accounts** (users are preserved by the seed, everything else is wiped and recreated):

| Email | Password | Role | Notes |
|---|---|---|---|
| admin@bpms.local | admin123 | ADMIN | No position (tests fallback paths) |
| john@bpms.local | user123 | USER | کارشناس فنی @ مهندسی |
| jane@bpms.local | user123 | USER | مدیر مهندسی (isManager) + کارشناس مالی |
| bob@bpms.local | user123 | USER | مدیر منابع انسانی (isManager) |

Login response field is **`accessToken`** (not `access_token`).

## 4. The one thing you must not get wrong: gateway conditions

The engine (bpmn-engine v25) only evaluates conditions in this exact shape:

```xml
<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">
next(null, environment.variables.leaveType === 'Sick');
</bpmn:conditionExpression>
```

- `language="javascript"` is mandatory — without it the engine silently takes the FIRST outgoing flow (classic bug).
- The body MUST call `next(null, <expr>)` or the gateway hangs forever.
- Variables are read from `environment.variables.<name>`; form data is merged into engine variables at task completion (mapped via `field.variable || field.name`).
- Three validation layers enforce this: the condition modal, frontend save/activate gate (`src/lib/condition-validation.ts`), backend validator (`backend/src/bpmn/condition-validator.ts` wired into process create/update/activate).

## 5. Environment quirks (learned the hard way — do not skip)

1. **PORT hijack**: the workspace exports a global `PORT=3000`. The backend would bind 3000 and collide with Next.js. `backend/src/main.ts` ignores `PORT=3000` and falls back to **3001**; the dev script also pins `PORT=3001`. The `dev` script's `DATABASE_URL` is an **absolute path from the original workspace — point it at your checkout** (or export `DATABASE_URL` yourself) before running.
2. **Global `DATABASE_URL` override**: if the shell exports `DATABASE_URL`, dotenv will NOT override it. Any direct `prisma migrate`/`ts-node prisma/seed.ts` run must pin it explicitly:
   `DATABASE_URL=file:/absolute/path/to/backend/db/bpms.db npx prisma migrate dev`
3. **Ephemeral shells**: background processes started from one-off shells may be reaped. The reliable way to (re)start the frontend is the backend's `FrontendSupervisor` (`backend/src/main.ts`): it probes `:3000` on boot and spawns Next.js detached if missing — so restarting the backend heals the whole stack.
4. **nest --watch** restarts only on *real content changes*; `touch` alone does nothing. To force a reload of e.g. a regenerated Prisma client, make a trivial edit in `src/` or kill and rerun `npm run dev`.
5. **Turbopack crashes / stale CSS**: `rm -rf frontend/.next` and restart the dev server. Never trust an old `dev.log`.
6. **ValidationPipe(whitelist: true)** silently strips DTO properties without validation decorators. Every new optional property needs e.g. `@IsOptional() @IsBoolean()` — this bit us twice (form-field extras, `multiple`).
7. **UI language**: every user-facing string is **Persian (fa), RTL**. Follow existing files (`t` helper in `src/lib/i18n.ts` or inline Persian strings).
8. **Direct DB inspection**: use `DATABASE_URL=file:... npx prisma studio` or a small node script with an explicit datasource URL (see any `scripts/*.cjs`).

## 6. Where things live (backend `src/`)

| Module | Responsibility |
|---|---|
| `auth/` | JWT (passport-jwt), `ADMIN`/`USER` roles, RolesGuard |
| `users/` `departments/` `positions/` | Org structure; `Position.isManager` drives manager resolution |
| `processes/` | CRUD, BPMN user-task extraction, assignments (strategies), variables, **version history** (list/detail/restore) |
| `process-instances/` | Start instance (XML snapshot), engine callbacks, **assignment resolution at task creation**, terminate, recovery on boot |
| `tasks/` | Waiting-task creation, complete (form submission → engine signal), claim/release, `getInstanceVariables` prefill merge |
| `forms/` | Form CRUD (JSON-schema fields), file-field `multiple` flag |
| `categories/` | Reusable value/label option lists for selects (key is condition-safe) |
| `files/` | Multipart upload (uuid disk names, UTF-8 name recovery), authenticated download, task/instance stamping |
| `bpmn/` | `BpmnEngineService` wrapper + `condition-validator.ts` |

Frontend: `src/components/views/` (one per sidebar section), `src/components/processes/` (designer dialogs), `src/components/forms/` (builders), `src/components/common/` (dynamic-form, option-select, file-upload-field), `src/components/bpmn/` (designer canvas), `src/lib/api.ts` (typed API client).

## 7. How to verify your work

E2E suites hit the **real API** (backend must be running on :3001):

```bash
node scripts/test-persian-process-e2e.cjs          # seed regression: 3 leave paths
node scripts/test-task-starter-assignment-e2e.cjs  # task-scoped assignment strategies (also recreates its demo process)
node scripts/test-process-versioning-e2e.cjs       # versioning + restore + instance pinning (also recreates its demo process)
node scripts/test-file-upload-e2e.cjs              # attachments: upload → submit → next user downloads
node scripts/test-condition-validation.cjs         # save-gate rejects broken XML (9 checks)
```

All suites print `✓ PASS / ✗ FAIL` lines and exit non-zero on failure. After seed changes, re-run the seed first (`npm run prisma:seed`). Browser-check UI work with an automation agent (login → task flow), and confirm zero console errors.

**Definition of done** (used throughout v1): E2E relevant to the touched feature passes; zero new `tsc` errors (there is a documented pre-existing baseline, see `docs/development-guide.md` §7); backend log free of new errors; UI strings Persian; `worklog.md` entry appended.

## 8. Golden rules for changes

1. **Declarative over code**: new routing/assignment behavior belongs in `resolveAssignment` strategies or assignment config — never in user-written triggers.
2. **Immutability**: never rewrite `ProcessVersion` rows; restore = append a new version. Never mutate `ProcessInstance.bpmnXmlSnapshot`.
3. **Engine safety**: never persist condition XML that the validator would reject; keep the three validation layers in sync.
4. **taskName matching**: `TaskAssignment.taskName` must equal the BPMN `userTask` `name` attribute exactly (Persian names are fine, but must match byte-for-byte).
5. **Schema changes**: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <change>` (client regenerates) → update `prisma/seed.ts` → re-seed → re-run E2E.
6. Append your session to `worklog.md` using the template at the top of that file.
