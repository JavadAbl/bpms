/**
 * cases-grid.js — the «سوابق کارتابل» cases grid (v1.7).
 * ------------------------------------------------------
 * Renders GET /api/process-instances/cases — every process instance the
 * user participates in (any status) — as a grid table INSIDE the OA page's
 * own #bodyContainer, exactly like the tasks grid. Clicking a row EXPANDS
 * it in place to show:
 *   - the case's full task timeline (روند گام‌ها): گام / مسئول / فرم /
 *     وضعیت / تاریخ ایجاد / تاریخ انجام — straight from the cases payload
 *     (each item ships its `tasks` timeline; no extra request needed)
 *   - پیوست‌های پرونده: lazily fetched once per case from
 *     GET /api/files/by-instance/:id, with authenticated download buttons.
 *
 * Notes:
 *   - No search box — the backend route has no searchable fields, so a
 *     search parameter would be silently ignored (misleading UX).
 *   - Selection dance mirrors the host: selecting this sidebar item
 *     deselects «جریان کار» and vice versa; the host reclaiming
 *     #bodyContainer deselects us (per-kind, see sidebar.js).
 *   - All DOM is built with createElement/textContent — no innerHTML with
 *     API data (XSS-safe).
 *
 * Dependency injection (no circular imports): main.js passes
 *   deps.onRelogin        — opens the login modal (grid's «ورود دوباره»)
 *   deps.onSessionExpired — full session cleanup (clear + button + sidebar)
 */

import { IDS, TEXT, API } from './config.js';
import { getAuthSession, ApiError } from './api.js';
import { fetchCases } from './cases.js';
import { fetchInstanceAttachments, downloadAttachment } from './files.js';
import { selectSidebarItem, deselectSidebarItem } from './sidebar.js';
import { ce, formatFaDate, faNum, formatBytes } from './utils.js';

let onReloginCallback = null;
let onSessionExpiredCallback = null;

let hostObserver = null;
let expanded = null; // instanceId of the currently expanded row
const attachmentsCache = new Map(); // instanceId → FileDto[] | 'error'

const state = {
  page: 1,
};

/* ============================ Status helpers ================================ */

function caseStatusLabel(status) {
  switch (String(status || '')) {
    case 'RUNNING':
      return TEXT.caseRunning;
    case 'COMPLETED':
      return TEXT.caseCompleted;
    case 'FAILED':
      return TEXT.caseFailed;
    case 'TERMINATED':
      return TEXT.caseTerminated;
    default:
      return String(status || TEXT.dash);
  }
}

function caseStatusClass(status) {
  switch (String(status || '')) {
    case 'RUNNING':
      return 'oa-pa-case-running';
    case 'COMPLETED':
      return 'oa-pa-case-completed';
    case 'FAILED':
      return 'oa-pa-case-failed';
    case 'TERMINATED':
      return 'oa-pa-case-terminated';
    default:
      return 'oa-pa-case-terminated';
  }
}

function stepStatusLabel(status) {
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

function stepStatusClass(status) {
  switch (String(status || '')) {
    case 'PENDING':
      return 'oa-pa-step-pending';
    case 'COMPLETED':
      return 'oa-pa-step-completed';
    default:
      return 'oa-pa-step-muted';
  }
}

/* ============================== Build ===================================== */

function buildCasesGrid() {
  const root = document.createElement('div');
  root.id = IDS.casesGrid;
  root.className = 'oa-pa-grid';
  root.dir = 'rtl';

  // -- toolbar ---------------------------------------------------------------
  const toolbar = ce('div', 'oa-pa-grid-toolbar');

  const titleWrap = ce('div', 'oa-pa-grid-title-wrap');
  titleWrap.append(
    ce('span', 'oa-pa-grid-title', TEXT.casesGridTitle),
    ce('span', 'oa-pa-grid-subtitle', TEXT.casesGridSubtitle),
    ce('span', 'oa-pa-grid-count'),
    ce('span', 'oa-pa-grid-hint', TEXT.casesExpandHint)
  );

  const actions = ce('div', 'oa-pa-grid-actions');
  const refresh = ce('button', 'oa-pa-grid-refresh', TEXT.refresh);
  refresh.type = 'button';
  refresh.title = TEXT.refresh;
  refresh.addEventListener('click', () => {
    attachmentsCache.clear();
    loadCases();
  });
  actions.appendChild(refresh);

  toolbar.append(titleWrap, actions);

  // -- message area (loading / empty / error / expired) -----------------------
  const message = ce('div', 'oa-pa-grid-message oa-pa-hidden');
  message.id = 'oa-pa-cases-message';

  // -- table -------------------------------------------------------------------
  const tableWrap = ce('div', 'oa-pa-grid-tablewrap oa-pa-hidden');
  const table = document.createElement('table');
  table.className = 'oa-pa-grid-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    TEXT.casesColRow,
    TEXT.casesColProcess,
    TEXT.casesColStarter,
    TEXT.casesColStatus,
    TEXT.casesColStartedAt,
    TEXT.casesColSteps,
  ].forEach((label) => {
    headRow.appendChild(ce('th', null, label));
  });
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  tbody.id = 'oa-pa-cases-tbody';
  table.append(thead, tbody);
  tableWrap.appendChild(table);

  // -- pager ---------------------------------------------------------------------
  const pager = ce('div', 'oa-pa-grid-pager oa-pa-hidden');
  pager.id = 'oa-pa-cases-pager';
  const pagerInfo = ce('span', 'oa-pa-pager-info');
  pagerInfo.id = 'oa-pa-cases-pager-info';
  const pagerPage = ce('span', 'oa-pa-pager-page');
  pagerPage.id = 'oa-pa-cases-pager-page';
  const pagerBtns = ce('div', 'oa-pa-pager-btns');
  const prev = ce('button', 'oa-pa-pager-prev', TEXT.pagerPrev);
  prev.type = 'button';
  prev.id = 'oa-pa-cases-pager-prev';
  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      expanded = null;
      loadCases();
    }
  });
  const next = ce('button', 'oa-pa-pager-next', TEXT.pagerNext);
  next.type = 'button';
  next.id = 'oa-pa-cases-pager-next';
  next.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(lastTotal / API.casesPageSize));
    if (state.page < pages) {
      state.page += 1;
      expanded = null;
      loadCases();
    }
  });
  pagerBtns.append(prev, next);
  pager.append(pagerInfo, pagerPage, pagerBtns);

  root.append(toolbar, message, tableWrap, pager);
  return root;
}

/* ============================ State rendering ============================== */

let lastTotal = 0;

function rootEl() {
  return document.getElementById(IDS.casesGrid);
}

function showMessage(kind, err) {
  const message = document.getElementById('oa-pa-cases-message');
  const tableWrap = rootEl()?.querySelector('.oa-pa-grid-tablewrap');
  const pager = document.getElementById('oa-pa-cases-pager');
  if (!message) return;
  message.classList.remove('oa-pa-hidden');
  message.classList.remove('oa-pa-msg-error');
  message.textContent = '';
  if (tableWrap) tableWrap.classList.add('oa-pa-hidden');
  if (pager) pager.classList.add('oa-pa-hidden');

  if (kind === 'loading') {
    const spinner = ce('span', 'oa-pa-spinner');
    message.append(spinner, document.createTextNode(TEXT.casesLoading));
  } else if (kind === 'empty') {
    message.textContent = TEXT.casesEmpty;
  } else if (kind === 'error') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.casesErrorLoad;
    const actions = ce('div', 'oa-pa-msg-actions');
    const retry = ce('button', 'oa-pa-msg-btn', TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => loadCases());
    actions.appendChild(retry);
    message.appendChild(actions);
    if (err) {
      console.warn('[OA Process Activation] cases grid error:', err.message);
    }
  } else if (kind === 'expired') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.sessionExpired;
    const actions = ce('div', 'oa-pa-msg-actions');
    const loginBtn = ce('button', 'oa-pa-msg-btn', TEXT.loginAgain);
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', () => {
      if (onReloginCallback) onReloginCallback();
    });
    actions.appendChild(loginBtn);
    message.appendChild(actions);
  }
}

function hideMessage() {
  const message = document.getElementById('oa-pa-cases-message');
  if (message) {
    message.classList.add('oa-pa-hidden');
    message.classList.remove('oa-pa-msg-error');
    message.textContent = '';
  }
}

/* ============================== Rendering ================================== */

function caseSteps(item) {
  return Array.isArray(item.tasks) ? item.tasks : [];
}

function stepsSummaryCell(item) {
  const td = ce('td');
  const tasks = caseSteps(item);
  const done = tasks.filter((t) => String(t.status) === 'COMPLETED').length;
  const chip = ce(
    'span',
    'oa-pa-steps-chip',
    TEXT.stepsSummary(faNum(tasks.length), faNum(done))
  );
  td.appendChild(chip);
  const current = tasks.find((t) => String(t.status) === 'PENDING');
  if (current && current.name) {
    const cur = ce('div', 'oa-pa-steps-current');
    cur.append(
      document.createTextNode(TEXT.stepsCurrentPrefix),
      ce('b', null, String(current.name))
    );
    td.appendChild(cur);
  }
  return td;
}

/** The expanded detail row: full timeline + پیوست‌های پرونده. */
function buildDetailRow(item) {
  const tr = document.createElement('tr');
  tr.className = 'oa-pa-case-detail';
  const td = ce('td');
  td.colSpan = 6;

  // -- steps timeline table -------------------------------------------------
  const stepsWrap = ce('div', 'oa-pa-case-steps');
  stepsWrap.appendChild(ce('div', 'oa-pa-case-steps-title', TEXT.casesColSteps));
  const tasks = caseSteps(item);
  if (!tasks.length) {
    stepsWrap.appendChild(ce('div', 'oa-pa-case-empty', TEXT.stepsEmpty));
  } else {
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
      row.append(
        ce('td', 'oa-pa-td-row', faNum(i + 1)),
        ce('td', 'oa-pa-step-name', String(t.name || TEXT.dash)),
        ce('td', null, assignee ? String(assignee) : TEXT.dash),
        ce('td', null, TEXT.dash), // cases payload carries no form — dialog detail does
        ce(
          'td',
          null
        ),
        ce('td', null, t.createdAt ? formatFaDate(t.createdAt) : TEXT.dash),
        ce(
          'td',
          null,
          t.completedAt ? formatFaDate(t.completedAt) : TEXT.dash
        )
      );
      const statusTd = row.cells[4];
      statusTd.appendChild(
        ce('span', 'oa-pa-step-pill ' + stepStatusClass(t.status), stepStatusLabel(t.status))
      );
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    stepsWrap.appendChild(table);
  }
  td.appendChild(stepsWrap);

  // -- پیوست‌های پرونده (lazy, cached per instance) -----------------------------
  const attWrap = ce('div', 'oa-pa-case-attachments');
  attWrap.appendChild(
    ce('div', 'oa-pa-case-steps-title', TEXT.attachmentsSectionTitle)
  );
  const attBody = ce('div');
  attBody.className = 'oa-pa-case-attachments-body';
  attBody.appendChild(
    ce('div', 'oa-pa-case-empty', TEXT.attachmentsLoading)
  );
  attWrap.appendChild(attBody);
  td.appendChild(attWrap);

  tr.appendChild(td);
  renderCaseAttachments(item.id, attBody);
  return tr;
}

/** Fills an attachments body — fetched once per instance, then cached. */
async function renderCaseAttachments(instanceId, bodyEl) {
  if (attachmentsCache.has(instanceId)) {
    paintCaseAttachments(attachmentsCache.get(instanceId), bodyEl);
    return;
  }
  try {
    const files = await fetchInstanceAttachments(instanceId);
    attachmentsCache.set(instanceId, files);
    paintCaseAttachments(files, bodyEl);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 401 || err.kind === 'no-session')
    ) {
      if (onSessionExpiredCallback) onSessionExpiredCallback();
      showMessage('expired');
      return;
    }
    attachmentsCache.set(instanceId, 'error');
    paintCaseAttachments('error', bodyEl);
    console.warn(
      '[OA Process Activation] case attachments failed:',
      err instanceof ApiError ? err.message : err
    );
  }
}

function paintCaseAttachments(files, bodyEl) {
  if (!bodyEl) return;
  bodyEl.textContent = '';
  if (files === 'error') {
    bodyEl.appendChild(ce('div', 'oa-pa-case-empty', TEXT.attachmentsErrorLoad));
    return;
  }
  if (!files || !files.length) {
    bodyEl.appendChild(ce('div', 'oa-pa-case-empty', TEXT.attachmentsEmpty));
    return;
  }
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
    bodyEl.appendChild(row);
  });
}

function renderRows(items) {
  const tbody = document.getElementById('oa-pa-cases-tbody');
  if (!tbody) return;
  tbody.textContent = '';
  const offset = (state.page - 1) * API.casesPageSize;
  items.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-instance-id', String(item.id || ''));
    tr.className = 'oa-pa-case-row';
    tr.tabIndex = 0;

    const proc = ((item.process || {}).name) || TEXT.dash;
    const starter = (item.startedBy || {}).name || TEXT.dash;

    const statusTd = ce('td');
    statusTd.appendChild(
      ce(
        'span',
        'oa-pa-case-badge ' + caseStatusClass(item.status),
        caseStatusLabel(item.status)
      )
    );

    tr.append(
      ce('td', 'oa-pa-td-row', faNum(offset + i + 1)),
      ce('td', null, String(proc)),
      ce('td', null, String(starter)),
      statusTd,
      ce('td', null, item.startedAt ? formatFaDate(item.startedAt) : TEXT.dash),
      stepsSummaryCell(item)
    );

    tr.title = TEXT.casesExpandHint;
    tr.addEventListener('click', () => toggleRow(tr, item));
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        toggleRow(tr, item);
      }
    });
    tbody.appendChild(tr);

    if (expanded === String(item.id)) {
      tr.classList.add('oa-pa-row-expanded');
      tr.after(buildDetailRow(item));
    }
  });
}

function toggleRow(tr, item) {
  const id = String(item.id || '');
  const wasExpanded = expanded === id;
  expanded = wasExpanded ? null : id;
  const tbody = document.getElementById('oa-pa-cases-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.oa-pa-case-detail').forEach((r) => r.remove());
  tbody.querySelectorAll('.oa-pa-row-expanded').forEach((r) => {
    r.classList.remove('oa-pa-row-expanded');
  });
  if (!wasExpanded) {
    tr.classList.add('oa-pa-row-expanded');
    tr.after(buildDetailRow(item));
  }
}

function renderPager(totalCount) {
  const tableWrap = rootEl()?.querySelector('.oa-pa-grid-tablewrap');
  const pager = document.getElementById('oa-pa-cases-pager');
  const info = document.getElementById('oa-pa-cases-pager-info');
  const pageEl = document.getElementById('oa-pa-cases-pager-page');
  const prev = document.getElementById('oa-pa-cases-pager-prev');
  const next = document.getElementById('oa-pa-cases-pager-next');
  if (!pager || !info || !pageEl || !prev || !next) return;

  const pages = Math.max(1, Math.ceil(totalCount / API.casesPageSize));
  if (state.page > pages) state.page = pages;
  const from = (state.page - 1) * API.casesPageSize + 1;
  const to = Math.min(state.page * API.casesPageSize, totalCount);

  info.textContent = totalCount
    ? TEXT.pagerInfo(faNum(from), faNum(to), faNum(totalCount))
    : '';
  pageEl.textContent = TEXT.pagerPage(faNum(state.page), faNum(pages));
  prev.disabled = state.page <= 1;
  next.disabled = state.page >= pages;

  if (tableWrap) tableWrap.classList.remove('oa-pa-hidden');
  pager.classList.remove('oa-pa-hidden');
}

/* ============================== Data loading ================================ */

async function loadCases() {
  if (!getAuthSession()) return; // defensive — sidebar hides this path
  showMessage('loading');
  try {
    const res = await fetchCases({ page: state.page });
    lastTotal = res.totalCount;

    const countEl = rootEl()?.querySelector('.oa-pa-grid-count');
    if (countEl) countEl.textContent = TEXT.casesGridCount(faNum(res.totalCount));

    if (!res.items.length) {
      showMessage('empty');
      return;
    }
    hideMessage();
    renderRows(res.items);
    renderPager(res.totalCount);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 401 || err.kind === 'no-session')
    ) {
      if (onSessionExpiredCallback) onSessionExpiredCallback();
      showMessage('expired');
      return;
    }
    showMessage('error', err);
  }
}

/* ============================ Host integration ============================== */

/**
 * Watches #bodyContainer: when the content is replaced (the user navigated,
 * or our OWN tasks grid took over the slot), our grid disappears — deselect
 * ONLY our sidebar item (per-kind — see sidebar.js).
 */
function watchHostTakeover() {
  const host = document.getElementById('bodyContainer');
  if (!host || hostObserver) return;
  hostObserver = new MutationObserver(() => {
    if (!document.getElementById(IDS.casesGrid)) {
      stopWatchHostTakeover();
      expanded = null;
      deselectSidebarItem('cases');
    }
  });
  hostObserver.observe(host, { childList: true });
}

function stopWatchHostTakeover() {
  if (hostObserver) {
    hostObserver.disconnect();
    hostObserver = null;
  }
}

/* ================================ Public ==================================== */

/** Stores the injected callbacks (called from main.js → injectAll). */
export function injectCasesGrid(deps) {
  if (deps) {
    if (typeof deps.onRelogin === 'function') onReloginCallback = deps.onRelogin;
    if (typeof deps.onSessionExpired === 'function') {
      onSessionExpiredCallback = deps.onSessionExpired;
    }
  }
}

/**
 * Opens the cases grid inside #bodyContainer (replacing whatever is there —
 * the host or the tasks grid reclaims the slot on their own navigation).
 * Re-clicking the sidebar item refreshes the data.
 */
export async function openCasesGrid() {
  if (!getAuthSession()) return;
  const host = document.getElementById('bodyContainer');
  if (!host) return; // no content slot → stay quiet

  let root = document.getElementById(IDS.casesGrid);
  if (!root) {
    root = buildCasesGrid();
    host.replaceChildren(root);
    state.page = 1;
    expanded = null;
  }
  selectSidebarItem('cases');
  watchHostTakeover();
  await loadCases();
}

/** Cleanup for full deactivation (main.js → removeAll). */
export function disposeCasesGrid() {
  stopWatchHostTakeover();
  expanded = null;
  attachmentsCache.clear();
  const root = document.getElementById(IDS.casesGrid);
  if (root) root.remove();
}
