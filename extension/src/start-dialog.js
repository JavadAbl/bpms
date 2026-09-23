/**
 * start-dialog.js — the «شروع پرونده جدید» dialog (v1.9 draft-first).
 * --------------------------------------------------------
 * Opened from the header «جریان کار جدید» button. Shows ACTIVE BPMS
 * processes; confirming creates a ProcessDraft (POST /api/process-drafts)
 * and opens the draft form — the BPMN instance starts only on form submit.
 */

import { IDS, TEXT } from './config.js';
import { getAuthSession, ApiError } from './api.js';
import { fetchActiveProcesses } from './processes.js';
import { createDraft } from './drafts.js';
import { ce } from './utils.js';

const deps = {
  onSessionExpired: null, // full cleanup (main.js)
  onRelogin: null, // open the login modal
  onDraftCreated: null, // open draft form dialog after create
};

let escWired = false;
let starting = false;
let processes = []; // ACTIVE processes, loaded on open
let selectedId = null;
let search = '';

/* ============================== Build ===================================== */

function overlayEl() {
  return document.getElementById(IDS.startOverlay);
}

function dialogVisible() {
  const ov = overlayEl();
  return !!ov && !ov.classList.contains('oa-pa-hidden');
}

function buildOnce() {
  if (overlayEl() || !document.body) return;
  const overlay = ce('div');
  overlay.id = IDS.startOverlay;
  overlay.className = 'oa-pa-hidden';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeStartDialog();
  });

  const dialog = ce('div');
  dialog.id = IDS.startDialog;
  dialog.dir = 'rtl';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'oa-pa-start-title-el');

  // -- header ----------------------------------------------------------------
  const head = ce('div', 'oa-pa-modal-header');
  const title = ce('div', 'oa-pa-modal-title', TEXT.startDialogTitle);
  title.id = 'oa-pa-start-title-el';
  const closeBtn = ce('button', 'oa-pa-close', '\u00D7');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', TEXT.closeAria);
  closeBtn.addEventListener('click', () => closeStartDialog());
  head.append(title, closeBtn);

  // -- body --------------------------------------------------------------------
  const body = ce('div', 'oa-pa-task-body');
  const hint = ce('p', 'oa-pa-hint', TEXT.startDialogHint);
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'oa-pa-grid-search';
  search.id = 'oa-pa-start-search';
  search.placeholder = TEXT.startSearchPh;
  search.setAttribute('aria-label', TEXT.startSearchPh);
  search.addEventListener('input', () => {
    clearTimeout(search._t);
    search._t = setTimeout(() => {
      search = search.value.trim();
      renderList();
    }, 300);
  });
  const list = ce('div', 'oa-pa-start-list');
  list.id = 'oa-pa-start-list';
  const message = ce('div', 'oa-pa-grid-message oa-pa-hidden');
  message.id = 'oa-pa-start-message';
  const errBox = ce('div', 'oa-pa-error oa-pa-hidden');
  errBox.id = 'oa-pa-start-error';
  body.append(hint, search, message, list, errBox);

  // -- footer --------------------------------------------------------------------
  const foot = ce('div', 'oa-pa-modal-footer');
  const cancelBtn = ce('button', 'oa-pa-btn-secondary', TEXT.cancel);
  cancelBtn.type = 'button';
  cancelBtn.id = 'oa-pa-start-cancel';
  cancelBtn.addEventListener('click', () => closeStartDialog());
  const startBtn = ce('button', 'oa-pa-btn-primary', TEXT.startBtn);
  startBtn.type = 'button';
  startBtn.id = 'oa-pa-start-btn';
  startBtn.disabled = true;
  startBtn.addEventListener('click', () => onStart());
  foot.append(cancelBtn, startBtn);

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
      closeStartDialog();
    }
  });
}

/* ============================== Open / close =============================== */

/** Opens the dialog and (re)loads the ACTIVE processes. */
export function openStartDialog() {
  if (!getAuthSession()) return;
  buildOnce();
  const ov = overlayEl();
  if (!ov) return;

  starting = false;
  processes = [];
  selectedId = null;
  search = '';

  hideError();
  setPending(false);
  const searchInput = document.getElementById('oa-pa-start-search');
  if (searchInput) searchInput.value = '';
  const list = document.getElementById('oa-pa-start-list');
  if (list) list.textContent = '';
  const startBtn = document.getElementById('oa-pa-start-btn');
  if (startBtn) startBtn.disabled = true;

  ov.classList.remove('oa-pa-hidden');
  if (searchInput) searchInput.focus();
  loadProcesses();
}

/**
 * Closes the dialog. Blocked only while a start request is in flight
 * (so a double-Esc cannot orphan a starting request) — after success the
 * auto-close is imminent anyway.
 */
export function closeStartDialog() {
  if (starting) return;
  const ov = overlayEl();
  if (ov) ov.classList.add('oa-pa-hidden');
  processes = [];
  selectedId = null;
  search = '';
}

/* ============================== States ===================================== */

function showMessage(kind, err) {
  const message = document.getElementById('oa-pa-start-message');
  const list = document.getElementById('oa-pa-start-list');
  if (!message) return;
  message.classList.remove('oa-pa-hidden');
  message.classList.remove('oa-pa-msg-error');
  message.textContent = '';
  if (list) list.classList.add('oa-pa-hidden');

  if (kind === 'loading') {
    const spinner = ce('span', 'oa-pa-spinner');
    message.append(spinner, document.createTextNode(TEXT.startLoading));
  } else if (kind === 'empty') {
    message.textContent = TEXT.startEmpty;
  } else if (kind === 'noresult') {
    message.textContent = TEXT.startNoResult;
  } else if (kind === 'error') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.startErrorLoad;
    const actions = ce('div', 'oa-pa-msg-actions');
    const retry = ce('button', 'oa-pa-msg-btn', TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => loadProcesses());
    actions.appendChild(retry);
    message.appendChild(actions);
    if (err) {
      console.warn('[OA Process Activation] start dialog error:', err.message);
    }
  } else if (kind === 'expired') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.sessionExpired;
    const actions = ce('div', 'oa-pa-msg-actions');
    const loginBtn = ce('button', 'oa-pa-msg-btn', TEXT.loginAgain);
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', () => {
      if (deps.onRelogin) deps.onRelogin();
    });
    actions.appendChild(loginBtn);
    message.appendChild(actions);
  }
}

function hideMessage() {
  const message = document.getElementById('oa-pa-start-message');
  const list = document.getElementById('oa-pa-start-list');
  if (message) {
    message.classList.add('oa-pa-hidden');
    message.classList.remove('oa-pa-msg-error');
    message.textContent = '';
  }
  if (list) list.classList.remove('oa-pa-hidden');
}

function showError(text) {
  const errBox = document.getElementById('oa-pa-start-error');
  if (errBox) {
    errBox.textContent = text;
    errBox.classList.remove('oa-pa-hidden');
  }
}

function hideError() {
  const errBox = document.getElementById('oa-pa-start-error');
  if (errBox) errBox.classList.add('oa-pa-hidden');
}

function setPending(pending) {
  const startBtn = document.getElementById('oa-pa-start-btn');
  const cancelBtn = document.getElementById('oa-pa-start-cancel');
  if (startBtn) {
    startBtn.disabled = pending || !selectedId;
    startBtn.textContent = pending ? TEXT.startPending : TEXT.startBtn;
  }
  if (cancelBtn) cancelBtn.disabled = pending;
}

/* ============================== Rendering ================================== */

function filteredProcesses() {
  if (!search) return processes;
  const q = search.toLowerCase();
  return processes.filter((p) => {
    const hay = [p.name, p.description].map((x) => String(x || '').toLowerCase());
    return hay.some((h) => h.includes(q));
  });
}

function renderList() {
  const list = document.getElementById('oa-pa-start-list');
  if (!list) return;
  list.textContent = '';

  const rows = filteredProcesses();
  if (!rows.length) {
    showMessage('noresult');
    return;
  }
  hideMessage();

  rows.forEach((p) => {
    const row = ce('div', 'oa-pa-start-row');
    row.setAttribute('data-process-id', String(p.id || ''));
    row.tabIndex = 0;
    if (selectedId === String(p.id)) row.classList.add('oa-pa-start-selected');

    const main = ce('div', 'oa-pa-start-row-main');
    main.appendChild(ce('div', 'oa-pa-start-row-name', String(p.name || TEXT.dash)));
    if (p.description) {
      main.appendChild(ce('div', 'oa-pa-start-row-desc', String(p.description)));
    }
    const side = ce('div', 'oa-pa-start-row-side');
    side.appendChild(ce('span', 'oa-pa-steps-chip', TEXT.startVersion(String(p.version || 1))));
    row.append(main, side);

    row.addEventListener('click', () => selectProcess(String(p.id)));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        selectProcess(String(p.id));
      }
    });
    list.appendChild(row);
  });
}

function selectProcess(id) {
  selectedId = id;
  const list = document.getElementById('oa-pa-start-list');
  if (list) {
    list.querySelectorAll('.oa-pa-start-row').forEach((r) => {
      const mine = r.getAttribute('data-process-id') === id;
      r.classList.toggle('oa-pa-start-selected', mine);
    });
  }
  const startBtn = document.getElementById('oa-pa-start-btn');
  if (startBtn && !starting) startBtn.disabled = false;
}

/* ============================== Data loading ================================ */

async function loadProcesses() {
  showMessage('loading');
  try {
    const items = await fetchActiveProcesses();
    if (!dialogVisible()) return; // closed meanwhile
    processes = items;
    if (!processes.length) {
      showMessage('empty');
      return;
    }
    renderList();
  } catch (err) {
    if (!dialogVisible()) return;
    if (
      err instanceof ApiError &&
      (err.status === 401 || err.kind === 'no-session')
    ) {
      if (deps.onSessionExpired) deps.onSessionExpired();
      showMessage('expired');
      return;
    }
    showMessage('error', err);
  }
}

/* ============================== Start action ================================ */

function apiErrorToFaText(err) {
  if (!err) return TEXT.startErrorUnexpected('');
  if (err.status === 0) return TEXT.errorNetwork;
  if (err.status === 400) return TEXT.startErrorNotActive;
  if (err.status === 403) return TEXT.startErrorForbidden;
  return TEXT.startErrorUnexpected(err.status);
}

async function onStart() {
  if (!selectedId || starting) return;
  const selected = processes.find((p) => String(p.id) === selectedId);
  setPending(true);
  starting = true;
  hideError();
  try {
    const draft = await createDraft(selectedId);
    console.log('[OA Process Activation] draft created:', {
      draftId: draft.id,
      process: (selected && selected.name) || '',
    });
    const okBox = document.getElementById('oa-pa-start-error');
    if (okBox) {
      okBox.textContent = TEXT.startSuccess((selected && selected.name) || '');
      okBox.classList.add('oa-pa-success');
      okBox.classList.remove('oa-pa-error', 'oa-pa-hidden');
    }
    starting = false;
    closeStartDialog();
    if (deps.onDraftCreated) deps.onDraftCreated(draft);
  } catch (err) {
    starting = false;
    if (
      err instanceof ApiError &&
      (err.status === 401 || err.kind === 'no-session')
    ) {
      if (deps.onSessionExpired) deps.onSessionExpired();
      closeStartDialog();
      return;
    }
    showError(apiErrorToFaText(err));
    setPending(false);
  }
}

/* ================================ Public ==================================== */

/** Stores the injected callbacks (called from main.js → injectAll). */
export function injectStartDialog(depsIn) {
  if (depsIn) {
    if (typeof depsIn.onSessionExpired === 'function') {
      deps.onSessionExpired = depsIn.onSessionExpired;
    }
    if (typeof depsIn.onRelogin === 'function') deps.onRelogin = depsIn.onRelogin;
    if (typeof depsIn.onDraftCreated === 'function') {
      deps.onDraftCreated = depsIn.onDraftCreated;
    }
  }
}

/** Cleanup for full deactivation (main.js → removeAll). */
export function disposeStartDialog() {
  const ov = overlayEl();
  if (ov) ov.remove();
  processes = [];
  selectedId = null;
  search = '';
  starting = false;
}
