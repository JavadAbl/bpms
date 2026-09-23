/**
 * task-dialog.js — the «انجام کار» dialog (v1.6 + v1.7).
 * ------------------------------------------------
 * Opened by DOUBLE-CLICKING a task row in the tasks grid (or focusing the
 * row and pressing Enter). Fetches the task detail:
 *
 *   GET /api/tasks/:id  → TaskDto incl. form.fields AND instanceVariables
 *                         (merged data from the instance's previous form
 *                         submissions — the prefill chain)
 *
 * renders the dynamic form (text / textarea / number / date / select /
 * radio / checkbox / FILE — see below; required; placeholder; defaultValue;
 * readOnly fields rendered disabled and pre-filled from instanceVariables),
 * and submits it:
 *
 *   POST /api/tasks/:id/complete  { data: {field: value…}, formId }
 *
 * On the backend the BPMN engine is signalled with the submitted values and
 * advances the flow — the next userTask is created for the NEXT USER in the
 * process. That is how the task is "sent to the next user".
 *
 * v1.7 — file attachments + سوابق کارتابل:
 *   - form fields of type "file" render a picker (multiple per
 *     field.multiple, 10 MB per file — client-checked first). On submit each
 *     selected file is uploaded (POST /api/files → FileMetaDto) and the meta
 *     array is stored as the field value in the completion data; the backend
 *     stamps taskId/instanceId onto the uploaded rows.
 *   - readOnly "file" fields are pre-filled from instanceVariables — an
 *     array of metas from previous steps, rendered as authenticated
 *     download links (GET /api/files/:id).
 *   - «سوابق کارتابل» section: the case's task timeline
 *     (GET /api/process-instances/:id — participant-gated, rich per-step
 *     assignee/position/form info).
 *   - «پیوست‌های پرونده» section: every attachment of the instance
 *     (GET /api/files/by-instance/:id), each with an authenticated download.
 *
 * Self-service position tasks must be claimed first
 * (POST /api/tasks/:id/claim) — the dialog shows an amber claim notice and
 * keeps the submit button disabled until the task is claimed.
 *
 * Dependency injection (no circular imports — main.js wires):
 *   deps.onCompleted      — refresh the grid after completed/conflicted task
 *   deps.onSessionExpired — full session cleanup (main.js)
 *   deps.onRelogin        — open the login modal («ورود دوباره»)
 *
 * All DOM is built with createElement/textContent — no innerHTML with API
 * data (XSS-safe).
 */

import { IDS, TEXT, API } from './config.js';
import { fetchTaskById, completeTask, claimTask, ApiError } from './api.js';
import {
  uploadFile,
  downloadAttachment,
  fetchInstanceAttachments,
} from './files.js';
import { fetchCaseDetail } from './cases.js';
import { ce, formatFaDate, formatBytes, faNum } from './utils.js';

const deps = {
  onCompleted: null,
  onSessionExpired: null,
  onRelogin: null,
};

let escWired = false;
let closeTimer = null;
let submitting = false;
let claimInFlight = false;
let claimNeeded = false;
let currentTaskId = null; // task shown in the dialog right now
let currentInstanceId = null; // its process instance — drives history/attachments
let task = null; // its TaskDto detail
let fieldControls = []; // rendered field controllers
let outcome = null; // 'completed' | 'conflict' → refresh grid on close

/* ============================== Build ===================================== */

function overlayEl() {
  return document.getElementById(IDS.taskOverlay);
}

function contentEl() {
  return document.getElementById('oa-pa-task-content');
}

function dialogVisible() {
  const ov = overlayEl();
  return !!ov && !ov.classList.contains('oa-pa-hidden');
}

function buildOnce() {
  if (overlayEl() || !document.body) return;
  const overlay = ce('div');
  overlay.id = IDS.taskOverlay;
  overlay.className = 'oa-pa-hidden';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTaskDialog();
  });

  const dialog = ce('div');
  dialog.id = IDS.taskDialog;
  dialog.dir = 'rtl';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'oa-pa-task-title-el');

  // -- header ----------------------------------------------------------------
  const head = ce('div', 'oa-pa-modal-header');
  const title = ce('div', 'oa-pa-modal-title', TEXT.taskDialogTitle);
  title.id = 'oa-pa-task-title-el';
  const closeBtn = ce('button', 'oa-pa-close', '\u00D7');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', TEXT.closeAria);
  closeBtn.addEventListener('click', () => closeTaskDialog());
  head.append(title, closeBtn);

  // -- body --------------------------------------------------------------------
  const body = ce('div', 'oa-pa-task-body');
  const subtitle = ce('div', 'oa-pa-task-subtitle');
  subtitle.id = 'oa-pa-task-subtitle';
  const meta = ce('div', 'oa-pa-task-meta');
  meta.id = 'oa-pa-task-meta';
  const desc = ce('p', 'oa-pa-task-desc oa-pa-hidden');
  desc.id = 'oa-pa-task-desc';
  const content = ce('div');
  content.id = 'oa-pa-task-content';
  const errBox = ce('div', 'oa-pa-error oa-pa-hidden');
  errBox.id = 'oa-pa-task-error';
  const okBox = ce('div', 'oa-pa-success oa-pa-hidden');
  okBox.id = 'oa-pa-task-success';
  okBox.textContent = TEXT.taskSuccess;
  body.append(subtitle, meta, desc, content, errBox, okBox);

  // -- footer --------------------------------------------------------------------
  const foot = ce('div', 'oa-pa-modal-footer');
  const cancelBtn = ce('button', 'oa-pa-btn-secondary', TEXT.cancel);
  cancelBtn.type = 'button';
  cancelBtn.id = 'oa-pa-task-cancel';
  cancelBtn.addEventListener('click', () => closeTaskDialog());
  // type=button on purpose: submit is driven by onSubmit() (works both with
  // and without a rendered <form>); Enter inside the form is handled by the
  // form's own submit listener + a hidden submit button.
  const submitBtn = ce('button', 'oa-pa-btn-primary', TEXT.taskSubmit);
  submitBtn.type = 'button';
  submitBtn.id = 'oa-pa-task-submit';
  submitBtn.addEventListener('click', () => onSubmit());
  foot.append(cancelBtn, submitBtn);

  dialog.append(head, body, foot);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  wireEscapeKey();
}

function wireEscapeKey() {
  if (escWired) return;
  escWired = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const ov = overlayEl();
    if (ov && !ov.classList.contains('oa-pa-hidden')) {
      closeTaskDialog();
    }
  });
}

/* ============================== Open / close =============================== */

/**
 * Opens the dialog for a grid-row task ({id, name, processInstanceId, ...} —
 * the full detail is fetched fresh from GET /api/tasks/:id; the سوابق
 * کارتابل timeline and پیوست‌های پرونده are fetched in parallel from
 * /api/process-instances/:id and /api/files/by-instance/:id).
 */
export function openTaskDialog(rowTask) {
  if (!rowTask || !rowTask.id) return;
  buildOnce();
  const ov = overlayEl();
  if (!ov) return;

  clearTimeout(closeTimer);
  closeTimer = null;
  submitting = false;
  claimInFlight = false;
  claimNeeded = false;
  task = null;
  fieldControls = [];
  outcome = null;
  currentTaskId = String(rowTask.id);
  currentInstanceId = rowTask.processInstanceId
    ? String(rowTask.processInstanceId)
    : null;

  resetDialogUi();
  setSubtitle(rowTask.name || '');
  const meta = document.getElementById('oa-pa-task-meta');
  if (meta) meta.textContent = '';
  hideDesc();

  showContentState('loading');
  ov.classList.remove('oa-pa-hidden');
  console.log('[OA Process Activation] task dialog opened:', {
    taskId: currentTaskId,
    name: rowTask.name || '',
  });
  loadDetail(currentTaskId);
}

function resetDialogUi() {
  hideError();
  hideSuccess();
  setPending(false);
}

/**
 * Closes the dialog. Blocked while a submit is in flight (unless it already
 * has an outcome — after success the auto-close is imminent anyway).
 * When the task was completed (or hit a conflict), the grid is refreshed
 * exactly once via deps.onCompleted.
 */
export function closeTaskDialog() {
  if (submitting && !outcome) return;
  clearTimeout(closeTimer);
  closeTimer = null;
  const ov = overlayEl();
  if (ov) ov.classList.add('oa-pa-hidden');
  const refresh = outcome;
  outcome = null;
  task = null;
  currentTaskId = null;
  currentInstanceId = null;
  fieldControls = [];
  claimNeeded = false;
  if (refresh && typeof deps.onCompleted === 'function') {
    deps.onCompleted(refresh);
  }
}

function closeDialogSoon(ms) {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    submitting = false; // let the auto-close pass the guard
    closeTaskDialog();
  }, ms);
}

/* ============================== Data loading ================================ */

function isCurrent(id) {
  return dialogVisible() && currentTaskId === String(id);
}

async function loadDetail(id) {
  try {
    const detail = await fetchTaskById(id);
    if (!isCurrent(id)) return; // closed/reopened meanwhile
    task = detail;
    if (!currentInstanceId && task.processInstanceId) {
      currentInstanceId = String(task.processInstanceId);
    }
    renderDetail();
    // AFTER renderDetail built the section bodies — fetches the سوابق
    // کارتابل timeline + پیوست‌های پرونده in parallel, non-blocking.
    loadInstanceContext();
  } catch (err) {
    if (!isCurrent(id)) return;
    console.warn(
      '[OA Process Activation] task detail failed:',
      err instanceof ApiError ? err.message : err
    );
    if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
      if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
      renderExpired();
      return;
    }
    renderLoadError();
  }
}

/**
 * Fetches the سوابق کارتابل timeline + پیوست‌های پرونده for the current
 * instance — in parallel with each other, never blocking the form. Each
 * section paints itself when its data arrives (or shows its own error).
 */
function loadInstanceContext() {
  if (!currentInstanceId) return;

  // -- سوابق کارتابل -------------------------------------------------------
  const historyBody = document.getElementById('oa-pa-task-history-body');
  if (historyBody) {
    historyBody.textContent = '';
    historyBody.appendChild(
      ce('div', 'oa-pa-dialog-note', TEXT.casesLoading)
    );
    fetchCaseDetail(currentInstanceId)
      .then((inst) => {
        if (!dialogVisible() || currentInstanceId !== String(inst.id)) return;
        paintHistory(historyBody, inst);
      })
      .catch((err) => {
        if (!dialogVisible()) return;
        handleContextError(err, historyBody, TEXT.casesErrorLoad);
      });
  }

  // -- پیوست‌های پرونده -------------------------------------------------------
  const attBody = document.getElementById('oa-pa-task-attachments-body');
  if (attBody) {
    attBody.textContent = '';
    attBody.appendChild(ce('div', 'oa-pa-dialog-note', TEXT.attachmentsLoading));
    fetchInstanceAttachments(currentInstanceId)
      .then((files) => {
        if (!dialogVisible()) return;
        paintInstanceAttachments(attBody, files);
      })
      .catch((err) => {
        if (!dialogVisible()) return;
        handleContextError(err, attBody, TEXT.attachmentsErrorLoad);
      });
  }
}

function handleContextError(err, bodyEl, message) {
  if (
    err instanceof ApiError &&
    (err.status === 401 || err.kind === 'no-session')
  ) {
    // A dead session is a dialog-level problem — hand it to main.js.
    if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
    renderExpired();
    return;
  }
  console.warn(
    '[OA Process Activation] instance context failed:',
    err instanceof ApiError ? err.message : err
  );
  bodyEl.textContent = '';
  bodyEl.appendChild(ce('div', 'oa-pa-error', message));
}

/* ============================== Rendering =================================== */

function needsClaimState(t) {
  return !!(
    t &&
    t.selfService &&
    t.position &&
    t.position.id &&
    !(t.assignee && t.assignee.id)
  );
}

function taskFields(t) {
  return t && t.form && Array.isArray(t.form.fields) ? t.form.fields : [];
}

function assignmentLabel(t) {
  const assignee = t.assignee || null;
  const position = t.position || null;
  if (assignee && assignee.name) {
    return TEXT.assignDirect + ' — ' + assignee.name;
  }
  if (position && position.name) {
    return TEXT.assignPosition + ' — ' + position.name;
  }
  return TEXT.dash;
}

function setSubtitle(text) {
  const el = document.getElementById('oa-pa-task-subtitle');
  if (el) el.textContent = text || '';
}

function metaChip(label, value) {
  const chip = ce('span', 'oa-pa-meta-chip');
  chip.appendChild(ce('b', null, label + ':'));
  chip.appendChild(document.createTextNode(' ' + value));
  return chip;
}

function renderMeta(t) {
  const meta = document.getElementById('oa-pa-task-meta');
  if (!meta) return;
  meta.textContent = '';
  const proc = ((t.processInstance || {}).process || {}).name;
  const form = (t.form || {}).name;
  meta.append(
    metaChip(TEXT.metaProcess, proc ? String(proc) : TEXT.dash),
    metaChip(TEXT.metaForm, form ? String(form) : TEXT.dash),
    metaChip(TEXT.metaAssignment, assignmentLabel(t)),
    metaChip(TEXT.metaDate, t.createdAt ? formatFaDate(t.createdAt) : TEXT.dash)
  );
}

function hideDesc() {
  const el = document.getElementById('oa-pa-task-desc');
  if (el) el.classList.add('oa-pa-hidden');
}

function renderDesc(t) {
  const el = document.getElementById('oa-pa-task-desc');
  if (!el) return;
  if (t.description) {
    el.textContent = String(t.description);
    el.classList.remove('oa-pa-hidden');
  } else {
    hideDesc();
  }
}

function showContentState(kind) {
  const content = contentEl();
  if (!content) return;
  content.textContent = '';
  fieldControls = [];
  if (kind === 'loading') {
    const note = ce('div', 'oa-pa-dialog-note');
    note.append(ce('span', 'oa-pa-spinner'), document.createTextNode(TEXT.taskLoading));
    content.appendChild(note);
  }
}

function renderLoadError() {
  const content = contentEl();
  if (!content) return;
  content.textContent = '';
  const box = ce('div', 'oa-pa-error');
  box.textContent = TEXT.taskErrorLoad;
  const actions = ce('div', 'oa-pa-msg-actions');
  const retry = ce('button', 'oa-pa-msg-btn', TEXT.retry);
  retry.type = 'button';
  retry.addEventListener('click', () => {
    if (!currentTaskId) return;
    showContentState('loading');
    loadDetail(currentTaskId);
  });
  actions.appendChild(retry);
  box.appendChild(actions);
  content.appendChild(box);
}

function renderExpired() {
  const content = contentEl();
  if (!content) return;
  content.textContent = '';
  fieldControls = [];
  const box = ce('div', 'oa-pa-error');
  box.textContent = TEXT.sessionExpired;
  const actions = ce('div', 'oa-pa-msg-actions');
  const loginBtn = ce('button', 'oa-pa-msg-btn', TEXT.loginAgain);
  loginBtn.type = 'button';
  loginBtn.addEventListener('click', () => {
    closeTaskDialog();
    if (typeof deps.onRelogin === 'function') deps.onRelogin();
  });
  actions.appendChild(loginBtn);
  box.appendChild(actions);
  content.appendChild(box);
}

function renderDetail() {
  if (!task || !contentEl()) return;
  claimNeeded = needsClaimState(task);
  setSubtitle(task.name || '');
  renderMeta(task);
  renderDesc(task);
  setPending(false); // resets label + claim-aware disabled state

  const content = contentEl();
  content.textContent = '';

  if (claimNeeded) {
    content.appendChild(buildClaimBox());
  } else if (task.selfService && task.assignee && task.assignee.id) {
    // freshly claimed (or previously claimed) self-service task
    content.appendChild(ce('div', 'oa-pa-claim-done', TEXT.taskClaimDone));
  }

  const fields = taskFields(task);
  if (fields.length) {
    const form = document.createElement('form');
    form.id = 'oa-pa-task-form';
    form.noValidate = true;
    form.appendChild(ce('p', 'oa-pa-hint', TEXT.taskDialogHint));
    fieldControls = fields.map((f) => renderField(f, form));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit();
    });
    // A hidden submit button guarantees Enter-to-submit in every browser.
    const hiddenSubmit = ce('button');
    hiddenSubmit.type = 'submit';
    hiddenSubmit.hidden = true;
    form.appendChild(hiddenSubmit);
    content.appendChild(form);
    const first = form.querySelector(
      'input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
    );
    if (first) first.focus();
  } else {
    fieldControls = [];
    content.appendChild(ce('p', 'oa-pa-dialog-note', TEXT.taskNoForm));
  }

  // v1.7 — «سوابق کارتابل» (open by default) + «پیوست‌های پرونده».
  content.appendChild(
    buildSection({
      id: 'oa-pa-task-history',
      bodyId: 'oa-pa-task-history-body',
      title: TEXT.historySectionTitle,
      hint: TEXT.historySectionHint,
      open: true,
    })
  );
  content.appendChild(
    buildSection({
      id: 'oa-pa-task-attachments',
      bodyId: 'oa-pa-task-attachments-body',
      title: TEXT.attachmentsSectionTitle,
      hint: TEXT.attachmentsSectionHint,
      open: false,
    })
  );
}

/**
 * A collapsible section («سوابق کارتابل» / «پیوست‌های پرونده») — the host
 * app's letter view shows the same kind of collapsible history panel.
 */
function buildSection(opts) {
  const sec = ce('div', 'oa-pa-section' + (opts.open ? ' oa-pa-section-open' : ''));
  sec.id = opts.id;

  const head = ce('button', 'oa-pa-section-head');
  head.type = 'button';
  if (opts.hint) head.title = opts.hint;
  const chevron = ce('span', 'oa-pa-section-chevron', '‹');
  head.append(chevron, ce('span', 'oa-pa-section-title', opts.title));
  head.addEventListener('click', () => {
    sec.classList.toggle('oa-pa-section-open');
  });

  const body = ce('div', 'oa-pa-section-body');
  body.id = opts.bodyId;

  sec.append(head, body);
  return sec;
}

/** Paints the سوابق کارتابل timeline table into its section body. */
function paintHistory(bodyEl, inst) {
  bodyEl.textContent = '';
  const tasks = Array.isArray(inst.tasks) ? inst.tasks : [];
  if (!tasks.length) {
    bodyEl.appendChild(ce('div', 'oa-pa-dialog-note', TEXT.stepsEmpty));
    return;
  }
  const table = document.createElement('table');
  table.className = 'oa-pa-steps-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    TEXT.casesColRow,
    TEXT.stepsColStep,
    TEXT.stepsColAssignee,
    TEXT.stepsColForm,
    TEXT.stepsColStatus,
    TEXT.stepsColCreatedAt,
    TEXT.stepsColCompletedAt,
  ].forEach((label) => {
    headRow.appendChild(ce('th', null, label));
  });
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  tasks.forEach((t, i) => {
    const row = document.createElement('tr');
    const assignee = (t.assignee || {}).name;
    const position = (t.position || {}).name;
    const responsible = assignee
      ? String(assignee)
      : position
        ? TEXT.assignPosition + ' — ' + String(position)
        : TEXT.dash;
    const form = (t.form || {}).name;
    row.append(
      ce('td', 'oa-pa-td-row', faNum(i + 1)),
      ce('td', 'oa-pa-step-name', String(t.name || TEXT.dash)),
      ce('td', null, responsible),
      ce('td', null, form ? String(form) : TEXT.dash),
      ce('td', null),
      ce('td', null, t.createdAt ? formatFaDate(t.createdAt) : TEXT.dash),
      ce('td', null, t.completedAt ? formatFaDate(t.completedAt) : TEXT.dash)
    );
    const statusTd = row.cells[4];
    statusTd.appendChild(
      ce('span', 'oa-pa-step-pill ' + stepPillClass(t.status), stepPillLabel(t.status))
    );
    tbody.appendChild(row);
  });
  table.append(thead, tbody);
  bodyEl.appendChild(table);
}

function stepPillLabel(status) {
  switch (String(status || '')) {
    case 'PENDING':
      return TEXT.stepPending;
    case 'COMPLETED':
      return TEXT.stepCompleted;
    case 'CANCELLED':
      return TEXT.stepCancelled;
    case 'SKIPPED':
      return TEXT.stepSkipped;
    default:
      return String(status || TEXT.dash);
  }
}

function stepPillClass(status) {
  switch (String(status || '')) {
    case 'PENDING':
      return 'oa-pa-step-pending';
    case 'COMPLETED':
      return 'oa-pa-step-completed';
    default:
      return 'oa-pa-step-muted';
  }
}

/** Paints the پیوست‌های پرونده list into its section body. */
function paintInstanceAttachments(bodyEl, files) {
  bodyEl.textContent = '';
  if (!files || !files.length) {
    bodyEl.appendChild(ce('div', 'oa-pa-dialog-note', TEXT.attachmentsEmpty));
    return;
  }
  const list = ce('div', 'oa-pa-attachment-list');
  files.forEach((f) => {
    const row = ce('div', 'oa-pa-attachment-row');
    const dl = ce('button', 'oa-pa-attachment-name');
    dl.type = 'button';
    dl.title = TEXT.fileDownload;
    dl.appendChild(document.createTextNode(String(f.originalName || f.name || '')));
    dl.addEventListener('click', async () => {
      try {
        await downloadAttachment(f.id, f.originalName || f.name);
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.kind === 'no-session')
        ) {
          if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
          renderExpired();
          return;
        }
        showError(TEXT.fileDownloadError);
        console.warn(
          '[OA Process Activation] attachment download failed:',
          err instanceof ApiError ? err.message : err
        );
      }
    });
    const meta = ce('span', 'oa-pa-attachment-meta');
    meta.append(
      document.createTextNode(formatBytes(f.size)),
      ce('span', 'oa-pa-attachment-dot', '·'),
      document.createTextNode(
        (f.submittedBy && f.submittedBy.name)
          ? TEXT.attachmentUploadedBy(String(f.submittedBy.name))
          : TEXT.dash
      ),
      ce('span', 'oa-pa-attachment-dot', '·'),
      document.createTextNode(f.createdAt ? formatFaDate(f.createdAt) : TEXT.dash)
    );
    row.append(dl, meta);
    list.appendChild(row);
  });
  bodyEl.appendChild(list);
}

function buildClaimBox() {
  const wrap = ce('div');
  const note = ce('div', 'oa-pa-claim-note', TEXT.taskClaimNote);
  const btn = ce('button', 'oa-pa-btn-claim', TEXT.taskClaimBtn);
  btn.type = 'button';
  btn.id = 'oa-pa-task-claim';
  btn.addEventListener('click', () => doClaim());
  wrap.append(note, btn);
  return wrap;
}

/* ============================ Form rendering ================================ */

function instanceVars() {
  return (task && task.instanceVariables) || {};
}

/* ===================== v1.7 — «file» form fields =========================== */

/** Normalizes an instanceVariables value ({meta}|{meta}[] metas) to an array. */
function normalizeFileMetas(value) {
  const arr = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of arr) {
    if (v && typeof v === 'object' && typeof v.id === 'string') {
      out.push({
        id: v.id,
        name: String(v.name || v.id),
        size: Number(v.size) || 0,
        mimeType: String(v.mimeType || ''),
      });
    }
  }
  return out;
}

/**
 * Renders a FormFieldDto of type "file".
 *   editable → styled picker (multiple per field.multiple) + chips list;
 *              selected files are uploaded on submit (uploadFile) and the
 *              meta array becomes the field value in the completion data.
 *   readOnly → metas from instanceVariables (uploaded in PREVIOUS steps of
 *              this instance), rendered as authenticated download links.
 */
function renderFileField(field, form) {
  const readOnly = !!field.readOnly;

  const row = ce('div', 'oa-pa-field-row');
  if (field.name) row.setAttribute('data-field-name', String(field.name));

  // -- label line (same structure as the other field types) -------------------
  const labelLine = ce('div', 'oa-pa-field-label-line');
  labelLine.appendChild(
    ce('span', 'oa-pa-field-label', String(field.label || field.name || ''))
  );
  if (field.required) labelLine.appendChild(ce('span', 'oa-pa-req', '*'));
  if (readOnly) labelLine.appendChild(ce('span', 'oa-pa-ro-chip', TEXT.readOnlyChip));
  row.appendChild(labelLine);

  const iv = instanceVars();
  const varKey = field.variable || field.name;
  let metas = [];
  if (readOnly && iv[varKey] !== undefined && iv[varKey] !== null) {
    metas = normalizeFileMetas(iv[varKey]);
  }

  const ctrl = {
    field: field,
    type: 'file',
    control: null,
    readOnly: readOnly,
    files: [], // editable: the picked File objects
    metas: metas, // readOnly: metas from previous steps
    chipsEl: null,
    focus: () => {
      if (ctrl.control && ctrl.control.focus) ctrl.control.focus();
    },
  };

  if (readOnly) {
    const links = ce('div', 'oa-pa-file-links');
    row.appendChild(links);
    ctrl.control = links;
    paintFileLinks(ctrl);
  } else {
    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'oa-pa-input oa-pa-file-input';
    if (field.multiple) {
      input.multiple = true;
      row.appendChild(ce('div', 'oa-pa-file-hint', TEXT.fileFieldMultipleHint(faNum(API.maxFileSizeMb))));
    }
    const chips = ce('div', 'oa-pa-file-chips');
    row.append(input, chips);
    ctrl.control = input;
    ctrl.chipsEl = chips;
    input.addEventListener('change', () => {
      // input.files is a live FileList — snapshot it, then reset the input so
      // the SAME file can be picked again later (it would be ignored).
      const picked = Array.prototype.slice.call(input.files || []);
      input.value = '';
      addFilesToControl(ctrl, picked);
    });
  }

  form.appendChild(row);
  fieldControls.push(ctrl);
  return ctrl;
}

/** Adds picked files (size-checked, de-duplicated) + repaints the chips. */
function addFilesToControl(ctrl, picked) {
  let rejected = null;
  for (const f of picked) {
    if (f.size > API.maxFileSizeBytes) {
      rejected = f;
      continue;
    }
    const dup = ctrl.files.some((x) => x.name === f.name && x.size === f.size);
    if (!dup) ctrl.files.push(f);
  }
  paintFileChips(ctrl);
  if (rejected) {
    showError(TEXT.fileFieldTooLarge(rejected.name, faNum(API.maxFileSizeMb)));
  }
}

/** The selected-file chips: «name — size ×» with a remove button each. */
function paintFileChips(ctrl) {
  const chips = ctrl.chipsEl;
  if (!chips) return;
  chips.textContent = '';
  ctrl.files.forEach((f, idx) => {
    const chip = ce('span', 'oa-pa-file-chip');
    chip.appendChild(ce('span', 'oa-pa-file-chip-name', f.name));
    chip.appendChild(ce('span', 'oa-pa-file-chip-size', formatBytes(f.size)));
    const rm = ce('button', 'oa-pa-file-chip-remove', '×');
    rm.type = 'button';
    rm.title = TEXT.fileRemove;
    rm.addEventListener('click', () => {
      ctrl.files.splice(idx, 1);
      paintFileChips(ctrl);
    });
    chip.appendChild(rm);
    chips.appendChild(chip);
  });
}

/** Read-only metas → download-link buttons (GET /api/files/:id, JWT'd). */
function paintFileLinks(ctrl) {
  const wrap = ctrl.control;
  if (!wrap) return;
  wrap.textContent = '';
  if (!ctrl.metas.length) {
    wrap.appendChild(ce('div', 'oa-pa-file-none', TEXT.fileFieldNone));
    return;
  }
  ctrl.metas.forEach((m) => {
    const link = ce('button', 'oa-pa-file-link');
    link.type = 'button';
    link.title = TEXT.fileDownload;
    link.appendChild(ce('span', 'oa-pa-file-link-name', m.name));
    link.appendChild(ce('span', 'oa-pa-file-link-size', formatBytes(m.size)));
    link.addEventListener('click', async () => {
      try {
        await downloadAttachment(m.id, m.name);
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.kind === 'no-session')
        ) {
          if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
          renderExpired();
          return;
        }
        showError(TEXT.fileDownloadError);
        console.warn(
          '[OA Process Activation] attachment download failed:',
          err instanceof ApiError ? err.message : err
        );
      }
    });
    wrap.appendChild(link);
  });
}

/**
 * Renders one FormFieldDto into the form. Returns a controller record kept
 * in fieldControls for validation + value collection.
 */
function renderField(field, form) {
  const type = String((field && field.type) || 'text').toLowerCase();
  // v1.7 — «file» fields get their own renderer (picker + chips, or
  // read-only download links pre-filled from instanceVariables).
  if (type === 'file') {
    return renderFileField(field, form);
  }
  const supported = [
    'text',
    'textarea',
    'number',
    'date',
    'select',
    'radio',
    'checkbox',
  ].includes(type);
  const readOnly = !!field.readOnly || !supported;

  // Prefill: read-only fields take process instance variables (data filled
  // in previous tasks); editable fields take defaultValue.
  const iv = instanceVars();
  const varKey = field.variable || field.name;
  let prefill = '';
  if (field.readOnly && iv[varKey] !== undefined && iv[varKey] !== null) {
    prefill = String(iv[varKey]);
  } else if (field.defaultValue !== undefined && field.defaultValue !== null) {
    prefill = String(field.defaultValue);
  }

  const row = ce('div', 'oa-pa-field-row');
  if (field.name) row.setAttribute('data-field-name', String(field.name));
  if (!supported) row.classList.add('oa-pa-field-unsupported');

  // -- label line --------------------------------------------------------------
  const labelLine = ce('div', 'oa-pa-field-label-line');
  labelLine.appendChild(
    ce('span', 'oa-pa-field-label', String(field.label || field.name || ''))
  );
  if (field.required) labelLine.appendChild(ce('span', 'oa-pa-req', '*'));
  if (readOnly) labelLine.appendChild(ce('span', 'oa-pa-ro-chip', TEXT.readOnlyChip));
  row.appendChild(labelLine);

  // -- control -------------------------------------------------------------------
  let control;
  if (type === 'textarea') {
    control = document.createElement('textarea');
    control.className = 'oa-pa-input oa-pa-textarea';
    control.rows = 3;
    control.dir = 'auto';
    control.value = prefill;
    if (field.placeholder) control.placeholder = String(field.placeholder);
  } else if (type === 'number') {
    control = document.createElement('input');
    control.type = 'number';
    control.className = 'oa-pa-input';
    control.dir = 'ltr';
    control.value = prefill;
    if (field.placeholder) control.placeholder = String(field.placeholder);
  } else if (type === 'date') {
    control = document.createElement('input');
    control.type = 'date';
    control.className = 'oa-pa-input';
    control.dir = 'ltr';
    control.value = prefill;
  } else if (type === 'select') {
    control = document.createElement('select');
    control.className = 'oa-pa-input';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = TEXT.selectPlaceholder;
    control.appendChild(placeholder);
    (field.options || []).forEach((opt) => {
      const o = document.createElement('option');
      o.value = String(opt);
      o.textContent = String(opt);
      control.appendChild(o);
    });
    control.value = prefill; // no match → stays on the placeholder option
  } else if (type === 'radio') {
    control = ce('div', 'oa-pa-options');
    (field.options || []).forEach((opt) => {
      const lbl = ce('label', 'oa-pa-opt');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = String(field.name || 'field');
      input.value = String(opt);
      input.checked = prefill !== '' && prefill === String(opt);
      lbl.append(input, ce('span', null, String(opt)));
      control.appendChild(lbl);
    });
  } else if (type === 'checkbox') {
    control = document.createElement('input');
    control.type = 'checkbox';
    control.className = 'oa-pa-checkbox';
    control.checked = prefill === 'true' || prefill === true;
  } else {
    // 'text' plus any unsupported type → read-only-looking text input
    control = document.createElement('input');
    control.type = 'text';
    control.className = 'oa-pa-input';
    control.dir = 'auto';
    control.value = prefill;
    if (field.placeholder) control.placeholder = String(field.placeholder);
  }

  if (readOnly) {
    control.disabled = true;
    if (control.classList) control.classList.add('oa-pa-input-readonly');
  }
  row.appendChild(control);
  if (!supported) {
    row.appendChild(ce('div', 'oa-pa-unsupported-note', TEXT.unsupportedField));
  }
  form.appendChild(row);

  const ctrl = {
    field: field,
    type: type,
    control: control,
    readOnly: readOnly,
    focus: () => {
      let target = control;
      if (type === 'radio' && control.querySelector) {
        target = control.querySelector('input');
      }
      if (target && target.focus) target.focus();
    },
  };
  fieldControls.push(ctrl);
  return ctrl;
}

/* ========================== Validation + collect ============================ */

function fieldValue(ctrl) {
  const c = ctrl.control;
  if (ctrl.type === 'file') {
    return ctrl.readOnly ? ctrl.metas : ctrl.files;
  }
  if (ctrl.type === 'checkbox') return !!c.checked;
  if (ctrl.type === 'radio') {
    const checked = c.querySelector('input:checked');
    return checked ? checked.value : '';
  }
  return c.value == null ? '' : String(c.value);
}

function isEmptyValue(ctrl, v) {
  if (ctrl.type === 'file') {
    return ctrl.readOnly
      ? !(ctrl.metas && ctrl.metas.length)
      : !(ctrl.files && ctrl.files.length);
  }
  if (ctrl.type === 'checkbox') return v !== true;
  return String(v == null ? '' : v).trim() === '';
}

/** First invalid required control, or null. */
function validateFields() {
  for (const ctrl of fieldControls) {
    if (ctrl.readOnly || !ctrl.field.required) continue;
    if (isEmptyValue(ctrl, fieldValue(ctrl))) return ctrl;
  }
  return null;
}

/**
 * Collects the submitted values ({fieldName: value}). Empty optional values
 * are omitted; read-only values are re-sent only when actually present (so
 * an unavailable prefill never wipes the process variable). «file» fields:
 * read-only metas are re-sent as-is (keeps the engine variable); EDITABLE
 * file fields are uploaded in onSubmit() and their metas injected there.
 */
function collectValues() {
  const values = {};
  for (const ctrl of fieldControls) {
    const name = String(ctrl.field.name || '');
    if (!name) continue;
    if (ctrl.type === 'file') {
      if (ctrl.readOnly && ctrl.metas && ctrl.metas.length) {
        values[name] = ctrl.metas;
      }
      continue;
    }
    let v = fieldValue(ctrl);
    if (ctrl.type === 'number') {
      const s = String(v == null ? '' : v).trim();
      if (s === '') continue; // empty optional numbers are omitted
      const n = Number(s);
      v = Number.isNaN(n) ? s : n;
    } else if (ctrl.type !== 'checkbox') {
      v = String(v == null ? '' : v).trim();
    }
    if (v === '' || v == null) continue;
    values[name] = v;
  }
  return values;
}

/* ================================ Claim ===================================== */

async function doClaim() {
  if (claimInFlight || !task || submitting) return;
  claimInFlight = true;
  const btn = document.getElementById('oa-pa-task-claim');
  if (btn) {
    btn.disabled = true;
    btn.textContent = TEXT.taskClaimPending;
  }
  hideError();
  try {
    const claimed = await claimTask(task.id);
    console.log('[OA Process Activation] task claimed:', {
      taskId: claimed.id,
      name: claimed.name,
    });
    if (!isCurrent(claimed.id)) return;
    task = claimed;
    renderDetail(); // claimNeeded now false → submit enabled
    loadInstanceContext(); // re-fetch سوابق کارتابل + پیوست‌های پرونده for the rebuilt sections
  } catch (err) {
    if (!dialogVisible()) return;
    console.warn(
      '[OA Process Activation] claim failed:',
      err instanceof ApiError ? err.message : err
    );
    if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
      if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
      renderExpired();
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      outcome = 'conflict'; // claimed by someone else first
      showError(TEXT.taskConflict);
    } else {
      showError(
        err instanceof ApiError && err.status === 0 ? TEXT.errorNetwork : TEXT.taskErrorSubmit
      );
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = TEXT.taskClaimBtn;
    }
  } finally {
    claimInFlight = false;
  }
}

/* ================================ Submit ==================================== */

async function onSubmit() {
  if (!task || submitting || claimNeeded) return;
  hideError();
  hideSuccess();

  const bad = validateFields();
  if (bad) {
    const label = bad.field.label || bad.field.name || '';
    showError(
      bad.type === 'file' ? TEXT.fileFieldRequired(label) : TEXT.errorFieldRequired(label)
    );
    bad.focus();
    return;
  }

  setPending(true);
  const values = collectValues();
  let uploadedCount = 0;

  // v1.7 — upload the picked attachments FIRST (POST /api/files → metas),
  // then store each meta array as its field's value in the completion data.
  const uploadControls = fieldControls.filter(
    (c) => c.type === 'file' && !c.readOnly && c.files && c.files.length
  );
  if (uploadControls.length) {
    setPendingLabel(TEXT.fileUploadPending);
    try {
      for (const ctrl of uploadControls) {
        const metas = [];
        for (const f of ctrl.files) {
          const meta = await uploadFile(f);
          metas.push(meta);
          uploadedCount += 1;
        }
        values[String(ctrl.field.name || '')] = metas;
      }
    } catch (err) {
      setPending(false);
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.kind === 'no-session')
      ) {
        if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
        renderExpired();
        return;
      }
      showError(
        err instanceof ApiError && err.status === 0 ? TEXT.errorNetwork : TEXT.fileUploadError
      );
      console.warn(
        '[OA Process Activation] attachment upload failed:',
        err instanceof ApiError ? err.message : err
      );
      return; // the completion was NOT sent — the user can retry
    }
    setPendingLabel(TEXT.taskSubmitPending);
  }

  try {
    const formId = task.form && task.form.id ? task.form.id : undefined;
    const completed = await completeTask(task.id, values, formId);
    console.log(
      '[OA Process Activation] task completed — submitted to the flow; the engine creates the next user task:',
      {
        taskId: task.id,
        name: task.name,
        status: completed && completed.status,
        completedAt: (completed && completed.completedAt) || null,
        attachmentsUploaded: uploadedCount,
      }
    );
    outcome = 'completed';
    showSuccess();
    setDone();
    lockFormControls();
    closeDialogSoon(1800);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
      setPending(false);
      if (typeof deps.onSessionExpired === 'function') deps.onSessionExpired();
      renderExpired();
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      outcome = 'conflict'; // someone else completed/claimed it first
      showError(TEXT.taskConflict);
    } else {
      showError(
        err instanceof ApiError && err.status === 0 ? TEXT.errorNetwork : TEXT.taskErrorSubmit
      );
    }
    setPending(false);
    console.warn(
      '[OA Process Activation] task submit failed:',
      err instanceof ApiError ? err.message : err
    );
  }
}

/* ============================ UI state helpers =============================== */

function setPendingLabel(text) {
  const s = document.getElementById('oa-pa-task-submit');
  if (s) s.textContent = text;
}

function setPending(p) {
  submitting = p;
  const s = document.getElementById('oa-pa-task-submit');
  const c = document.getElementById('oa-pa-task-cancel');
  if (s) {
    s.disabled = p || claimNeeded;
    s.textContent = p ? TEXT.taskSubmitPending : TEXT.taskSubmit;
  }
  if (c) c.disabled = p;
}

function setDone() {
  const s = document.getElementById('oa-pa-task-submit');
  const c = document.getElementById('oa-pa-task-cancel');
  const claim = document.getElementById('oa-pa-task-claim');
  if (s) {
    s.disabled = true;
    s.textContent = TEXT.taskSubmit;
  }
  if (c) c.disabled = true;
  if (claim) claim.disabled = true;
}

function lockFormControls() {
  for (const ctrl of fieldControls) {
    const c = ctrl.control;
    if (c && typeof c.querySelectorAll === 'function') {
      c.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = true;
      });
    }
    if (c) c.disabled = true;
  }
}

function showError(text) {
  const el = document.getElementById('oa-pa-task-error');
  if (el) {
    el.textContent = text;
    el.classList.remove('oa-pa-hidden');
  }
}

function hideError() {
  const el = document.getElementById('oa-pa-task-error');
  if (el) el.classList.add('oa-pa-hidden');
}

function showSuccess() {
  const el = document.getElementById('oa-pa-task-success');
  if (el) el.classList.remove('oa-pa-hidden');
}

function hideSuccess() {
  const el = document.getElementById('oa-pa-task-success');
  if (el) el.classList.add('oa-pa-hidden');
}

/* ================================ Public ==================================== */

/** Stores the injected callbacks (called from main.js → injectAll). */
export function injectTaskDialog(d) {
  if (!d) return;
  if (typeof d.onCompleted === 'function') deps.onCompleted = d.onCompleted;
  if (typeof d.onSessionExpired === 'function') deps.onSessionExpired = d.onSessionExpired;
  if (typeof d.onRelogin === 'function') deps.onRelogin = d.onRelogin;
}

/** Cleanup for full deactivation (main.js → removeAll). */
export function disposeTaskDialog() {
  clearTimeout(closeTimer);
  closeTimer = null;
  submitting = false;
  claimInFlight = false;
  claimNeeded = false;
  task = null;
  currentTaskId = null;
  currentInstanceId = null;
  fieldControls = [];
  outcome = null;
  const ov = overlayEl();
  if (ov) ov.remove();
}
