# Architecture

## 1. Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16 (Turbopack, App Router) + React 19 | Persian RTL, emerald theme |
| UI kit | Tailwind CSS 4 + shadcn/ui + lucide-react | Components in `frontend/src/components/ui` |
| BPMN modeling | bpmn-js v18 | Embedded designer + read-only preview with print |
| Backend | NestJS 11 | Modular, Swagger at `/api/docs` |
| ORM / DB | Prisma 6 + SQLite | Single file `backend/db/bpms.db`; migrations in `backend/prisma/migrations` |
| Execution | bpmn-engine v25 | In-process; state persisted per instance |
| Auth | JWT (passport-jwt) + bcryptjs | Bearer tokens, `ADMIN`/`USER` roles |

## 2. Topology

```
Browser (RTL SPA)
   │  http://localhost:3000
   ▼
Next.js dev server :3000
   │  next.config.ts rewrite: /api/* → http://localhost:3001/api/*
   ▼
NestJS API :3001  ──────────────►  bpmn-engine (in-process)
   │                                   │  wait / end / error events
   ▼                                   ▼
Prisma ──► SQLite (db/bpms.db)      engineState JSON persisted per instance
   │
   └──► uploads/ (file attachment bytes, uuid names)

FrontendSupervisor (inside backend main.ts):
  on backend boot, probes :3000 and spawns the Next.js dev server detached
  if it is not running — the backend is the keeper of the whole stack.
```

Auth flows browser → Next rewrite → backend (same-origin, no CORS). JWT is kept in `localStorage` (`bpms_token`) and attached by `frontend/src/lib/api.ts`.

## 3. Backend module map (`backend/src/`)

| Module | Exposes | Key internals |
|---|---|---|
| `auth` | `POST /api/auth/login`, `GET /api/auth/me` | JwtStrategy payload `{ id, email, role }`; `@Roles('ADMIN')` + RolesGuard |
| `users` | user CRUD (admin) | |
| `departments` | dept CRUD | |
| `positions` | positions per department, user↔position M2M endpoints | `Position.isManager` = department-head flag |
| `processes` | process CRUD + `user-tasks`, `assignments`, `variables`, `versions` | `condition-validator.ts` gate on create/update/activate; immutable `ProcessVersion` rows; restore-as-append |
| `process-instances` | start, mine, detail, terminate | `createCallbacks()` (wait/end/error/stateChange); `resolveAssignment()`; `recoverRunningInstances()` on boot |
| `tasks` | list/mine/detail, complete, claim, release | `createWaitingTask` (idempotent by executionId), `getInstanceVariables` prefill merge, attachment stamping |
| `forms` | form CRUD (process-scoped) | `fields` JSON string; `FormFieldDto` (whitelist-sensitive!) |
| `categories` | category + items CRUD, usage report | `key` regex `^[a-zA-Z][a-zA-Z0-9_]*$` keeps values condition-safe |
| `files` | `POST /api/files`, `GET /api/files/:id`, `GET /api/files/by-instance/:instanceId` | Multer disk storage, uuid names, UTF-8 name recovery, 10 MB cap |
| `bpmn` | (library) | `BpmnEngineService`: start/resume/signal, `WaitingTaskInfo`, condition validator |

## 4. Data model (Prisma, `backend/prisma/schema.prisma`)

```
User ─┬─< UserPosition >─ Position >─ Department
      ├─< Process (createdBy)          Position.isManager: department-head flag
      ├─< ProcessInstance (startedBy)
      ├─< Task (assignee)
      ├─< TaskAssignment (assignee)
      ├─< FormSubmission (submittedBy)
      └─< FileAttachment (submittedBy)

Process ─┬─< ProcessVersion   (immutable history: version, bpmnXml, note, author)
         ├─< ProcessVariable  (declared variables, Persian labels)
         ├─< Form             (JSON fields; optional processId)
         └─< TaskAssignment   (processId + taskName UNIQUE → strategy config)

ProcessInstance ─┬─ bpmnXmlSnapshot (XML pinned at start — instances are version-immune)
                 ├─ engineState     (serialized bpmn-engine state for resume)
                 └─< Task ─┬─< FormSubmission (data JSON; file metas live inside)
                           └─ formId, assigneeId?, positionId?, selfService, executionId

Category ─< CategoryItem (value stable + label Persian; referenced by select fields via categoryId)
FileAttachment (metadata only; bytes on disk; taskId/instanceId stamped at completion)
```

Enums: `UserRole(ADMIN|USER)`, `ProcessStatus(DRAFT|ACTIVE|ARCHIVED)`, `InstanceStatus(RUNNING|COMPLETED|FAILED|TERMINATED)`, `TaskStatus(PENDING|COMPLETED|SKIPPED|CANCELLED)`.
`TaskAssignment.strategy` is a validated **string** (SQLite has no Prisma enums): `FIXED_USER | POSITION | TASK_STARTER | TASK_STARTER_MANAGER` (+ legacy `INITIATOR*` still resolved for old rows).

## 5. Core request flows

### 5.1 Start instance → task creation
```
POST /process-instances {processId}
  1. Load process (must be ACTIVE) → snapshot bpmnXml into ProcessInstance
  2. bpmn-engine start with EngineCallbacks:
       onUserTask(info)   → find TaskAssignment by taskName === info.name
                            → resolveAssignment(strategy) → concrete assignee/position
                            → tasks.createWaitingTask(...)  [idempotent by executionId]
       onEnd()            → instance COMPLETED, markRemainingCancelled
       onError()          → instance FAILED + lastError
       onStateChange()    → persist engineState JSON (resume point)
```

### 5.2 Complete task → engine advances
```
POST /tasks/:id/complete {data, formId?}
  1. Permission check (assignee, or position holder, or open task)
  2. Persist FormSubmission; stamp file metas → FileAttachment.taskId/instanceId
  3. Mark task COMPLETED
  4. Map field keys → variable names (field.variable || field.name)
  5. bpmn.signalTask(executionId, engineData) → engine evaluates gateways → next wait/end events
```

### 5.3 Crash recovery
On boot, `ProcessInstancesService.onModuleInit` reloads every `RUNNING` instance: rebuilds the engine from `bpmnXmlSnapshot` + `engineState`; tasks already `COMPLETED` in DB are re-signaled with their stored submission data (idempotent createWaitingTask dedupes by `executionId`).

### 5.4 Assignment resolution (at task-creation time)
See `docs/domain-guide.md` §2 — pure service logic in `process-instances.service.ts`, org lookups only, **no user code**.

## 6. Frontend structure

- `src/app/` — App Router (UI redesign Phases 2–7): public `/login` (MD3 card on indigo
  gradient + one-click demo-account chips); authenticated `(app)` route group whose layout
  redirects unauthenticated users to `/login` and wraps pages in `AppShell`. Routes:
  `/dashboard`, `/tasks`(+`[id]`), `/instances`(+`[id]`), `/processes`(+`[id]/design`
  fullscreen, ADMIN-only), `/admin/{departments,categories,users}` (ADMIN-only inline guard).
- `src/components/shell/` — `app-shell` (top app bar + collapsible sidebar drawer⇄icon rail +
  mobile drawer), `breadcrumbs`, `command-palette` (Ctrl+K: navigation, pending tasks,
  start-instance, theme/logout actions)
- `src/components/views/` — `dashboard-view` (KPI cards + recharts trends + recent lists),
  `tasks-view`, `processes-view`, `instances-view`, `process-designer-view` (fullscreen
  designer), `task-detail-view`, `instance-detail-view` (timeline + attachments panel),
  `forms-view` (legacy, unrouted), `categories-view`, `departments-view`, `users-view`,
  `login-view`. Dialogs share the MD3 pattern: 28px surface, tonal icon chip in the title row,
  pill buttons.
- `src/components/processes/` — `task-assignment-modal` (strategy + source-task pickers), `gateway-condition-modal` (simple/expression modes, default-flow radio), `process-preview-dialog` (read-only render + condition list + print), `process-versions-dialog` (history/preview/restore)
- `src/components/forms/` — `form-builder` (dialog) and `form-builder-panel` (designer sidebar): field palette, properties, live preview
- `src/components/common/` — `dynamic-form` (runtime renderer + validation), `option-select` (category-backed select), `file-upload-field`, `data-table` (MUI X DataGrid wrapper — the only MUI/emotion surface, list routes only), `mui-rtl-provider` + `mui-theme`, `status-badge`, `theme-provider`/`theme-toggle` (next-themes, system default), `app-providers`, `loaders`
- Theming (Phase 1): `globals.css` maps MD3 indigo tokens (light primary `#3B5BDB` /
  dark `#BAC3FF`) onto shadcn CSS variable names, so every shadcn component reskins without
  rewrites; adds `--success/--warning/--primary-container/--surface-container`, MD3 elevation
  ramp, `state-layer`/`md-ripple`/`md-skeleton`/`md-stagger` utilities (all frozen under
  `prefers-reduced-motion`). Print pipeline (`.process-print-area` + `:has()` rules) is
  protected — do not refactor.
- `src/lib/api.ts` — typed API client (`getToken/setToken`, filesApi with multipart/blob helpers)
- `src/lib/condition-validation.ts` — browser mirror of the backend condition validator (save/activate gate)
- `src/lib/i18n.ts` — single Persian dictionary `t` + `statusColors` (semantic token classes; RUNNING=primary / COMPLETED=success / FAILED=destructive / PENDING=warning)

## 7. Versioning architecture

- `Process` = container ("definition key"): keeps `name`, `status`, `version` (current number) and the **denormalized current `bpmnXml`** so all read/start paths stay simple.
- `ProcessVersion` rows are immutable and appended only when an update actually changes the XML (string compare), carrying an optional Persian changelog note.
- Restore copies an old version's XML and appends it as a **new** version — history is never rewritten.
- Running instances are unaffected by any of this: they execute `ProcessInstance.bpmnXmlSnapshot`.

## 8. File attachments architecture

- Bytes: `backend/uploads/<uuid>.<ext>` (dir auto-created; original name never touches disk paths).
- Metadata: `FileAttachment` (UTF-8 original name, mime, size, uploader).
- Upload happens **on file pick** (immediate POST) so the UX shows progress; the form value only stores metas.
- On task completion the backend scans submission values and stamps `taskId`/`instanceId` — instance-level enumeration (`GET /files/by-instance/:instanceId`) and per-task attribution fall out of that.
- Downloads are authenticated; `res.download` emits RFC 5987 headers so Persian filenames survive.
