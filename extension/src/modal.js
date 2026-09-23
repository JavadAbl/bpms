/**
 * modal.js — the RTL Persian login modal.
 * -----------------------------------------
 * Builds and injects a fully self-contained dialog (Enter submits,
 * Esc / × / انصراف / clicking the backdrop closes it). The username is
 * prefilled from the last remembered one, and a green note shows when an
 * active session already exists.
 *
 * Submit flow: POST /api/auth/login (api.js) → the response is stored in
 * sessionStorage by api.js → the button state syncs (via the injected
 * onSaved callback — no circular imports).
 */

import { IDS, TEXT, USERNAME_REGEX } from './config.js';
import { login, getAuthSession, ApiError } from './api.js';
import { saveRememberedUsername, loadRememberedUsername } from './storage.js';
import { ce, maskToken } from './utils.js';

let onSavedCallback = null;
let escWired = false;
let closeTimer = null;

/* ============================== Build ==================================== */

function buildModal() {
  const modal = document.createElement('div');
  modal.id = IDS.modal;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'oa-pa-modal-title-el');
  modal.dir = 'rtl';

  // -- header --------------------------------------------------------------
  const head = ce('div', 'oa-pa-modal-header');
  const title = ce('div', 'oa-pa-modal-title', TEXT.modalTitle);
  title.id = 'oa-pa-modal-title-el';
  const closeBtn = ce('button', 'oa-pa-close', '\u00D7');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', TEXT.closeAria);
  closeBtn.addEventListener('click', closeModal);
  head.append(title, closeBtn);

  // -- body ------------------------------------------------------------------
  const body = ce('div', 'oa-pa-modal-body');

  body.appendChild(ce('p', 'oa-pa-hint', TEXT.hint));

  const sessionNote = ce('div', 'oa-pa-saved-note oa-pa-hidden');
  sessionNote.id = 'oa-pa-session-note';
  body.appendChild(sessionNote);

  const form = document.createElement('form');
  form.id = 'oa-pa-form';
  form.noValidate = true;

  const eLabel = ce('label', 'oa-pa-label', TEXT.usernameLabel);
  eLabel.htmlFor = 'oa-pa-username';
  const eInput = document.createElement('input');
  eInput.id = 'oa-pa-username';
  eInput.type = 'text';
  eInput.className = 'oa-pa-input';
  eInput.autocomplete = 'username';
  eInput.spellcheck = false;
  eInput.dir = 'ltr';
  eInput.placeholder = TEXT.usernamePh;

  const pLabel = ce('label', 'oa-pa-label', TEXT.passwordLabel);
  pLabel.htmlFor = 'oa-pa-password';
  const pInput = document.createElement('input');
  pInput.id = 'oa-pa-password';
  pInput.type = 'password';
  pInput.className = 'oa-pa-input';
  pInput.autocomplete = 'new-password';
  pInput.dir = 'ltr';
  pInput.placeholder = TEXT.passwordPh;

  form.append(eLabel, eInput, pLabel, pInput);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit();
  });
  body.appendChild(form);

  const errBox = ce('div', 'oa-pa-error oa-pa-hidden');
  errBox.id = 'oa-pa-error';
  const okBox = ce('div', 'oa-pa-success oa-pa-hidden');
  okBox.id = 'oa-pa-success';
  okBox.textContent = TEXT.success;
  body.append(errBox, okBox, ce('div', 'oa-pa-storage-note', TEXT.storageNote));

  // -- footer ----------------------------------------------------------------
  const foot = ce('div', 'oa-pa-modal-footer');
  const cancelBtn = ce('button', 'oa-pa-btn-secondary', TEXT.cancel);
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);
  const loginBtn = ce('button', 'oa-pa-btn-primary', TEXT.save);
  loginBtn.type = 'submit';
  loginBtn.id = 'oa-pa-save-btn';
  loginBtn.setAttribute('form', 'oa-pa-form');
  foot.append(cancelBtn, loginBtn);

  modal.append(head, body, foot);
  return modal;
}

/**
 * Injects the (hidden) modal overlay once.
 * `deps.onSaved` — called after a successful login (button state sync),
 * injected by main.js.
 */
export function injectModal(deps) {
  if (!document.body) return;
  if (deps && typeof deps.onSaved === 'function') onSavedCallback = deps.onSaved;
  if (document.getElementById(IDS.overlay)) return;
  const overlay = document.createElement('div');
  overlay.id = IDS.overlay;
  overlay.className = 'oa-pa-hidden';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.appendChild(buildModal());
  document.body.appendChild(overlay);
  wireEscapeKey();
}

/* ============================== Open / close ============================== */

function wireEscapeKey() {
  if (escWired) return;
  escWired = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById(IDS.overlay);
      if (overlay && !overlay.classList.contains('oa-pa-hidden')) {
        closeModal();
      }
    }
  });
}

function setPending(pending) {
  const loginBtn = document.getElementById('oa-pa-save-btn');
  const cancelBtn = document.querySelector('#' + IDS.modal + ' .oa-pa-btn-secondary');
  if (loginBtn) {
    loginBtn.disabled = pending;
    loginBtn.textContent = pending ? TEXT.loginPending : TEXT.save;
  }
  if (cancelBtn) cancelBtn.disabled = pending;
}

function resetModalState() {
  const els = {
    password: document.getElementById('oa-pa-password'),
    error: document.getElementById('oa-pa-error'),
    success: document.getElementById('oa-pa-success'),
    sessionNote: document.getElementById('oa-pa-session-note'),
  };
  if (els.password) els.password.value = '';
  for (const key of ['error', 'success', 'sessionNote']) {
    if (els[key]) els[key].classList.add('oa-pa-hidden');
  }
  setPending(false);
}

export async function openModal() {
  const overlay = document.getElementById(IDS.overlay);
  if (!overlay) return;
  resetModalState();
  const eInput = document.getElementById('oa-pa-username');
  if (eInput) eInput.value = '';

  // Active session? Show it; focus the password (re-login).
  const session = getAuthSession();
  if (session && session.accessToken) {
    const note = document.getElementById('oa-pa-session-note');
    if (note) {
      note.textContent = TEXT.activeSession(
        session.name || session.username || '',
        session.username || session.email || ''
      );
      note.classList.remove('oa-pa-hidden');
    }
    if (eInput) eInput.value = session.username || '';
    const pInput = document.getElementById('oa-pa-password');
    if (pInput) pInput.focus();
  } else {
    // No session — prefill the last remembered username and focus it.
    const username = await loadRememberedUsername();
    if (username && eInput) eInput.value = username;
    if (eInput) eInput.focus();
  }
  overlay.classList.remove('oa-pa-hidden');
}

export function closeModal() {
  clearTimeout(closeTimer);
  closeTimer = null;
  const overlay = document.getElementById(IDS.overlay);
  if (overlay) overlay.classList.add('oa-pa-hidden');
  resetModalState();
}

function closeModalSoon(ms) {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeModal, ms);
}

/** Cleanup hook for full removal (called by main.js → removeAll). */
export function disposeModal() {
  clearTimeout(closeTimer);
  closeTimer = null;
  onSavedCallback = null;
}

/* ================================ Submit ================================== */

function apiErrorToFaText(err) {
  if (!err) return TEXT.errorUnexpected('');
  if (err.status === 0) return TEXT.errorNetwork;
  if (err.status === 400 || err.status === 401 || err.status === 403) {
    return TEXT.errorInvalidCredentials;
  }
  return TEXT.errorUnexpected(err.status);
}

async function onSubmit() {
  const eInput = document.getElementById('oa-pa-username');
  const pInput = document.getElementById('oa-pa-password');
  const errBox = document.getElementById('oa-pa-error');
  const okBox = document.getElementById('oa-pa-success');

  const username = (eInput && eInput.value || '').trim();
  const password = (pInput && pInput.value) || '';

  if (errBox) errBox.classList.add('oa-pa-hidden');
  if (!username || !password) {
    if (errBox) {
      errBox.textContent = TEXT.errorRequired;
      errBox.classList.remove('oa-pa-hidden');
    }
    const focusEl = !username ? eInput : pInput;
    if (focusEl) focusEl.focus();
    return;
  }
  if (!USERNAME_REGEX.test(username)) {
    if (errBox) {
      errBox.textContent = TEXT.errorUsernameFormat;
      errBox.classList.remove('oa-pa-hidden');
    }
    if (eInput) eInput.focus();
    return;
  }

  setPending(true);
  try {
    const session = await login(username, password);

    console.log('[OA Process Activation] login successful — session stored in sessionStorage:', {
      username: session.username,
      email: session.email,
      name: session.name,
      role: session.role,
      userId: session.userId,
      accessToken: maskToken(session.accessToken),
    });

    saveRememberedUsername(username);

    if (okBox) okBox.classList.remove('oa-pa-hidden');
    if (onSavedCallback) onSavedCallback();

    closeModalSoon(1600);
  } catch (err) {
    console.warn(
      '[OA Process Activation] login failed:',
      err instanceof ApiError ? err.message : err
    );
    if (errBox) {
      errBox.textContent = apiErrorToFaText(err);
      errBox.classList.remove('oa-pa-hidden');
    }
    if (pInput) pInput.focus();
  } finally {
    setPending(false);
  }
}
