/**
 * tasks-grid.js — the «جریان کار» process-tasks inbox grid.
 * -----------------------------------------------------------
 * Renders the current user's BPMS کارتابل (GET /api/tasks/mine) as a grid
 * table INSIDE the OA page's own #bodyContainer — the exact slot the host
 * app fills with its «جاری» list. When the host SPA navigates elsewhere
 * (جاری / پیگیری / ...) it reclaims #bodyContainer; a MutationObserver
 * notices our grid is gone and deselects the sidebar item — the same
 * selection dance the host does between its own items.
 *
 * Features: loading / empty / error / session-expired states, server-side
 * search (debounced), pagination (page/pageSize), refresh, Persian dates
 * and digits. Double-clicking a row (or focusing it and pressing Enter)
 * opens the «انجام کار» dialog via deps.onOpenTask; after the task is
 * completed there, main.js calls refreshTasksGrid() to reload this grid.
 * All DOM is built with createElement/textContent — no innerHTML with API
 * data (XSS-safe).
 *
 * Dependency injection (no circular imports): main.js passes
 *   deps.onRelogin        — opens the login modal (grid's «ورود دوباره»)
 *   deps.onSessionExpired — full session cleanup (clear + button + sidebar)
 */

import { IDS, TEXT, API } from './config.js';
import { getAuthSession, fetchMyTasks, ApiError } from './api.js';
import {
  selectSidebarItem,
  deselectSidebarItem,
  setSidebarBadge,
} from './sidebar.js';
import { ce, formatFaDate, faNum } from './utils.js';

let onReloginCallback = null;
let onSessionExpiredCallback = null;
let onOpenTaskCallback = null;

let hostObserver = null;
let searchTimer = null;

// Grid state (pagination + search term).
const state = {
  page: 1,
  search: '',
};

/* ============================== Build ===================================== */

function buildGrid() {
  const root = document.createElement('div');
  root.id = IDS.grid;
  root.className = 'oa-pa-grid';
  root.dir = 'rtl';

  // -- toolbar ---------------------------------------------------------------
  const toolbar = ce('div', 'oa-pa-grid-toolbar');

  const titleWrap = ce('div', 'oa-pa-grid-title-wrap');
  titleWrap.append(
    ce('span', 'oa-pa-grid-title', TEXT.gridTitle),
    ce('span', 'oa-pa-grid-subtitle', TEXT.gridSubtitle),
    ce('span', 'oa-pa-grid-count'),
    ce('span', 'oa-pa-grid-hint', TEXT.dblClickHint)
  );

  const actions = ce('div', 'oa-pa-grid-actions');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'oa-pa-grid-search';
  search.placeholder = TEXT.searchPh;
  search.setAttribute('aria-label', TEXT.searchPh);
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = search.value.trim();
      state.page = 1;
      loadTasks();
    }, 500); // debounce — one request per pause, not per keystroke
  });
  const refresh = ce('button', 'oa-pa-grid-refresh', TEXT.refresh);
  refresh.type = 'button';
  refresh.title = TEXT.refresh;
  refresh.addEventListener('click', () => loadTasks());
  actions.append(search, refresh);

  toolbar.append(titleWrap, actions);

  // -- message area (loading / empty / error / expired) -----------------------
  const message = ce('div', 'oa-pa-grid-message oa-pa-hidden');
  message.id = 'oa-pa-grid-message';

  // -- table -------------------------------------------------------------------
  const tableWrap = ce('div', 'oa-pa-grid-tablewrap oa-pa-hidden');
  const table = document.createElement('table');
  table.className = 'oa-pa-grid-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    TEXT.colRow,
    TEXT.colTitle,
    TEXT.colProcess,
    TEXT.colForm,
    TEXT.colAssignment,
    TEXT.colStatus,
    TEXT.colDate,
  ].forEach((label) => {
    headRow.appendChild(ce('th', null, label));
  });
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  tbody.id = 'oa-pa-grid-tbody';
  table.append(thead, tbody);
  tableWrap.appendChild(table);

  // -- pager ---------------------------------------------------------------------
  const pager = ce('div', 'oa-pa-grid-pager oa-pa-hidden');
  pager.id = 'oa-pa-grid-pager';
  const pagerInfo = ce('span', 'oa-pa-pager-info');
  pagerInfo.id = 'oa-pa-pager-info';
  const pagerPage = ce('span', 'oa-pa-pager-page');
  pagerPage.id = 'oa-pa-pager-page';
  const pagerBtns = ce('div', 'oa-pa-pager-btns');
  const prev = ce('button', 'oa-pa-pager-prev', TEXT.pagerPrev);
  prev.type = 'button';
  prev.id = 'oa-pa-pager-prev';
  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadTasks();
    }
  });
  const next = ce('button', 'oa-pa-pager-next', TEXT.pagerNext);
  next.type = 'button';
  next.id = 'oa-pa-pager-next';
  next.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(lastTotal / API.tasksPageSize));
    if (state.page < pages) {
      state.page += 1;
      loadTasks();
    }
  });
  pagerBtns.append(prev, next);
  pager.append(pagerInfo, pagerPage, pagerBtns);

  root.append(toolbar, message, tableWrap, pager);
  return root;
}

/* ============================ State rendering ============================== */

let lastTotal = 0;

function showMessage(kind, err) {
  const message = document.getElementById('oa-pa-grid-message');
  const tableWrap = rootEl()?.querySelector('.oa-pa-grid-tablewrap');
  const pager = document.getElementById('oa-pa-grid-pager');
  if (!message) return;
  message.classList.remove('oa-pa-hidden');
  message.textContent = '';
  if (tableWrap) tableWrap.classList.add('oa-pa-hidden');
  if (pager) pager.classList.add('oa-pa-hidden');

  if (kind === 'loading') {
    const spinner = ce('span', 'oa-pa-spinner');
    message.append(spinner, document.createTextNode(TEXT.loading));
  } else if (kind === 'empty') {
    message.textContent = TEXT.empty;
  } else if (kind === 'error') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.errorLoad;
    const actions = ce('div', 'oa-pa-msg-actions');
    const retry = ce('button', 'oa-pa-msg-btn', TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => loadTasks());
    actions.appendChild(retry);
    message.appendChild(actions);
    if (err) {
      console.warn('[OA Process Activation] tasks grid error:', err.message);
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

function rootEl() {
  return document.getElementById(IDS.grid);
}

function hideMessage() {
  const message = document.getElementById('oa-pa-grid-message');
  if (message) {
    message.classList.add('oa-pa-hidden');
    message.classList.remove('oa-pa-msg-error');
    message.textContent = '';
  }
}

/* ============================== Rendering ================================== */

function assignmentLabel(task) {
  const assignee = task.assignee || null;
  const position = task.position || null;
  if (assignee && assignee.name) {
    return TEXT.assignDirect + ' — ' + assignee.name;
  }
  if (position && position.name) {
    return TEXT.assignPosition + ' — ' + position.name;
  }
  return TEXT.dash;
}

function renderRows(items) {
  const tbody = document.getElementById('oa-pa-grid-tbody');
  if (!tbody) return;
  tbody.textContent = '';
  const offset = (state.page - 1) * API.tasksPageSize;
  items.forEach((task, i) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-task-id', String(task.id || '')); // hook for future actions

    const rowNum = ce('td', 'oa-pa-td-row', faNum(offset + i + 1));
    const titleTd = ce('td');
    const titleEl = ce('span', 'oa-pa-task-title', String(task.name || TEXT.dash));
    titleTd.appendChild(titleEl);

    const proc = ((task.processInstance || {}).process || {}).name;
    const form = (task.form || {}).name;

    const procTd = ce('td', null, proc ? String(proc) : TEXT.dash);
    const formTd = ce('td', null, form ? String(form) : TEXT.dash);
    const assignTd = ce('td', null, assignmentLabel(task));

    const statusTd = ce('td');
    const statusBadge = ce(
      'span',
      'oa-pa-badge-status',
      task.status === 'PENDING' ? TEXT.statusPending : String(task.status || TEXT.dash)
    );
    statusTd.appendChild(statusBadge);
    if (task.selfService) {
      statusTd.appendChild(ce('span', 'oa-pa-badge-self', TEXT.selfService));
    }

    const dateTd = ce('td', null, task.createdAt ? formatFaDate(task.createdAt) : TEXT.dash);

    tr.append(rowNum, titleTd, procTd, formTd, assignTd, statusTd, dateTd);

    // Open the «انجام کار» dialog: double-click (host «جاری» muscle memory)
    // or keyboard: focus the row and press Enter. Single click just selects.
    tr.title =
      (task.description ? task.description + '\n\n' : '') + TEXT.dblClickHint;
    tr.tabIndex = 0;
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('.oa-pa-row-selected').forEach((r) => {
        r.classList.remove('oa-pa-row-selected');
      });
      tr.classList.add('oa-pa-row-selected');
    });
    tr.addEventListener('dblclick', () => {
      if (onOpenTaskCallback) onOpenTaskCallback(task);
    });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (onOpenTaskCallback) onOpenTaskCallback(task);
      }
    });
    tbody.appendChild(tr);
  });
}

function renderPager(totalCount) {
  const tableWrap = rootEl()?.querySelector('.oa-pa-grid-tablewrap');
  const pager = document.getElementById('oa-pa-grid-pager');
  const info = document.getElementById('oa-pa-pager-info');
  const pageEl = document.getElementById('oa-pa-pager-page');
  const prev = document.getElementById('oa-pa-pager-prev');
  const next = document.getElementById('oa-pa-pager-next');
  if (!pager || !info || !pageEl || !prev || !next) return;

  const pages = Math.max(1, Math.ceil(totalCount / API.tasksPageSize));
  if (state.page > pages) state.page = pages; // search shrank the result set
  const from = (state.page - 1) * API.tasksPageSize + 1;
  const to = Math.min(state.page * API.tasksPageSize, totalCount);

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

async function loadTasks() {
  if (!getAuthSession()) return; // defensive — sidebar hides this path
  showMessage('loading');
  try {
    const res = await fetchMyTasks({
      page: state.page,
      search: state.search,
    });
    lastTotal = res.totalCount;

    // Keep the sidebar badge + toolbar count in sync with the source of truth.
    setSidebarBadge(res.totalCount);
    const countEl = rootEl()?.querySelector('.oa-pa-grid-count');
    if (countEl) countEl.textContent = TEXT.gridCount(faNum(res.totalCount));

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
      // Dead/expired session: full cleanup (main.js), then ask for re-login.
      if (onSessionExpiredCallback) onSessionExpiredCallback();
      showMessage('expired');
      return;
    }
    showMessage('error', err);
  }
}

/* ============================ Host integration ============================== */

/**
 * Watches #bodyContainer: when the host SPA replaces the content (the user
 * clicked جاری / پیگیری / ...), our grid disappears — deselect our sidebar
 * item, exactly like the host deselects its own items on navigation.
 * Our own re-renders only touch the grid's INSIDE, so the root element
 * never "disappears" for them.
 */
function watchHostTakeover() {
  const host = document.getElementById('bodyContainer');
  if (!host || hostObserver) return;
  hostObserver = new MutationObserver(() => {
    if (!document.getElementById(IDS.grid)) {
      stopWatchHostTakeover();
      // Only OUR item — the cases grid may have just taken over the slot
      // and selected its own item; that selection must survive.
      deselectSidebarItem('tasks');
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
export function injectTasksGrid(deps) {
  if (deps) {
    if (typeof deps.onRelogin === 'function') onReloginCallback = deps.onRelogin;
    if (typeof deps.onSessionExpired === 'function') {
      onSessionExpiredCallback = deps.onSessionExpired;
    }
    if (typeof deps.onOpenTask === 'function') onOpenTaskCallback = deps.onOpenTask;
  }
}

/**
 * Opens the tasks grid inside #bodyContainer (replacing whatever the host
 * shows there — the host reclaims the slot whenever the user navigates).
 * Re-clicking the sidebar item refreshes the data.
 */
export async function openTasksGrid() {
  if (!getAuthSession()) return;
  const host = document.getElementById('bodyContainer');
  if (!host) return; // no content slot → stay quiet

  let root = document.getElementById(IDS.grid);
  if (!root) {
    root = buildGrid();
    // Replace the host content — same thing the host SPA does on nav.
    host.replaceChildren(root);
    state.page = 1;
  }
  selectSidebarItem('tasks');
  watchHostTakeover();
  await loadTasks();
}

/**
 * Reloads the current page of the grid (keeps search + pagination state).
 * Called by main.js after the «انجام کار» dialog completed (or conflicted)
 * a task — the task leaves the کارتابل, badge + pager counts re-sync.
 */
export function refreshTasksGrid() {
  if (!document.getElementById(IDS.grid)) return; // grid not open
  return loadTasks();
}

/** Cleanup for full deactivation (main.js → removeAll). */
export function disposeTasksGrid() {
  clearTimeout(searchTimer);
  searchTimer = null;
  stopWatchHostTakeover();
  const root = document.getElementById(IDS.grid);
  if (root) root.remove();
  // NOTE: the host always re-renders its own content into #bodyContainer on
  // navigation, so leaving the slot empty here is safe.
}
