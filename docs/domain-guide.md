# Domain guide — semantics of the BPMS

This document explains **what the system means**, i.e. the behavioral rules an agent must respect when changing code. Architecture lives in `architecture.md`; endpoints in `api-reference.md`.

## 1. Processes, instances and the engine

- A **Process** is a BPMN 2.0 XML definition (with BPMNDI layout — the designer cannot render without DI). It must be `ACTIVE` before instances can start.
- An **instance** executes the XML snapshot taken at start (`bpmnXmlSnapshot`). Editing the process afterwards never affects running instances.
- bpmn-engine emits `wait` for every userTask reached → the backend creates a `Task` row. Human completes the task → backend signals the engine → next events.
- Supported gateway patterns: exclusive (XOR), inclusive (OR), parallel split/join (the seeded «Expense»-style flows and the E2E demo process use all of them).

### 1.1 Gateway conditions — the engine contract

```xml
<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">
next(null, environment.variables.leaveType === 'Sick');
</bpmn:conditionExpression>
```

- Without `language="javascript"` the engine uses a dumb template resolver that **always takes the first flow** — this is the historic #1 bug; validators now block it.
- The JS body must call `next(null, result)`; a syntax error or a missing `next()` hangs the gateway.
- One outgoing flow of an XOR gateway should be the **default flow** (`default="Flow_x"` on the gateway, no condition) as the fallback.
- Variables available in conditions: everything merged into `environment.variables` — form field values (keyed by `field.variable || field.name` and also the raw key) of all previous tasks in the instance.
- Validation layers (keep them in sync):
  1. `gateway-condition-modal.tsx` — per-row validation while editing
  2. `src/lib/condition-validation.ts` — designer Save/Activate gate (Persian messages)
  3. `backend/src/bpmn/condition-validator.ts` — create/update/activate gate (authoritative; regex+`new Function` compile, per-flow error attribution)

## 2. Task assignment strategies (declarative, no triggers)

Configured per userTask in the designer («تخصیص» modal), stored in `TaskAssignment (processId, taskName UNIQUE) → strategy + params`. Resolved **when the task is created** by `ProcessInstancesService.resolveAssignment()`.

| Strategy | Config | Resolves to |
|---|---|---|
| `FIXED_USER` | `assigneeId` | that user |
| `POSITION` | `positionId`, `selfService?` | **pool**: any holder of the position can complete; `selfService=true` forces CLAIM first |
| `TASK_STARTER` | `sourceTaskName` | the user who **completed** `sourceTaskName` in this instance |
| `TASK_STARTER_MANAGER` | `sourceTaskName` | the **manager** of that performer |

Starter-based strategies are **task-scoped by design** (user requirement): the designer picks *which earlier task's performer* the routing follows — not a global "process starter" — so one instance can route different follow-ups to different managers (e.g. parallel registrations by different clerks each escalate to their own manager). The E2E `test-task-starter-assignment-e2e.cjs` demonstrates exactly this with a 3-way parallel process.

Resolution details:

- **Performer lookup** (`findTaskPerformer`): latest FormSubmission's `submittedById` (ground truth, covers position-pool tasks completed without claim) → else the task's `assigneeId` (also the *intended* performer for still-pending tasks in parallel branches) → else null.
- **Manager lookup** (`findUserManager`): user → their position(s) → department(s) → `isManager` position(s) → holders; **prefers a manager other than the performer themself**.
- **Fallbacks (never dead-end a flow)**: `TASK_STARTER` without a resolvable performer → instance starter; `TASK_STARTER_MANAGER` without a manager (performer has no position, or department has no head) → first `ADMIN`. All fallbacks are logged (`Assignment … resolved/falling back`).
- Server-side guardrails (`processes.service.setAssignments`): starter strategies require `sourceTaskName` to exist in the BPMN **and** differ from the assigned task itself.
- Legacy `INITIATOR` / `INITIATOR_MANAGER` strategies still resolve (from the instance starter) for rows created before the task-scoped refactor; they are rejected by the DTO for new saves.

## 3. Task lifecycle

- Statuses: `PENDING` → `COMPLETED` (or `CANCELLED` when the instance ends/terminates; `SKIPPED` unused).
- **Position pools**: without `selfService`, any holder sees the task and can complete directly (first-come-first-serve; the completer is recorded on the task + submission). With `selfService`, the task must be **claimed** (`POST /tasks/:id/claim`) — it then disappears from other holders' queues; `release` returns it to the pool.
- Completion permission: assignee; or any holder of the task's position (non-selfService); or anyone for open tasks.
- Every task persists its `executionId` so the engine can be signaled later — this is what makes crash recovery work.

## 4. Forms, variables and data flow

- **Forms** belong to a process and are bound to tasks via the assignment (`formId`). `fields` is a JSON array of `FormFieldDto`: `name`, `label`, `type` (`text|textarea|number|date|select|checkbox|radio|file`), `required`, `options`, `categoryId`, `variable`, `placeholder`, `defaultValue`, `readOnly`, `multiple`.
- **Process variables** (`ProcessVariable`) are declared per process with Persian labels — they document the variable space used by gateway conditions (the designer merges them with form-field variables when editing conditions).
- **Submission data** keys are form field `name`s; when signaling the engine, keys are remapped to `field.variable || field.name`. `getInstanceVariables()` merges ALL submissions of ALL tasks in the instance (chronological, later wins) under both the variable name and the raw key — this is the **prefill chain**.
- **readOnly fields** render disabled in later tasks, prefilled from the prefill chain (→ defaultValue → own latest submission). Empty readOnly values are stripped from the completion payload so they can never overwrite a real variable with emptiness; they are also excluded from required-validation.
- **Categories** (`Category.key` + items `value/label`) power select fields: stored value stays condition-safe (`Annual`), displayed label is Persian (`مرخصی استحقاقی`). If a category is deleted, forms fall back to their inline `options` snapshot.
- ⚠️ **Whitelist trap**: `ValidationPipe({whitelist: true})` strips any DTO property without a validation decorator. Every new optional form-field property needs `@IsOptional()` (+ a type decorator) in `FormFieldDto` — this silently bit `categoryId` and `multiple` before.

## 5. File attachments (file fields)

- A `file` field's value is **always an array of metas**: `{ id, name, size, mimeType }` (single-file mode just caps it at length 1 in the UI).
- Upload is immediate on file pick (`POST /api/files`, multipart field `file`, ≤10 MB) → meta returned → stored in the form value → persisted inside the submission JSON.
- At completion the backend stamps `FileAttachment.taskId/instanceId` by scanning submission values (any `{id,…}` object/array member).
- Later tasks: declare a `file` field with the **same `name`** and `readOnly: true` → it renders the previous task's files as download-only chips (the prefill chain feeds it automatically — see the seeded approval form's «پیوست‌های درخواست»).
- Downloads: `GET /api/files/:id` (authenticated; RFC 5987 disposition so Persian names survive). Bytes are uuid-named on disk — the original name never touches the filesystem.
- Files are currently never garbage-collected (see roadmap).

## 6. Process versioning

- Every update that **actually changes `bpmnXml`** (string compare; name/description/status/no-op saves don't count) appends an immutable `ProcessVersion` row: `version = current + 1`, full XML, optional Persian changelog `note`, author.
- `Process.bpmnXml`/`Process.version` always mirror the current version (denormalized on purpose — zero read-path refactors).
- **Restore = append-copy**: `POST /processes/:id/versions/:v/restore` copies old XML and saves it as a NEW current version (note defaults to «بازگردانی نسخه N»). 400 if that version is already current; admin-only.
- Consequences: history is complete and auditable; nothing is ever rewritten; **running instances keep their snapshot** — only new instances get the restored definition (proven by `test-process-versioning-e2e.cjs`).
- UI: «نسخه N» chip + «نسخه‌ها» dialog in the designer header (list, XML preview, restore with note). The processes table shows the current version column.
- Note: the first designer save of hand-written seed XML may create one extra version because bpmn-js re-serializes to its canonical format — expected normalization.

## 7. The seeded example (Persian leave process «فرآیند درخواست مرخصی»)

The seed (`backend/prisma/seed.ts`) wipes everything **except users** and recreates a fully working Persian example:

```
شروع → ثبت درخواست مرخصی → <تصمیم نوع مرخصی (XOR)>
   ├─ Sick   → پایان تایید خودکار            (auto-approve, no approval task)
   ├─ Annual → تایید مدیر مستقیم ─┐
   └─ Unpaid → تایید منابع انسانی ─┤→ <ادامه مسیر (XOR)> → اطلاع‌رسانی نتیجه → پایان
```

Assignments demonstrate all strategies:

| Task | Strategy | Effect |
|---|---|---|
| ثبت درخواست مرخصی | `FIXED_USER` john | entry clerk |
| تایید مدیر مستقیم | `TASK_STARTER_MANAGER` src=ثبت | john's manager = **jane** (via org structure) |
| تایید منابع انسانی | `POSITION` مدیر منابع انسانی | bob's pool |
| اطلاع‌رسانی نتیجه | `TASK_STARTER` src=ثبت | back to the registration performer |

Forms: request form (with `attachments` multi-file field), approval form (5 readOnly mirrors + readOnly attachments + تایید/رد decision), notification form. Category `leave_types` (Annual/Sick/Unpaid with Persian labels) backs the leaveType select. Gateway conditions use the exact engine contract of §1.1.

Three demo paths (all covered by E2E): Sick → auto-complete; Annual → jane → john notify; Unpaid → bob (رد) → john notify.

## 8. Conventions

- **All user-facing text is Persian**; code identifiers/comments in English. Status labels via `src/lib/i18n.ts`.
- Dates displayed with `toLocaleDateString('fa-IR')`; stored as ISO.
- Emerald (`bg-emerald-600`) is the primary action color; destructive red for deletes; gray/amber for hints.
- Table keys/ids are UUIDs; nothing exposed is guessable.
- Deleting a process that has instances is blocked by FK restrict — terminate/delete instances first (there is currently no instance-delete endpoint; use terminate).
