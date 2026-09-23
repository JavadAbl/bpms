/**
 * draft-dialog.js — fill / save / submit a process draft (v1.9).
 * --------------------------------------------------------------
 * Opened after the start dialog creates a draft, or from the drafts grid.
 * Loads GET /api/process-drafts/:id (form fields + saved formData), lets
 * the user edit, PATCH-save, POST-submit (starts the process), or DELETE.
 */

import { IDS, TEXT, API } from './config.js';
import { ApiError } from './api.js';
import {
  fetchDraftById,
  updateDraft,
  submitDraft,
  deleteDraft,
} from './drafts.js';
import { uploadFile } from './files.js';
import { ce, formatFaDate, formatBytes } from './utils.js';

const deps = {
  onSubmitted: null, // refresh grids / badge after submit
  onDiscarded: null, // refresh drafts grid after delete
  onSessionExpired: null,
  onRelogin: null,
};

let escWired = false;
let busy = false;
let currentDraftId = null;
let draft = null;
let fieldControls = [];
let savedFormData = {};

function overlayEl() {
  return document.getElementById(IDS.draftOverlay);
}

function dialogVisible() {
  const ov = overlayEl();
  return !!ov && !ov.classList.contains('oa-pa-hidden');
}

function buildOnce() {
  if (overlayEl() || !document.body) return;
  const overlay = ce('div');
  overlay.id = IDS.draftOverlay;
  overlay.className = 'oa-pa-hidden';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDraftDialog();
  });

  const dialog = ce('div');
  dialog.id = IDS.draftDialog;
  dialog.dir = 'rtl';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'oa-pa-draft-title-el');

  const head = ce('div', 'oa-pa-modal-header');
  const title = ce('div', 'oa-pa-modal-title', TEXT.draftDialogTitle);
  title.id = 'oa-pa-draft-title-el';
  const closeBtn = ce('button', 'oa-pa-close', '\u00D7');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', TEXT.closeAria);
  closeBtn.addEventListener('click', () => closeDraftDialog());
  head.append(title, closeBtn);

  const body = ce('div', 'oa-pa-task-body');
  const subtitle = ce('div', 'oa-pa-task-subtitle');
  subtitle.id = 'oa-pa-draft-subtitle';
  const hint = ce('p', 'oa-pa-hint', TEXT.draftDialogHint);
  const content = ce('div');
  content.id = 'oa-pa-draft-content';
  const errBox = ce('div', 'oa-pa-error oa-pa-hidden');
  errBox.id = 'oa-pa-draft-error';
  const okBox = ce('div', 'oa-pa-success oa-pa-hidden');
  okBox.id = 'oa-pa-draft-ok';
  body.append(subtitle, hint, content, errBox, okBox);

  const foot = ce('div', 'oa-pa-modal-footer');
  const discardBtn = ce('button', 'oa-pa-btn-secondary', TEXT.draftDiscard);
  discardBtn.type = 'button';
  discardBtn.id = 'oa-pa-draft-discard';
  discardBtn.addEventListener('click', () => onDiscard());
  const saveBtn = ce('button', 'oa-pa-btn-secondary', TEXT.draftSave);
  saveBtn.type = 'button';
  saveBtn.id = 'oa-pa-draft-save';
  saveBtn.addEventListener('click', () => onSave());
  const submitBtn = ce('button', 'oa-pa-btn-primary', TEXT.draftSubmit);
  submitBtn.type = 'button';
  submitBtn.id = 'oa-pa-draft-submit';
  submitBtn.addEventListener('click', () => onSubmit());
  foot.append(discardBtn, saveBtn, submitBtn);

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
    if (dialogVisible() && !busy) closeDraftDialog();
  });
}

export function openDraftDialog(draftId) {
  if (!draftId) return;
  buildOnce();
  const ov = overlayEl();
  if (!ov) return;

  busy = false;
  currentDraftId = String(draftId);
  draft = null;
  fieldControls = [];
  savedFormData = {};
  hideError();
  hideOk();
  setFooterEnabled(false);

  const content = document.getElementById('oa-pa-draft-content');
  if (content) {
    content.textContent = '';
    const loading = ce('div', 'oa-pa-grid-message');
    loading.append(ce('span', 'oa-pa-spinner'), document.createTextNode(TEXT.draftLoading));
    content.appendChild(loading);
  }
  const sub = document.getElementById('oa-pa-draft-subtitle');
  if (sub) sub.textContent = '';

  ov.classList.remove('oa-pa-hidden');
  loadDraft(currentDraftId);
}

export function closeDraftDialog() {
  if (busy) return;
  const ov = overlayEl();
  if (ov) ov.classList.add('oa-pa-hidden');
  currentDraftId = null;
  draft = null;
  fieldControls = [];
  savedFormData = {};
}

function setFooterEnabled(enabled) {
  ['oa-pa-draft-discard', 'oa-pa-draft-save', 'oa-pa-draft-submit'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled || busy;
  });
}

function setBusy(pending, mode) {
  busy = pending;
  const saveBtn = document.getElementById('oa-pa-draft-save');
  const submitBtn = document.getElementById('oa-pa-draft-submit');
  const discardBtn = document.getElementById('oa-pa-draft-discard');
  if (saveBtn) {
    saveBtn.disabled = pending;
    saveBtn.textContent =
      pending && mode === 'save' ? TEXT.draftSavePending : TEXT.draftSave;
  }
  if (submitBtn) {
    submitBtn.disabled = pending;
    submitBtn.textContent =
      pending && mode === 'submit' ? TEXT.draftSubmitPending : TEXT.draftSubmit;
  }
  if (discardBtn) discardBtn.disabled = pending;
}

function showError(text) {
  const box = document.getElementById('oa-pa-draft-error');
  if (box) {
    box.textContent = text;
    box.classList.remove('oa-pa-hidden');
  }
}

function hideError() {
  const box = document.getElementById('oa-pa-draft-error');
  if (box) box.classList.add('oa-pa-hidden');
}

function showOk(text) {
  const box = document.getElementById('oa-pa-draft-ok');
  if (box) {
    box.textContent = text;
    box.classList.remove('oa-pa-hidden');
  }
}

function hideOk() {
  const box = document.getElementById('oa-pa-draft-ok');
  if (box) box.classList.add('oa-pa-hidden');
}

async function loadDraft(id) {
  try {
    const data = await fetchDraftById(id);
    if (!dialogVisible() || currentDraftId !== String(id)) return;
    draft = data;
    savedFormData = data.formData || {};
    renderDetail();
    setFooterEnabled(true);
  } catch (err) {
    if (!dialogVisible()) return;
    if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
      if (deps.onSessionExpired) deps.onSessionExpired();
      const content = document.getElementById('oa-pa-draft-content');
      if (content) {
        content.textContent = '';
        content.appendChild(ce('div', 'oa-pa-grid-message oa-pa-msg-error', TEXT.sessionExpired));
      }
      return;
    }
    const content = document.getElementById('oa-pa-draft-content');
    if (content) {
      content.textContent = '';
      content.appendChild(ce('div', 'oa-pa-grid-message oa-pa-msg-error', TEXT.draftErrorLoad));
    }
  }
}

function renderDetail() {
  const content = document.getElementById('oa-pa-draft-content');
  const sub = document.getElementById('oa-pa-draft-subtitle');
  if (!content || !draft) return;
  content.textContent = '';
  fieldControls = [];

  if (sub) {
    const parts = [
      draft.process && draft.process.name,
      draft.firstTaskName,
    ].filter(Boolean);
    sub.textContent = parts.join(' — ');
  }

  const meta = ce('div', 'oa-pa-task-meta');
  meta.appendChild(metaItem(TEXT.metaProcess, (draft.process && draft.process.name) || TEXT.dash));
  meta.appendChild(metaItem(TEXT.colTitle || 'گام', draft.firstTaskName || TEXT.dash));
  meta.appendChild(
    metaItem(TEXT.draftsColUpdated, formatFaDate(draft.updatedAt) || TEXT.dash),
  );
  content.appendChild(meta);

  const fields = (draft.form && draft.form.fields) || [];
  if (!fields.length) {
    content.appendChild(ce('p', 'oa-pa-hint', TEXT.draftNoForm));
    return;
  }

  const form = ce('div', 'oa-pa-task-form');
  form.id = 'oa-pa-draft-form';
  fields.forEach((f) => renderField(f, form));
  content.appendChild(form);
}

function metaItem(label, value) {
  const item = ce('div', 'oa-pa-meta-item');
  item.appendChild(ce('div', 'oa-pa-meta-label', label));
  item.appendChild(ce('div', 'oa-pa-meta-value', value));
  return item;
}

function renderField(field, form) {
  const type = String((field && field.type) || 'text').toLowerCase();
  if (type === 'file') return renderFileField(field, form);

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

  let prefill = '';
  const saved = savedFormData[field.name];
  if (saved !== undefined && saved !== null) {
    prefill = String(saved);
  } else if (field.defaultValue !== undefined && field.defaultValue !== null) {
    prefill = String(field.defaultValue);
  }

  const row = ce('div', 'oa-pa-field-row');
  if (field.name) row.setAttribute('data-field-name', String(field.name));

  const labelLine = ce('div', 'oa-pa-field-label-line');
  labelLine.appendChild(
    ce('span', 'oa-pa-field-label', String(field.label || field.name || '')),
  );
  if (field.required) labelLine.appendChild(ce('span', 'oa-pa-req', '*'));
  row.appendChild(labelLine);

  let control;
  if (type === 'textarea') {
    control = document.createElement('textarea');
    control.className = 'oa-pa-input oa-pa-textarea';
    control.rows = 3;
    control.dir = 'auto';
    control.value = prefill;
  } else if (type === 'number') {
    control = document.createElement('input');
    control.type = 'number';
    control.className = 'oa-pa-input';
    control.dir = 'ltr';
    control.value = prefill;
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
    control.value = prefill;
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
    control.checked =
      saved === true || prefill === 'true' || prefill === true;
  } else {
    control = document.createElement('input');
    control.type = 'text';
    control.className = 'oa-pa-input';
    control.dir = 'auto';
    control.value = prefill;
  }

  if (readOnly) {
    control.disabled = true;
    if (control.classList) control.classList.add('oa-pa-input-readonly');
  }
  if (field.placeholder && control.placeholder !== undefined) {
    control.placeholder = String(field.placeholder);
  }
  row.appendChild(control);
  form.appendChild(row);

  fieldControls.push({
    field,
    type,
    control,
    readOnly,
    focus: () => {
      let target = control;
      if (type === 'radio' && control.querySelector) {
        target = control.querySelector('input');
      }
      if (target && target.focus) target.focus();
    },
  });
}

function renderFileField(field, form) {
  const row = ce('div', 'oa-pa-field-row');
  if (field.name) row.setAttribute('data-field-name', String(field.name));
  const labelLine = ce('div', 'oa-pa-field-label-line');
  labelLine.appendChild(
    ce('span', 'oa-pa-field-label', String(field.label || field.name || '')),
  );
  if (field.required) labelLine.appendChild(ce('span', 'oa-pa-req', '*'));
  row.appendChild(labelLine);

  const saved = savedFormData[field.name];
  const metas = Array.isArray(saved) ? saved : [];
  const list = ce('div', 'oa-pa-file-list');
  const files = [];

  const input = document.createElement('input');
  input.type = 'file';
  input.className = 'oa-pa-hidden';
  if (field.multiple) input.multiple = true;
  input.addEventListener('change', () => {
    Array.from(input.files || []).forEach((f) => {
      if (f.size > API.maxFileSizeBytes) {
        showError(TEXT.fileFieldTooLarge(f.name, API.maxFileSizeMb));
        return;
      }
      files.push(f);
      const chip = ce('div', 'oa-pa-file-chip');
      chip.appendChild(ce('span', null, f.name + ' (' + formatBytes(f.size) + ')'));
      list.appendChild(chip);
    });
    input.value = '';
  });

  const addBtn = ce('button', 'oa-pa-btn-secondary', TEXT.fileFieldAdd);
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => input.click());

  metas.forEach((m) => {
    list.appendChild(ce('div', 'oa-pa-file-chip', String(m.name || m.id || '')));
  });

  row.append(addBtn, input, list);
  if (!metas.length && !files.length) {
    row.appendChild(ce('div', 'oa-pa-hint', TEXT.fileFieldNone));
  }
  form.appendChild(row);

  fieldControls.push({
    field,
    type: 'file',
    control: input,
    readOnly: false,
    files,
    metas,
    focus: () => addBtn.focus(),
  });
}

function fieldValue(ctrl) {
  const c = ctrl.control;
  if (ctrl.type === 'checkbox') return !!c.checked;
  if (ctrl.type === 'radio') {
    const checked = c.querySelector && c.querySelector('input:checked');
    return checked ? checked.value : '';
  }
  return c.value;
}

function validateFields() {
  for (const ctrl of fieldControls) {
    if (!ctrl.field.required || ctrl.readOnly) continue;
    if (ctrl.type === 'file') {
      const has =
        (ctrl.files && ctrl.files.length) || (ctrl.metas && ctrl.metas.length);
      if (!has) return ctrl;
      continue;
    }
    if (ctrl.type === 'checkbox') continue;
    const v = String(fieldValue(ctrl) == null ? '' : fieldValue(ctrl)).trim();
    if (!v) return ctrl;
  }
  return null;
}

async function collectValues() {
  const values = { ...savedFormData };
  for (const ctrl of fieldControls) {
    const name = String(ctrl.field.name || '');
    if (!name || ctrl.readOnly) continue;
    if (ctrl.type === 'file') {
      const metas = [...(ctrl.metas || [])];
      for (const f of ctrl.files || []) {
        const meta = await uploadFile(f);
        metas.push(meta);
      }
      if (metas.length) values[name] = metas;
      continue;
    }
    let v = fieldValue(ctrl);
    if (ctrl.type === 'number') {
      const s = String(v == null ? '' : v).trim();
      if (s === '') {
        delete values[name];
        continue;
      }
      const n = Number(s);
      v = Number.isNaN(n) ? s : n;
    } else if (ctrl.type !== 'checkbox') {
      v = String(v == null ? '' : v).trim();
      if (v === '') {
        delete values[name];
        continue;
      }
    }
    values[name] = v;
  }
  return values;
}

async function onSave() {
  if (!draft || busy) return;
  hideError();
  hideOk();
  setBusy(true, 'save');
  try {
    const values = await collectValues();
    const updated = await updateDraft(draft.id, values);
    draft = updated;
    savedFormData = updated.formData || values;
    showOk(TEXT.draftSaveSuccess);
  } catch (err) {
    handleSessionOrError(err, TEXT.draftErrorSave);
  } finally {
    setBusy(false);
  }
}

async function onSubmit() {
  if (!draft || busy) return;
  hideError();
  hideOk();
  const bad = validateFields();
  if (bad) {
    const label = bad.field.label || bad.field.name || '';
    showError(
      bad.type === 'file'
        ? TEXT.fileFieldRequired(label)
        : TEXT.errorFieldRequired(label),
    );
    bad.focus();
    return;
  }
  setBusy(true, 'submit');
  try {
    const values = await collectValues();
    const inst = await submitDraft(draft.id, values);
    console.log('[OA Process Activation] draft submitted → instance', inst.id);
    showOk(TEXT.draftSubmitSuccess);
    if (deps.onSubmitted) deps.onSubmitted(inst);
    setTimeout(() => {
      busy = false;
      closeDraftDialog();
    }, 1200);
  } catch (err) {
    handleSessionOrError(err, TEXT.draftErrorSubmit);
    setBusy(false);
  }
}

async function onDiscard() {
  if (!draft || busy) return;
  if (!window.confirm(TEXT.draftDiscardConfirm)) return;
  hideError();
  setBusy(true, 'discard');
  try {
    await deleteDraft(draft.id);
    if (deps.onDiscarded) deps.onDiscarded();
    busy = false;
    closeDraftDialog();
  } catch (err) {
    handleSessionOrError(err, TEXT.draftErrorSave);
    setBusy(false);
  }
}

function handleSessionOrError(err, fallback) {
  if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
    if (deps.onSessionExpired) deps.onSessionExpired();
    closeDraftDialog();
    return;
  }
  showError(
    err instanceof ApiError && err.status === 0 ? TEXT.errorNetwork : fallback,
  );
}

export function injectDraftDialog(depsIn) {
  if (!depsIn) return;
  if (typeof depsIn.onSubmitted === 'function') deps.onSubmitted = depsIn.onSubmitted;
  if (typeof depsIn.onDiscarded === 'function') deps.onDiscarded = depsIn.onDiscarded;
  if (typeof depsIn.onSessionExpired === 'function') {
    deps.onSessionExpired = depsIn.onSessionExpired;
  }
  if (typeof depsIn.onRelogin === 'function') deps.onRelogin = depsIn.onRelogin;
}

export function disposeDraftDialog() {
  const ov = overlayEl();
  if (ov) ov.remove();
  draft = null;
  currentDraftId = null;
  fieldControls = [];
  busy = false;
}
