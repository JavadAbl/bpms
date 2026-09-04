# API reference

Base URL: `http://localhost:3001/api` (from the browser: `/api/*` on :3000, proxied).
Auth: `Authorization: Bearer <accessToken>` — login returns **`accessToken`**. Roles: 🌐 = any authenticated user, 🔒 = ADMIN only.
Interactive docs: `/api/docs` (Swagger). All IDs are UUIDs; validation errors are `400` with a message; permission errors `403`.

## Auth

| Method & path | Role | Notes |
|---|---|---|
| `POST /auth/login` `{email, password}` | 🌐 | → `{accessToken, user}` |
| `GET /auth/me` | 🌐 | current user profile |

## Users / Departments / Positions (org structure)

| Method & path | Role | Notes |
|---|---|---|
| `GET /users` · `GET /users/:id` | 🌐 | needed by pickers (assignments) |
| `POST /users` · `PATCH /users/:id` · `DELETE /users/:id` | 🔒 | `{email, name, password, role?}` |
| `GET /departments` · `GET /departments/:id` | 🌐 | |
| `POST /departments` · `PATCH /departments/:id` · `DELETE /departments/:id` | 🔒 | `{name, description?}` |
| `GET /positions` · `GET /positions/by-department/:deptId` | 🌐 | |
| `POST /positions/by-department/:deptId` · `PATCH /positions/:id` · `DELETE /positions/:id` | 🔒 | `{name, description?, isManager?}` |
| `POST /positions/:id/users` `{userIds}` · `DELETE /positions/:id/users/:userId` | 🔒 | M2M assignment |

## Processes

| Method & path | Role | Notes |
|---|---|---|
| `GET /processes` · `GET /processes/:id` | 🌐 | detail includes `assignments`, `userTasks` |
| `POST /processes` `{name, description?, bpmnXml}` | 🔒 | condition-validated; creates version 1 |
| `PATCH /processes/:id` `{name?/description?/bpmnXml?/status?/note?}` | 🔒 | new version row **only when XML actually changed**; `status: 'ACTIVE'` re-validates conditions; `note` = changelog for the new version |
| `DELETE /processes/:id` | 🔒 | fails if instances exist (FK restrict) |
| `GET /processes/:id/user-tasks` | 🌐 | BPMN userTasks extracted from XML |
| `GET /processes/:id/assignments` · `PUT /processes/:id/assignments` `{assignments:[…]}` | 🌐 / 🔒 | assignment row: `{taskName, strategy, sourceTaskName?, assigneeId?, positionId?, selfService?, formId?}`; starter strategies require a *different, existing* `sourceTaskName` (400 otherwise) |
| `GET /processes/:id/variables` · `PUT /processes/:id/variables` `{variables:[{name,label?,type?}]}` | 🌐 / 🔒 | |

### Versions

| Method & path | Role | Notes |
|---|---|---|
| `GET /processes/:id/versions` | 🌐 | metadata newest-first: `{id, version, note, createdAt, createdBy, xmlSize, isCurrent}` |
| `GET /processes/:id/versions/:version` | 🌐 | full XML of that version (404 if unknown) |
| `POST /processes/:id/versions/:version/restore` `{note?}` | 🔒 | append-copy → new current version; 400 if already current |

## Forms

| Method & path | Role | Notes |
|---|---|---|
| `GET /forms?processId=…` · `GET /forms/:id` | 🌐 | |
| `POST /forms` · `PATCH /forms/:id` · `DELETE /forms/:id` | 🔒 | `{name, description?, processId, fields:[FormFieldDto]}` — field types: `text/textarea/number/date/select/checkbox/radio/file`; file fields use `multiple?: boolean` |

## Categories (reusable select option lists)

| Method & path | Role | Notes |
|---|---|---|
| `GET /categories` (with items + usage) | 🌐 | |
| `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id` | 🔒 | `key` regex `^[a-zA-Z][a-zA-Z0-9_]*$`; PATCH replaces items atomically; duplicate values → 409 |

## Process instances

| Method & path | Role | Notes |
|---|---|---|
| `GET /process-instances` · `GET /process-instances/mine` | 🌐 | list includes process + starter |
| `POST /process-instances` `{processId}` | 🌐 | process must be ACTIVE; XML snapshot pinned |
| `GET /process-instances/:id` | 🌐 | tasks with assignee/position/form |
| `POST /process-instances/:id/terminate` | 🌐 | marks TERMINATED + cancels remaining tasks — ⚠ currently NOT admin-only (hardening candidate, see roadmap) |

## Tasks

| Method & path | Role | Notes |
|---|---|---|
| `GET /tasks` · `GET /tasks/mine` | 🌐 | mine = assignee or position-holder view |
| `GET /tasks/:id` | 🌐 | includes `instanceVariables` (prefill chain for readOnly fields) |
| `POST /tasks/:id/complete` `{data, formId?}` | 🌐 (permission-checked) | data keys = field names; empty readOnly values are stripped client-side; file metas stamped server-side |
| `POST /tasks/:id/claim` · `POST /tasks/:id/release` | 🌐 | self-service position tasks only |

## Files

| Method & path | Role | Notes |
|---|---|---|
| `POST /files` (multipart, field name **`file`**) | 🌐 | ≤10 MB → `{id, name, size, mimeType}` (store this meta in the form value) |
| `GET /files/:id` | 🌐 | streams the bytes with the original (UTF-8/Persian) filename; 401/404 |
| `GET /files/by-instance/:instanceId` | 🌐 | all attachments of an instance incl. uploader + task/instance stamping |

## Error semantics worth knowing

- `400` with `Assignment for "X" (strategy …) requires sourceTaskName…` — starter strategy misconfigured.
- `400 Cannot activate: invalid gateway condition expressions…` — activation gate; message names each bad flow.
- `400 Version N is already the current version` — restore no-op.
- `401` — missing/invalid JWT (file downloads included).
- `403 You do not hold the position required…` / `403 This is a self-service task — you must claim it first`.
- Task completion with an over-limit upload never happens client-side of the API — uploads are separate calls; oversize upload → `413`.
