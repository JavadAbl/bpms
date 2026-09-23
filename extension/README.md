# OA Process Activation — فعال سازی فرآیند + جریان کار + انجام کار + سوابق کارتابل + شروع پرونده (Chrome Extension)

A Manifest V3 Chrome extension for exactly one page, served from **two
domains** (same OA system):

```
https://oa.atie-sazan.ir/OA/workspace/itemlist?objectListMode=Current
https://oa.dayins.com/OA/workspace/itemlist?objectListMode=Current
```

It adds four features:

1. A **«فعال سازی فرآیند»** button as the first item inside `#header-userinfo-inner`
   (ahead of the host profile / settings / notifications / sign-out icons). Clicking it opens an RTL Persian
   login modal (**ایمیل + رمز عبور**) that calls the real API:

```
POST /api/auth/login          { "username": "...", "password": "..." }
→ 200 { "accessToken", "userId", "email", "name", "role" }
```

The response (JWT + profile) is kept in **sessionStorage** for use in
future API calls. The **password is never stored or logged**.

2. A **«جریان کار» sidebar item** — a menu item appended to the OA navigation
   panel (`nav#oa-nav → dl.arrows-left`, plus the mobile `#CardtablPanel`)
   that looks native (same classes/structure as the host's جاری / پیگیری
   ها / در دست اقدام items). It exists **only while logged in**. Clicking
   it renders the user's BPMS process-tasks inbox — the کارتابل — as a
   grid table **inside `#bodyContainer`**, the same slot the host app fills
   with its «جاری» list:

   ```
   GET /api/tasks/mine?page=&pageSize=&sortBy=createdAt&sortOrder=desc&search=
   Authorization: Bearer <accessToken>
   → 200 { items: TaskDto[], totalCount }
   ```

   Grid features: Persian columns (ردیف / عنوان کار / فرآیند / فرم /
   تخصیص / وضعیت / تاریخ ایجاد), status pills (در انتظار اقدام),
   self-service chips (خودخدمتی), debounced server-side search, pagination
   (قبلی / بعدی), refresh, and a red badge on the sidebar item with the
   pending-tasks count (like the host's unread counters).

3. **«انجام کار» — the task dialog.** **Double-clicking a task row** in the
   grid (or focusing it and pressing Enter — the host's own «جاری» muscle
   memory) opens a dialog that loads the task detail and renders its dynamic
   form:

   ```
   GET /api/tasks/:id
   Authorization: Bearer <accessToken>
   → 200 TaskDto { …, form: { fields: FormFieldDto[] },
                  instanceVariables: { … } }   // prefill chain
   ```

   Every field type of the BPMS form engine is rendered — text / textarea /
   number / date / select / radio / checkbox / **file** — with `required`,
   `placeholder`, and `defaultValue` support. **Read-only fields**
   (`readOnly: true`) are rendered disabled and **pre-filled from
   `instanceVariables`** — the merged data of the instance's previous form
   submissions, so the approver sees exactly what the requester filled in
   earlier steps.

   Pressing **«ارسال برای ادامه فرآیند»** submits the form and sends the task
   to the next user:

   ```
   POST /api/tasks/:id/complete     { "data": { <field>: <value>, … },
                                       "formId": "…" (optional) }
   ```

   The backend stores the submission, maps the values to process variables,
   and signals the BPMN engine — which advances the flow and creates the
   **next userTask for the next user** in the process. The completed task
   leaves the کارتابل: the dialog shows «کار با موفقیت ثبت شد ✓», auto-closes,
   and the grid + sidebar badge re-sync.

4. **«سوابق کارتابل» — case history + file attachments (v1.7).** A second
   login-gated sidebar item opens the **case list** (موارد — every process
   instance the user participates in, any status) as a grid in
   `#bodyContainer`:

   ```
   GET /api/process-instances/cases?page=&pageSize=&sortBy=startedAt&sortOrder=desc
   → 200 { items: ProcessInstanceDto[], totalCount }
   ```

   Columns: ردیف / فرآیند / شروع‌کننده / وضعیت (در حال اجرا، تکمیل شده،
   ناموفق، خاتمه یافته) / تاریخ شروع / روند گام‌ها. **Clicking a row
   expands it in place** to show the case's full step timeline (گام / مسئول /
   فرم / وضعیت / تاریخ ایجاد / تاریخ انجام — ships with the cases payload)
   plus **«پیوست‌های پرونده»** — every attachment of the case, lazily fetched
   once per case:

   ```
   GET /api/files/by-instance/:instanceId   → 200 FileDto[] (uploader info)
   GET /api/files/:id                       → the bytes (authenticated download)
   ```

   The same two views live inside the «انجام کار» dialog as collapsible
   sections: **«سوابق کارتابل»** (the task's own case timeline, via the rich
   `GET /api/process-instances/:id` detail — per-step assignee/position/form)
   and **«پیوست‌های پرونده»** (the instance's attachments with download
   buttons).

   **File attachments inside the form** — fields of type `file`:
   - *Editable* (`multiple` supported, 10 MB per file — client-checked
     first): picked files appear as removable chips; on submit each file is
     uploaded first and the returned metas become the field value:

     ```
     POST /api/files          multipart/form-data, field "file"
     → 200 { "id", "name", "size", "mimeType" }        // FileMetaDto
     ```

     The metas array is stored in the completion data
     (`data.attachments = [meta, …]`); when the task completes, the backend
     stamps `taskId`/`instanceId` onto the referenced files — they then show
     up in «پیوست‌های پرونده» for every later step of the case.
   - *Read-only* (`readOnly: true`): the metas uploaded in **previous steps**
     arrive via `instanceVariables` and render as authenticated download
     links (name + size).

   Downloads go through `authedFetch()` (JWT attached) and are handed to the
   browser as blob downloads, so Persian filenames survive.

   **Self-service position tasks** (خودخدمتی) must be claimed first — the
   dialog shows an amber notice and a «در اختیار گرفتن کار» button
   (`POST /api/tasks/:id/claim`); submit stays disabled until the task is
   claimed. Tasks with no form submit directly. A 403 (someone else completed
   or claimed the task first) shows a Persian conflict message and refreshes
   the grid on close; a 401 shows the expired-session message with an
   in-dialog «ورود دوباره» button.

5. **«جریان کار جدید» — start a new case (v1.8).** A second **header
   button** (green, right next to the «فعال سازی فرآیند» login button;
   visible ONLY while logged in, like the sidebar items) opens the **start
   dialog**: a searchable, selectable list of the startable BPMS processes
   (client-side search over name + description, keyboard: focus a row and
   press Enter to select). Pressing **«شروع پرونده»** starts a new case:

```
GET  /api/processes?page=&pageSize=&sortBy=name&sortOrder=asc
     → 200 { items: ProcessDto[], totalCount }
POST /api/process-instances   { "processId": "…" }
     → 201 ProcessInstanceDto — the BPMN engine creates the first task
       (usually in the starter's کارتابل); the tasks grid + sidebar badge
       re-sync immediately.
```

   The process list is filtered **exactly like the web app's start
   dialog**: only ACTIVE processes are listed, and a process with a
   starter restriction appears **only to its starters** (admins bypass) —
   a user who is not part of the starting users never sees that process
   at all. A 400 (process no longer ACTIVE) or a 403 (starter restriction,
   e.g. the list changed after the dialog was opened) each show their own
   Persian message; a **401** triggers the usual session-expired cleanup
   with «ورود دوباره». After a successful start the dialog shows a green
   confirmation («پرونده «…» شروع شد …») and auto-closes.

## Install ("Load unpacked")

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this `oa-process-activation` folder
5. Visit <https://oa.atie-sazan.ir/OA/workspace/itemlist?objectListMode=Current>
   or <https://oa.dayins.com/OA/workspace/itemlist?objectListMode=Current> —
   the purple «فعال سازی فرآیند» button appears in the header.

> After editing anything in `src/`, click the ↻ **Reload** button on the
> extension's card in `chrome://extensions`, then refresh the OA page.

## Login flow

1. Click **فعال سازی فرآیند** → modal opens.
   - The username field is prefilled with the last used username (remembered in
     `chrome.storage.local` — username only, never the password).
   - A green note shows the active session if one exists.
2. Enter **ایمیل** + **رمز عبور**, press **ورود** (or Enter).
   - Empty fields / bad email format → inline Persian validation error.
   - While the request is in flight the button shows **در حال ورود…** and
     disables.
3. `src/api.js` → `POST {API.baseUrl}/api/auth/login` (20 s timeout).
   - **200** → the whole response is stored in `sessionStorage` under
     `oaProcessActivationAuth`; the modal shows
     «ورود با موفقیت انجام شد ✓» and closes; the header button's dot
     turns green and its tooltip shows the logged-in user; the **two
     sidebar items** («جریان کار» + «سوابق کارتابل») appear.
   - **400/401/403** → «ایمیل یا رمز عبور نادرست است.»
   - Network/timeout → «خطا در ارتباط با سرور — لطفاً اتصال شبکه را بررسی کنید.»
   - Other HTTP codes → «خطای غیرمنتظره از سرور (کد …).»

### The session

- Key: **`oaProcessActivationAuth`** (sessionStorage of the OA tab).
- Value: `{ accessToken, userId, email, name, role }` — exactly the login
  response.
- sessionStorage is **per-origin and per-tab**: the session lives as long
  as that OA tab, survives page reloads, and disappears when the tab is
  closed. Logging in on the other OA domain (or another tab) gets its own
  session.
- Helpers in `src/api.js`:
  - `getAuthSession()` / `setAuthSession(data)` / `clearAuthSession()`
  - `authedFetch(path, options)` — **use this for future API calls**; it
    reads the JWT and attaches `Authorization: Bearer <accessToken>`:

    ```js
    import { authedFetch } from './api.js';
    const res = await authedFetch('/api/processes/123/activate', {
      method: 'POST',
    });
    ```

### API base URL

The BPMS backend is a **separate service** from the OA host site (NestJS,
port 3001 in development, CORS enabled). `API.baseUrl` in `src/config.js`
defaults to `http://localhost:3001` — change it to wherever BPMS is
deployed (e.g. `https://bpms.example.com`). Two places must match:

1. `API.baseUrl` in `src/config.js`
2. `host_permissions` in `manifest.json` — the BPMS origin must be listed
   there so the content script is allowed to call it cross-origin (the
   backend must also keep its CORS open, as `enableCors({ origin: true })`
   already does).

## «جریان کار» / «سوابق کارتابل» sidebar + «جریان کار جدید» header flow

1. **Logged out** → no sidebar item appears anywhere, and the start button
   is hidden (the header login button is the entry point).
2. **Login succeeds** (or the tab reloads with a live session) → BOTH
   sidebar items appear at the end of `dl.arrows-left` and in the mobile
   panel («جریان کار» carries a red badge with the pending-tasks count),
   and the green «جریان کار جدید» header button appears next to the login
   button.
3. **Click «جریان کار»** → the tasks grid replaces `#bodyContainer`'s
   content and fetches `GET /api/tasks/mine` (page size 10, newest first,
   JWT attached). States: loading spinner → rows, or empty / error
   (تلاش دوباره) / expired-session (ورود دوباره → reopens the login modal).
4. **Click «سوابق کارتابل»** → the cases grid takes over the same slot
   (`GET /api/process-instances/cases`, page size 10, newest first). No
   search box — the backend route has no searchable fields, so a search
   parameter would be silently ignored. Click a row to expand its step
   timeline + پیوست‌های پرونده (fetched once per case, cached); click again
   to collapse. Pagination + به‌روزرسانی as usual.
5. **Click «جریان کار جدید» (header)** → the start dialog (a modal, not a
   grid — the slot is untouched): searchable list of startable processes —
   ACTIVE + permitted by each process's starter restriction, exactly like
   the web app (v1.8, see feature 5 above). Choosing one and pressing
   «شروع پرونده» starts the case; the tasks grid (if open) and the sidebar
   badge refresh via `onStarted`.
6. The two sidebar items play the host's own selection dance between each
   other and with the host's جاری / پیگیری / … items — only one grid owns
   `#bodyContainer` at a time, and whoever loses the slot deselects its
   sidebar item. The start dialog keeps the current grid in place (it is a
   modal).
7. **Session expires (401)** → the session is cleared, all sidebar items
   disappear, the start button hides, the header button's dot goes gray,
   and the open grid shows «نشست شما منقضی شده است» with a «ورود دوباره»
   button.

## «انجام کار» dialog flow

1. **Double-click a row** (or focus + Enter) in the tasks grid → the dialog
   opens, fetches `GET /api/tasks/:id`, and shows the task meta (فرآیند، فرم،
   تخصیص، تاریخ ایجاد) + description + its dynamic form. In parallel it
   fetches the case detail (`GET /api/process-instances/:id`) and the
   instance attachments (`GET /api/files/by-instance/:id`) for the two
   sections below the form — neither ever blocks the form itself.
2. **Read-only fields** come pre-filled from `instanceVariables` and are
   disabled — data entered in the instance's earlier tasks. This includes
   read-only **file** fields: metas uploaded in previous steps render as
   download links.
3. **Editable file fields** — «افزودن پیوست…» picker (multi-select when
   `multiple`), picked files as removable chips with Persian sizes, 10 MB
   per-file guard with a Persian error.
4. **Submit with a missing required field** → inline Persian error
   («تکمیل «…» الزامی است.» / for file fields «پیوست حداقل یک فایل …
   الزامی است.») and focus moves to the offending control.
5. **ارسال برای ادامه فرآیند** → picked files are uploaded first
   (`POST /api/files`, button shows «در حال بارگذاری پیوست‌ها…»), their
   metas become the field values, then `POST /api/tasks/:id/complete` sends
   the collected values (numbers as numbers, checkboxes as booleans; empty
   optional values are omitted). An upload failure keeps the task
   un-completed and shows «خطا در بارگذاری پیوست …». Success locks the
   form, shows the green message, auto-closes after ~1.8 s, and refreshes
   the grid — the task has left the کارتابل, the badge count drops, and the
   stamped attachments now appear in the case's «پیوست‌های پرونده».
6. **Self-service task** → amber «خودخدمتی» notice + claim button; after
   `POST /api/tasks/:id/claim` the form unlocks and submitting completes the
   task.
7. **Form-less task** → an info note («این کار فرم ندارد…»); submitting
   completes it with no data.
8. **401 anywhere in the dialog** (detail, history, attachments, upload,
   complete) → the session is cleared (both sidebar items removed, button
   grayed) and the dialog offers «ورود دوباره», which reopens the login
   modal in place.

## ES module architecture

MV3 content scripts **cannot** be declared as ES modules — `"type":
"module"` is not supported for `content_scripts`. The supported pattern
(this extension uses it) is:

- **`content.js`** is a tiny *classic* script (the only file the manifest
  injects). It dynamically `import()`s `src/main.js`.
- **`src/*`** files are real ES modules (`import` / `export`). They are
  listed in `web_accessible_resources` (restricted to the two OA domains),
  which is what allows a content script to import them. The modules run in
  the content script's isolated world — same DOM, same `chrome.storage`
  access as before.

No bundler is needed; the folder is loaded directly as an unpacked
extension.

| File | Responsibility |
|------|----------------|
| `content.js` | Classic bootstrap — resolves the module base URL and `import()`s `src/main.js` |
| `src/config.js` | All constants: target pages, API settings (tasks / files / cases), storage keys, element IDs, Persian strings |
| `src/url-gate.js` | `isTargetPage()` — exact host + path + `objectListMode=Current` check |
| `src/utils.js` | Tiny shared helpers (`ce()`, `maskToken()`, `formatFaDate()`, `faNum()`, `formatBytes()`) |
| `src/styles.js` | Namespaced CSS (`oa-pa-`) + `ensureStyles()` |
| `src/storage.js` | Remembered email (prefill only) + legacy credential cleanup |
| `src/api.js` | `login()`, `fetchMyTasks()`, `fetchTaskById()`, `completeTask()`, `claimTask()`, session accessors, `authedFetch()`, `ApiError` |
| `src/files.js` | File attachments: `uploadFile()`, `fetchInstanceAttachments()`, `downloadAttachment()` (JWT'd blob download) |
| `src/cases.js` | سوابق کارتابل: `fetchCases()` (case list) + `fetchCaseDetail()` (rich timeline) |
| `src/processes.js` | Start-case API (v1.8): `fetchActiveProcesses()` + `startProcessCase()` |
| `src/header-button.js` | Header buttons: «فعال سازی فرآیند» (login) + «جریان کار جدید» (start case, v1.8 — session-gated) |
| `src/sidebar.js` | «جریان کار» + «سوابق کارتابل» sidebar items: inject/remove (login-gated), badge, per-kind selection |
| `src/tasks-grid.js` | The process-tasks inbox grid inside `#bodyContainer`: states, search, pagination, dblclick hook, `refreshTasksGrid()` |
| `src/cases-grid.js` | The سوابق کارتابل cases grid: statuses, expandable step timeline + lazy attachments, pagination |
| `src/start-dialog.js` | «جریان کار جدید» start dialog (v1.8): ACTIVE + starter-permitted process picker, search, selection, `POST /api/process-instances` |
| `src/task-dialog.js` | «انجام کار» dialog: dynamic form renderer (incl. file fields), read-only prefill, attachment upload on submit, سوابق کارتابل + پیوست‌های پرونده sections, claim flow, complete submit |
| `src/modal.js` | RTL login modal: build, open/close, validation, submit flow |
| `src/main.js` | Composition root: wires modules (dependency injection — no circular imports) + lifecycle (MutationObserver, URL watcher) |

**Adding a new module:** create `src/whatever.js`, `export` from it,
`import` it where needed (usually `main.js`), then reload the extension.
Nothing else to configure — `web_accessible_resources` already covers
`src/*`.

**Security note on `web_accessible_resources`:** files under `src/` are
fetchable by pages on the two OA origins (and only those). They contain no
secrets — just UI code and strings — so this is safe. Keep it that way.

## How it works

- **`manifest.json`** loads the bootstrap on every page of both
  `oa.atie-sazan.ir` and `oa.dayins.com` (`all_frames: true`), then the
  URL gate activates it only on the exact target page
  (host + path + `objectListMode=Current`). More domains can be added in
  two places: the `matches` arrays in `manifest.json` and the
  `TARGET.hosts` list in `src/config.js`.
- **Header buttons** — prepended as the first children of
  `#header-userinfo-inner` (as table-cells, with their labels).
  On desktop, `#header-userinfo` is widened to fit the row (the host default
  is 320px + overflow:hidden) so settings / notifications / sign-out stay visible. Falls back to before
  `#header-userinfo`, then to floating buttons if the header is missing.
- **Sidebar items** — appended to the host's own `dl.arrows-left` (desktop)
  and `#CardtablPanel` (mobile) with the host's own item classes, so they
  inherit the native OA styling. Their anchors stop event propagation on
  desktop so the host SPA never tries to route items it doesn't own; on
  mobile the click is allowed to bubble so the host's menu-collapse handler
  still runs. No `data-objectListMode` is set — that attribute belongs to
  the host's navigation logic.
- **Grids** — rendered into `#bodyContainer` (the host's own content slot).
  All grid DOM is built with `createElement`/`textContent` — no `innerHTML`
  with API data (XSS-safe). Task rows carry `data-task-id`; double-click (or
  focus + Enter) opens the «انجام کار» dialog. Case rows carry
  `data-instance-id` and expand in place. The dialog builds its form and
  sections the same XSS-safe way.
- **File uploads** — `POST /api/files` is multipart; `src/files.js` lets the
  browser generate the boundary (no manual `Content-Type`). The 10 MB limit
  mirrors the backend's `MAX_FILE_SIZE` and is checked client-side first
  for a friendlier Persian message.
- **Guards** — a MutationObserver re-injects the button/modal/sidebar items
  if the OA app wipes them, a second observer on `#bodyContainer` detects
  the host (or our other grid) reclaiming the content slot (→ deselect the
  right item), and a URL watcher adds/removes everything on SPA-style
  navigation.
- **Console log** — every successful login prints
  `[OA Process Activation] login successful — session stored in sessionStorage: { email, name, role, userId, accessToken (masked) }`.
  Failed attempts log `[OA Process Activation] login failed: …`. Task
  completions log the task + `attachmentsUploaded` count.
- **Legacy cleanup** — versions ≤ 1.3 stored `{username, password}` in
  `chrome.storage.local`. On boot, v1.4 deletes that obsolete entry once.
  From v1.4 the password is never persisted anywhere.

## Files

```
oa-process-activation/
├── manifest.json      # MV3: content_scripts + web_accessible_resources + storage + host_permissions (BPMS origin)
├── content.js         # classic bootstrap → dynamic import('src/main.js')
├── src/
│   ├── config.js      # constants + Persian strings (customize here)
│   ├── url-gate.js    # exact-page activation check
│   ├── utils.js       # ce(), maskToken(), formatFaDate(), faNum(), formatBytes()
│   ├── styles.js      # namespaced CSS (modal + sidebar + grids + dialog + file fields + sections)
│   ├── storage.js     # remembered email + legacy cleanup
│   ├── api.js         # login(), tasks inbox/detail/complete/claim, session accessors, authedFetch()
│   ├── files.js       # uploadFile(), fetchInstanceAttachments(), downloadAttachment()
│   ├── cases.js       # fetchCases(), fetchCaseDetail()
│   ├── processes.js   # fetchActiveProcesses(), startProcessCase() — v1.8
│   ├── header-button.js
│   ├── sidebar.js     # «جریان کار» + «سوابق کارتابل» + «جریان کار جدید» sidebar items
│   ├── tasks-grid.js  # process-tasks inbox grid
│   ├── cases-grid.js  # سوابق کارتابل cases grid (expandable timeline + attachments)
│   ├── start-dialog.js# «جریان کار جدید» — ACTIVE process picker → start case (v1.8)
│   ├── task-dialog.js # «انجام کار» dialog — form fill + attachments + submit to next user
│   ├── modal.js
│   └── main.js        # composition root + lifecycle
└── icons/             # toolbar / store icons
```

## Security note

- The **password** is only kept in memory long enough to call the login
  endpoint — it is never written to chrome.storage, sessionStorage, or the
  console.
- The **JWT** sits in sessionStorage (per-tab). Anything (any script) on
  the same OA origin in that tab can read it — that's inherent to
  sessionStorage. If that's a concern for future endpoints, consider
  moving session storage into the extension's isolated world
  (`chrome.storage.session`) and doing all API calls from the extension.

## Notes

- To activate the button on **all** cardtable modes (پیگیری ها, در دست اقدام,
  …) instead of only جاری, drop the query check in `src/url-gate.js`.
- Seeded BPMS dev accounts (from the backend's `prisma/seed.ts`):
  `admin@bpms.local / admin123` (ADMIN), `john@ / jane@ / bob@bpms.local /
  user123` (USER).
- The cases route has no searchable fields in the backend — that's why the
  سوابق کارتابل grid ships without a search box (the parameter would be
  silently ignored).
- `GET /api/tasks/participated` (once-received tasks that left the flow
  without being completed — CANCELLED) is another available backend view,
  not currently surfaced by the extension.
- To pause/uninstall: `chrome://extensions` → toggle off or Remove.
