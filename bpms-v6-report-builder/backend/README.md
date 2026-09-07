> ⚠️ **Historical document** — written for the original MVP. The current feature set (assignment strategies, versioning, file attachments, validation gates) has evolved. Authoritative, up-to-date docs: [`AGENTS.md`](../../AGENTS.md) + [`docs/`](../../docs) in the repository root.

# BPMS Backend MVP

A minimal Business Process Management System backend inspired by **ProcessMaker**, built with:

- **NestJS 11** — modular API framework
- **Prisma 6 + SQLite** — persistence
- **bpmn-engine 25** — BPMN 2.0 execution engine (handles flow control between user tasks)
- **Passport + JWT** — authentication
- **Swagger / OpenAPI** — interactive API docs at `/api/docs`
- **class-validator / class-transformer** — DTO validation

The admin creates process definitions by uploading BPMN 2.0 XML, binds each `userTask`
(by name) to a user and/or a dynamic form, and users then start instances and complete
their assigned tasks via the API.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create SQLite database + apply schema
npm run prisma:migrate          # creates prisma/migrations/* and the DB
# (already done once; subsequent changes use `npx prisma migrate dev --name <change>`)

# 3. Seed initial data (admin, two users, two forms, one BPMN process)
npm run prisma:seed

# 4. Start the dev server (hot reload)
npm run start:dev
# or build + run prod-style
npm run build && npm run start:prod
```

Server runs at <http://localhost:3000/api>. Swagger UI at <http://localhost:3000/api/docs>.

### Seeded accounts

| Email                | Password  | Role | Positions held |
| -------------------- | --------- | ---- | -------------- |
| `admin@bpms.local`   | `admin123`| ADMIN | Compliance Officer (HR) |
| `john@bpms.local`    | `user123` | USER  | Engineer (Engineering) |
| `jane@bpms.local`    | `user123` | USER  | Engineering Manager + Finance Officer |
| `bob@bpms.local`     | `user123` | USER  | Engineering Director |

Three departments are seeded: **Engineering**, **Finance**, **Human Resources** — each
with positions. See the full org chart in the [Departments & Positions](#departments--positions) section.

Two sample processes are seeded:

**1. Leave Approval** (exclusive gateway — tasks assigned to specific users):
- `Submit Request` → `john`, **Leave Request Form**
- `Approve Request` → `jane`, **Approval Form**

**2. Expense Approval** (inclusive + parallel gateways — tasks assigned to **positions**):
- `Submit Expense` → **Engineer** position, **Expense Claim Form**
- `Manager Approve` → **Engineering Manager** (amounts ≤ 1000), **self-service** ✋, **Approval Form**
- `Director Approve` → **Engineering Director** (amounts > 1000), **self-service** ✋, **Approval Form**
- `Compliance Review` → **Compliance Officer** (amounts > 5000), **self-service** ✋, **Approval Form**
- `Process Payment` → **Finance Officer**, **Payment Processing Form**
- `Archive Record` → **Engineering Director**, **Archive Record Form**

*(✋ = self-service: must be claimed before completing)*

---

## Architecture

```
src/
├── main.ts                     # Bootstrap + Swagger setup, global /api prefix
├── app.module.ts               # Top-level module
├── app.controller.ts           # /api/health
├── prisma/                     # PrismaService (global)
├── auth/                       # JWT login/register + RolesGuard + @Roles() decorator
├── users/                      # User CRUD (admin only)
├── forms/                      # Dynamic form CRUD (admin only)
├── departments/                # Department CRUD (admin only)
├── positions/                  # Position CRUD + assign users to positions (admin only)
├── processes/                  # Process definitions + BPMN upload + task assignment binding
├── process-instances/          # Start/terminate/list instances using bpmn-engine
├── tasks/                      # User-task inbox + complete-with-form endpoint
└── bpmn/
    └── bpmn.engine.ts          # Wraps bpmn-engine npm package
```

### Data model

```
User              id, email, name, password, role (ADMIN|USER)
Department        id, name, description
Position          id, departmentId, name, description
UserPosition      userId, positionId (many-to-many join)
Form              id, name, description, fields (JSON string)
Process           id, name, bpmnXml, version, status (DRAFT|ACTIVE|ARCHIVED), createdById
TaskAssignment    processId, taskName, assigneeId? (user), positionId? (position), formId?
ProcessInstance   processId, status (RUNNING|COMPLETED|FAILED|TERMINATED),
                  startedById, bpmnXmlSnapshot, engineState? (JSON), lastError?
Task              processInstanceId, name, assigneeId? (user), positionId? (position), formId?,
                  status, activityId? (BPMN element id), executionId? (engine runtime id)
FormSubmission    taskId, formId, data (JSON string), submittedById
```

### Departments & Positions

Tasks can be assigned to either a **specific user** (`assigneeId`) or a **position** (`positionId`).
When assigned to a position, any user holding that position can see and complete the task.

```
Department: Engineering
  ├── Position: Engineer              → held by John
  ├── Position: Engineering Manager   → held by Jane
  └── Position: Engineering Director  → held by Bob

Department: Finance
  ├── Position: Finance Officer       → held by Jane
  └── Position: Finance Manager       → (vacant)

Department: Human Resources
  ├── Position: HR Manager            → (vacant)
  └── Position: Compliance Officer    → held by Admin
```

A user can hold multiple positions across departments (Jane holds both Engineering Manager
and Finance Officer). This is a common BPMS pattern — tasks are assigned to roles, not
individuals, so coverage is maintained when people are on leave.

### BPMN engine integration

The `BpmnEngineService` wraps the `bpmn-engine` npm package:

- Each `ProcessInstance` gets an in-memory `Engine` instance.
- When the engine reaches a `userTask`, it emits a `wait` event. We capture the
  activity API and persist a `Task` row linked to the instance, the assignee
  (from `TaskAssignment`), and the bound form (if any).
- When the assigned user calls `POST /api/tasks/:id/complete`, we look up the
  activity API and call `api.signal(formData)`. The engine advances, either
  reaching the next `userTask` (creating a new `Task`) or the `end` event
  (marking the instance `COMPLETED`).

### Engine state persistence

Running instances survive server restarts via engine state persistence:

- **On every state transition** (user task waiting, process completed, error),
  `engine.getState()` is called and the serialized state is stored in
  `ProcessInstance.engineState` (a JSON string in the DB).
- **On server startup**, `ProcessInstancesService.onModuleInit()` queries all
  `RUNNING` instances and calls `engine.recover(savedState)` + `engine.resume()`
  for each one. The engine re-emits `wait` events for postponed user tasks,
  which re-registers them in memory.
- **The `executionId`** (bpmn-engine's runtime activity ID) is persisted on
  the `Task` row, so `signalTask` can look it up from the DB instead of relying
  on in-memory state.
- **Crash recovery**: if the server crashes between marking a task `COMPLETED`
  and the engine advancing to the next state, the recovery logic detects the
  stale state on restart: the engine re-emits `wait` for the already-completed
  task, the `onUserTask` callback finds it in the DB as `COMPLETED`, reads the
  stored `FormSubmission`, and re-signals the engine automatically.

### BPMN gateways

The engine supports all three BPMN gateway types (exclusive, inclusive, parallel)
natively via the `bpmn-engine` package. Two seeded processes demonstrate them:

#### 1. Leave Approval — Exclusive Gateway

Routes based on form data, takes exactly ONE branch:

```
Start → Submit Request → Decision Gateway ─┬─ Sick leave ──→ Auto-Approve End
                                            └─ Annual/Unpaid → Approve Request → Approved End
```

#### 2. Expense Approval — Inclusive + Parallel Gateways

Uses an **inclusive gateway** for amount-based routing (takes ALL branches whose
conditions are true) and a **parallel gateway** for simultaneous finalization:

```
Start → Submit Expense → Inclusive Gateway ─┬─ amount > 1000 → Director Approve ──┐
                                             ├─ amount > 5000 → Compliance Review ─┤
                                             └─ !(amount > 1000) → Manager Approve─┤
                                                                                  ↓
                                                                           Parallel Join
                                                                                  ↓
                                                                           Parallel Split ─┬─ Process Payment ─┐
                                                                                            └─ Archive Record  ─┘
                                                                                                     ↓
                                                                                             Parallel Join
                                                                                                     ↓
                                                                                                   End
```

| Amount | Routing |
| ------ | ------- |
| 500 | Manager Approve only |
| 2000 | Director Approve only |
| 6000 | Director Approve + Compliance Review (both run in parallel) |

After all approval tasks complete, the parallel split creates two simultaneous
finalization tasks (Process Payment + Archive Record). Both must complete before
the instance ends.

#### Condition expressions

Conditions must use `language="javascript"` with
`xsi:type="bpmn:tFormalExpression"` for the `language` attribute to be
recognized by bpmn-moddle:

```xml
<bpmn:sequenceFlow id="Flow_Director" sourceRef="InclusiveGateway" targetRef="DirectorApprove">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">
    next(null, environment.variables.amount > 1000);
  </bpmn:conditionExpression>
</bpmn:sequenceFlow>
```

**Important:** The `<` character in XML must be avoided in condition bodies. Use
`!(x > y)` instead of `x <= y`, or escape as `&lt;=`.

**How form data reaches gateway conditions:** when a user completes a task,
the form data is merged into the activity's `environment.variables` before
signaling. This makes the form fields accessible in downstream condition
expressions as `environment.variables.<fieldName>`.

#### Gateway types summary

| Gateway | BPMN element | Behavior |
| ------- | ------------ | -------- |
| Exclusive | `<bpmn:exclusiveGateway>` | Takes exactly ONE outgoing flow (first true condition) |
| Inclusive | `<bpmn:inclusiveGateway>` | Takes ALL outgoing flows whose conditions are true |
| Parallel | `<bpmn:parallelGateway>` | Takes ALL outgoing flows unconditionally (no conditions) |

For joins: a parallel gateway used as a join waits for all TAKEN flows (not all
possible flows), so it works correctly as a join for both parallel and inclusive
splits.

---

## API reference (summary)

All routes are prefixed with `/api` and require JWT bearer auth **except** `auth/*`.

### Auth — `/api/auth`
| Method | Path         | Body                          | Notes |
| ------ | ------------ | ----------------------------- | ----- |
| POST   | `/register`  | `{ email, name, password }`   | Creates a USER-role account |
| POST   | `/login`     | `{ email, password }`         | Returns `{ accessToken, userId, email, name, role }` |

### Users — `/api/users` (admin only, except GET `/me`)
| Method | Path     | Notes |
| ------ | -------- | ----- |
| GET    | `/`      | List users |
| GET    | `/:id`   | Get one user |
| POST   | `/`      | Create user (admin sets role) |
| PATCH  | `/:id`   | Update user |
| DELETE | `/:id`   | Delete user |

### Forms — `/api/forms`
| Method | Path     | Body                                   | Notes |
| ------ | -------- | -------------------------------------- | ----- |
| GET    | `/`      | —                                      | List forms (any authed user) |
| GET    | `/:id`   | —                                      | Get one form |
| POST   | `/`      | `{ name, description?, fields: [] }`   | Admin only |
| PATCH  | `/:id`   | same                                   | Admin only |
| DELETE | `/:id`   | —                                      | Admin only |

### Departments — `/api/departments`
| Method | Path     | Body                              | Notes |
| ------ | -------- | --------------------------------- | ----- |
| GET    | `/`      | —                                 | List all departments (includes positions + holders) |
| GET    | `/:id`   | —                                 | Get one department |
| POST   | `/`      | `{ name, description? }`          | Create (admin) |
| PATCH  | `/:id`   | `{ name?, description? }`         | Update (admin) |
| DELETE | `/:id`   | —                                 | Delete (admin, cascades to positions) |

### Positions — `/api/positions`
| Method | Path                              | Body                                    | Notes |
| ------ | --------------------------------- | --------------------------------------- | ----- |
| GET    | `/`                               | —                                       | List all positions |
| GET    | `/by-department/:departmentId`    | —                                       | List positions in a department |
| GET    | `/:id`                            | —                                       | Get one position (includes holders) |
| POST   | `/by-department/:departmentId`    | `{ name, description? }`                | Create position in department (admin) |
| PATCH  | `/:id`                            | `{ name?, description? }`               | Update (admin) |
| DELETE | `/:id`                            | —                                       | Delete (admin) |
| POST   | `/:id/users`                      | `{ userIds: [] }`                       | Assign users to position (admin) |
| DELETE | `/:id/users/:userId`              | —                                       | Remove user from position (admin) |

**Form `fields` shape:**
```json
[
  { "name": "reason", "label": "Reason", "type": "text", "required": true },
  { "name": "amount", "label": "Amount", "type": "number", "required": true },
  { "name": "leaveType", "label": "Leave Type", "type": "select",
    "options": ["Annual", "Sick", "Unpaid"] }
]
```

### Processes — `/api/processes`
| Method | Path                       | Body                                            | Notes |
| ------- | -------------------------- | ----------------------------------------------- | ----- |
| GET     | `/`                        | —                                               | List all |
| GET     | `/:id`                     | —                                               | Get one (includes assignments) |
| GET     | `/:id/user-tasks`          | —                                               | Extract userTask names from BPMN XML |
| GET     | `/:id/assignments`         | —                                               | List task bindings |
| POST    | `/`                        | `{ name, description?, bpmnXml }`               | Create (admin) |
| PUT     | `/:id/assignments`         | `{ assignments: [{ taskName, assigneeId?, positionId?, selfService?, formId? }] }` | Replace all bindings (admin) |
| PATCH   | `/:id`                     | `{ name?, description?, bpmnXml?, status? }`    | Update (admin) |
| DELETE  | `/:id`                     | —                                               | Delete (admin) |

### Process Instances — `/api/process-instances`
| Method | Path           | Body                              | Notes |
| ------ | -------------- | --------------------------------- | ----- |
| GET    | `/`            | —                                 | List all |
| GET    | `/mine`        | —                                 | Instances started by me OR with a task assigned to me |
| GET    | `/:id`         | —                                 | Get one (includes tasks + startedBy + process) |
| POST   | `/`            | `{ processId, input? }`           | Start a new instance from a process definition |
| POST   | `/:id/terminate` | —                                | Terminate a running instance |

### Tasks — `/api/tasks`
| Method | Path            | Body                       | Notes |
| ------ | --------------- | -------------------------- | ----- |
| GET    | `/`             | —                          | List all tasks |
| GET    | `/mine`         | —                          | Tasks assigned to me directly OR via my positions (excludes claimed-by-others) |
| GET    | `/:id`          | —                          | Get one (includes form fields + submissions + position + selfService) |
| POST   | `/:id/complete` | `{ data?, formId? }`       | Complete task with form data; engine advances |
| POST   | `/:id/claim`    | —                          | Claim a position-based task for myself (required for self-service tasks) |
| POST   | `/:id/release`  | —                          | Release a claimed task back to the position pool |

**Task completion authorization:**
- If `assigneeId` is set → only that user can complete (direct assignment or claimed)
- If `positionId` is set and `assigneeId` is null:
  - If `selfService = true` → **rejected** (must `POST /claim` first)
  - If `selfService = false` → any holder can complete (completer's ID recorded as `assigneeId`)
- If neither is set → any authenticated user can complete (open task)

**Self-service tasks** (ProcessMaker-style):
- Set `selfService: true` on a position-based TaskAssignment to require claiming
- Claiming sets `assigneeId` to the claimer — the task disappears from other holders' queues
- Releasing sets `assigneeId` back to null — the task reappears for all holders
- This prevents two people from working on the same task simultaneously

---

## Walkthrough — the seeded Leave Approval workflow

```bash
# 1. Admin logs in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bpms.local","password":"admin123"}'
# -> { "accessToken": "..." }

# 2. John starts an instance
curl -X POST http://localhost:3000/api/process-instances \
  -H "Authorization: Bearer <JOHN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"processId":"<PROCESS_ID>"}'
# -> instance with one PENDING task "Submit Request" assigned to john

# 3. John completes his task with form data
curl -X POST http://localhost:3000/api/tasks/<TASK1_ID>/complete \
  -H "Authorization: Bearer <JOHN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data":{"employeeName":"John Doe","leaveType":"Annual","startDate":"2026-09-15","endDate":"2026-09-20","reason":"Family trip"}}'
# -> task COMPLETED; engine advances to "Approve Request" assigned to jane

# 4. Jane sees her task
curl http://localhost:3000/api/tasks/mine -H "Authorization: Bearer <JANE_TOKEN>"

# 5. Jane approves
curl -X POST http://localhost:3000/api/tasks/<JANE_TASK_ID>/complete \
  -H "Authorization: Bearer <JANE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data":{"decision":"Approve","comment":"Have a great trip!"}}'
# -> task COMPLETED; engine reaches end event; instance marked COMPLETED
```

A full automated smoke test lives at `scripts/smoke-test.sh`. Run it with
`bash scripts/run-and-test.sh` (which starts the server, runs the test, then stops).

---

## Creating your own process

1. Design a BPMN 2.0 diagram (e.g. with [bpmn.io](https://demo.bpmn.io/))
   with at least one `userTask`. Give each `userTask` a unique `name`.
2. `POST /api/processes` with `{ name, description, bpmnXml }`.
3. `GET /api/processes/:id/user-tasks` to see the names parsed from the XML.
4. `PUT /api/processes/:id/assignments` to bind each task name to a user and form.
5. `PATCH /api/processes/:id` with `{ "status": "ACTIVE" }` to enable starting.

Sample BPMN XML (the one seeded, with exclusive gateway):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveApprovalProcess" name="Leave Approval" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="SubmitRequest"/>
    <bpmn:userTask id="SubmitRequest" name="Submit Request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:documentation>Employee submits a leave request</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="SubmitRequest" targetRef="DecisionGateway"/>
    <bpmn:exclusiveGateway id="DecisionGateway" name="Leave Type Decision">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Sick</bpmn:outgoing>
      <bpmn:outgoing>Flow_NeedsApproval</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <!-- Sick leave auto-approves (no manager needed) -->
    <bpmn:sequenceFlow id="Flow_Sick" sourceRef="DecisionGateway" targetRef="AutoApproveEnd">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">
        next(null, environment.variables.leaveType === 'Sick');
      </bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <!-- Annual/Unpaid leave needs manager approval -->
    <bpmn:sequenceFlow id="Flow_NeedsApproval" sourceRef="DecisionGateway" targetRef="ApproveRequest">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">
        next(null, environment.variables.leaveType !== 'Sick');
      </bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:userTask id="ApproveRequest" name="Approve Request">
      <bpmn:incoming>Flow_NeedsApproval</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:documentation>Manager reviews and approves/rejects the request</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="ApproveRequest" targetRef="ApprovedEnd"/>
    <bpmn:endEvent id="ApprovedEnd" name="Approved">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="AutoApproveEnd" name="Auto-Approved (Sick Leave)">
      <bpmn:incoming>Flow_Sick</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>
```

---

## Tech notes & decisions

- **bpmn-engine (npm `bpmn-engine@25`)** is an ESM-only package. We load it lazily
  via `import('bpmn-engine')` from CommonJS NestJS code — this works seamlessly
  with NestJS's default CommonJS compilation.
- The engine emits `wait` events for `userTask`s. We capture the activity API
  per task in an in-memory `Map<instanceId:executionId, activityApi>` so
  completion is just `activityApi.signal(formData)`.
- **Gateway conditions** require `language="javascript"` +
  `xsi:type="bpmn:tFormalExpression"` on the `<conditionExpression>` element.
  Without `xsi:type`, bpmn-moddle doesn't parse the `language` attribute and
  the condition is treated as a plain expression (which can't do comparisons).
  The condition script must call `next(null, result)` where `result` is truthy/falsy.
- **Form data → gateway conditions**: signal data doesn't automatically reach
  gateway condition expressions. We merge it into `api.environment.variables`
  before signaling, making it accessible as `environment.variables.<field>`.
- For parsing user tasks out of the BPMN XML (used by the admin to know what
  to bind), we use a lightweight regex. For production-grade parsing switch to
  `bpmn-moddle` (already installed as a transitive dep).
- SQLite stores JSON as TEXT strings (`form.fields`, `formSubmission.data`,
  `processInstance.engineState`). The service layer handles serialize/parse.
- **Recovery on startup**: `ProcessInstancesService.onModuleInit()` finds all
  `RUNNING` instances, calls `engine.recover(state).resume({ listener })` for
  each. The engine re-emits `wait` for postponed tasks. If a task was
  completed before the crash but the engine didn't transition, the `onUserTask`
  callback detects it and re-signals with the stored form submission.

---

## Roadmap (production hardening)

Things deliberately out of scope for this MVP but worth tackling next:

1. **Claim/release model** — instead of pre-binding assignees, let any USER claim
   an unassigned task. Add a `claimedById` + `claimedAt` column.
2. **Notifications** — emit SSE/WebSocket events when a task is assigned.
3. **Audit trail** — record every state transition (process + task) for compliance.
4. **Frontend** — a React + TypeScript SPA consuming this API. Swagger UI is
   sufficient for backend-only iteration until then.
5. **Inclusive/parallel gateways** — the engine supports them natively; you
   just need to design BPMN diagrams that use them (no code changes needed).

---

## Scripts

| Command                        | Description |
| ------------------------------ | ----------- |
| `npm run start:dev`            | Start with hot reload |
| `npm run build`                | Compile to `dist/` |
| `npm run start:prod`           | Run compiled `dist/main.js` |
| `npm run prisma:migrate`       | Apply schema changes |
| `npm run prisma:seed`          | Seed initial data |
| `npm run prisma:studio`        | Open Prisma Studio GUI |
| `npm run prisma:reset`         | Drop & recreate DB (destructive) |
| `bash scripts/run-and-test.sh` | Reset DB, seed, start server, run smoke test (gateway routing) |
| `bash scripts/persistence-test.sh` | Test instance recovery after server restart |
