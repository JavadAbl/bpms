/**
 * drafts-grid.js — the «پیش‌نویس‌ها» drafts list (v1.9).
 * -----------------------------------------------------
 * Renders GET /api/process-drafts inside #bodyContainer. Double-click opens
 * the draft form dialog.
 */

import { IDS, TEXT, API } from './config.js';
import { getAuthSession, ApiError } from './api.js';
import { fetchDrafts } from './drafts.js';
import { selectSidebarItem, deselectSidebarItem } from './sidebar.js';
import { ce, formatFaDate, faNum } from './utils.js';

let onReloginCallback = null;
let onSessionExpiredCallback = null;
let onOpenDraftCallback = null;
let hostObserver = null;
let searchTimer = null;
let lastTotal = 0;

const state = { page: 1, search: '' };

function rootEl() {
  return document.getElementById(IDS.draftsGrid);
}

function buildGrid() {
  const root = document.createElement('div');
  root.id = IDS.draftsGrid;
  root.className = 'oa-pa-grid';
  root.dir = 'rtl';

  const toolbar = ce('div', 'oa-pa-grid-toolbar');
  const titleWrap = ce('div', 'oa-pa-grid-title-wrap');
  titleWrap.append(
    ce('span', 'oa-pa-grid-title', TEXT.draftsGridTitle),
    ce('span', 'oa-pa-grid-subtitle', TEXT.draftsGridSubtitle),
    ce('span', 'oa-pa-grid-count'),
    ce('span', 'oa-pa-grid-hint', TEXT.draftsOpenHint),
  );

  const actions = ce('div', 'oa-pa-grid-actions');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'oa-pa-grid-search';
  search.placeholder = TEXT.draftsSearchPh;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = search.value.trim();
      state.page = 1;
      loadDrafts();
    }, 400);
  });
  const refresh = ce('button', 'oa-pa-grid-refresh', TEXT.refresh);
  refresh.type = 'button';
  refresh.addEventListener('click', () => loadDrafts());
  actions.append(search, refresh);
  toolbar.append(titleWrap, actions);

  const message = ce('div', 'oa-pa-grid-message oa-pa-hidden');
  message.id = 'oa-pa-drafts-message';

  const tableWrap = ce('div', 'oa-pa-grid-tablewrap oa-pa-hidden');
  const table = document.createElement('table');
  table.className = 'oa-pa-grid-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    TEXT.draftsColRow,
    TEXT.draftsColProcess,
    TEXT.draftsColTask,
    TEXT.draftsColUpdated,
  ].forEach((label) => headRow.appendChild(ce('th', null, label)));
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  tbody.id = 'oa-pa-drafts-tbody';
  table.append(thead, tbody);
  tableWrap.appendChild(table);

  const pager = ce('div', 'oa-pa-grid-pager oa-pa-hidden');
  pager.id = 'oa-pa-drafts-pager';
  const pagerInfo = ce('span', 'oa-pa-pager-info');
  pagerInfo.id = 'oa-pa-drafts-pager-info';
  const pagerPage = ce('span', 'oa-pa-pager-page');
  pagerPage.id = 'oa-pa-drafts-pager-page';
  const pagerBtns = ce('div', 'oa-pa-pager-btns');
  const prev = ce('button', 'oa-pa-pager-prev', TEXT.pagerPrev);
  prev.type = 'button';
  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadDrafts();
    }
  });
  const next = ce('button', 'oa-pa-pager-next', TEXT.pagerNext);
  next.type = 'button';
  next.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(lastTotal / API.draftsPageSize));
    if (state.page < pages) {
      state.page += 1;
      loadDrafts();
    }
  });
  pagerBtns.append(prev, next);
  pager.append(pagerInfo, pagerPage, pagerBtns);

  root.append(toolbar, message, tableWrap, pager);
  return root;
}

function showMessage(kind, err) {
  const root = rootEl();
  const message = document.getElementById('oa-pa-drafts-message');
  const tableWrap = root && root.querySelector('.oa-pa-grid-tablewrap');
  const pager = document.getElementById('oa-pa-drafts-pager');
  if (!message) return;
  message.classList.remove('oa-pa-hidden', 'oa-pa-msg-error');
  message.textContent = '';
  if (tableWrap) tableWrap.classList.add('oa-pa-hidden');
  if (pager) pager.classList.add('oa-pa-hidden');

  if (kind === 'loading') {
    message.append(ce('span', 'oa-pa-spinner'), document.createTextNode(TEXT.draftsLoading));
  } else if (kind === 'empty') {
    message.textContent = TEXT.draftsEmpty;
  } else if (kind === 'error') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.draftsErrorLoad;
    const actions = ce('div', 'oa-pa-msg-actions');
    const retry = ce('button', 'oa-pa-msg-btn', TEXT.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => loadDrafts());
    actions.appendChild(retry);
    message.appendChild(actions);
    if (err) console.warn('[OA Process Activation] drafts grid error:', err.message);
  } else if (kind === 'expired') {
    message.classList.add('oa-pa-msg-error');
    message.textContent = TEXT.sessionExpired;
    const actions = ce('div', 'oa-pa-msg-actions');
    const loginBtn = ce('button', 'oa-pa-msg-btn', TEXT.loginAgain);
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', () => onReloginCallback && onReloginCallback());
    actions.appendChild(loginBtn);
    message.appendChild(actions);
  }
}

function hideMessage() {
  const message = document.getElementById('oa-pa-drafts-message');
  if (message) {
    message.classList.add('oa-pa-hidden');
    message.classList.remove('oa-pa-msg-error');
    message.textContent = '';
  }
}

function renderRows(items) {
  const tbody = document.getElementById('oa-pa-drafts-tbody');
  const root = rootEl();
  const tableWrap = root && root.querySelector('.oa-pa-grid-tablewrap');
  if (!tbody) return;
  tbody.textContent = '';
  const offset = (state.page - 1) * API.draftsPageSize;
  items.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.setAttribute('data-draft-id', String(d.id || ''));
    tr.append(
      ce('td', null, faNum(offset + i + 1)),
      ce('td', null, String((d.process && d.process.name) || TEXT.dash)),
      ce('td', null, String(d.firstTaskName || TEXT.dash)),
      ce('td', null, formatFaDate(d.updatedAt) || TEXT.dash),
    );
    const open = () => {
      if (onOpenDraftCallback) onOpenDraftCallback(d.id);
    };
    tr.addEventListener('dblclick', open);
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        open();
      }
    });
    tbody.appendChild(tr);
  });
  if (tableWrap) tableWrap.classList.remove('oa-pa-hidden');
}

function updatePager(total) {
  lastTotal = total;
  const pager = document.getElementById('oa-pa-drafts-pager');
  const info = document.getElementById('oa-pa-drafts-pager-info');
  const pageEl = document.getElementById('oa-pa-drafts-pager-page');
  const root = rootEl();
  const countEl = root && root.querySelector('.oa-pa-grid-count');
  if (countEl) countEl.textContent = TEXT.draftsGridCount(faNum(total));
  if (!pager) return;
  if (total <= 0) {
    pager.classList.add('oa-pa-hidden');
    return;
  }
  pager.classList.remove('oa-pa-hidden');
  const pageSize = API.draftsPageSize;
  const from = (state.page - 1) * pageSize + 1;
  const to = Math.min(state.page * pageSize, total);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (info) info.textContent = TEXT.pagerInfo(faNum(from), faNum(to), faNum(total));
  if (pageEl) pageEl.textContent = TEXT.pagerPage(faNum(state.page), faNum(pages));
}

async function loadDrafts() {
  if (!getAuthSession()) {
    showMessage('expired');
    return;
  }
  showMessage('loading');
  try {
    const res = await fetchDrafts({
      page: state.page,
      pageSize: API.draftsPageSize,
      search: state.search || undefined,
    });
    if (!rootEl()) return;
    // Client-side filter if backend has no searchable fields on drafts
    let items = res.items;
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter((d) => {
        const hay = [d.process && d.process.name, d.firstTaskName]
          .map((x) => String(x || '').toLowerCase());
        return hay.some((h) => h.includes(q));
      });
    }
    if (!items.length) {
      showMessage('empty');
      updatePager(0);
      return;
    }
    hideMessage();
    renderRows(items);
    updatePager(state.search ? items.length : res.totalCount);
  } catch (err) {
    if (!rootEl()) return;
    if (err instanceof ApiError && (err.status === 401 || err.kind === 'no-session')) {
      if (onSessionExpiredCallback) onSessionExpiredCallback();
      showMessage('expired');
      return;
    }
    showMessage('error', err);
  }
}

function watchHostTakeover() {
  if (hostObserver) hostObserver.disconnect();
  const body = document.getElementById('bodyContainer');
  if (!body) return;
  hostObserver = new MutationObserver(() => {
    if (!document.getElementById(IDS.draftsGrid)) {
      deselectSidebarItem('drafts');
      if (hostObserver) {
        hostObserver.disconnect();
        hostObserver = null;
      }
    }
  });
  hostObserver.observe(body, { childList: true });
}

export function injectDraftsGrid(deps) {
  if (deps) {
    if (typeof deps.onRelogin === 'function') onReloginCallback = deps.onRelogin;
    if (typeof deps.onSessionExpired === 'function') {
      onSessionExpiredCallback = deps.onSessionExpired;
    }
    if (typeof deps.onOpenDraft === 'function') onOpenDraftCallback = deps.onOpenDraft;
  }
}

export function openDraftsGrid() {
  const body = document.getElementById('bodyContainer');
  if (!body) return;
  selectSidebarItem('drafts');
  body.textContent = '';
  body.appendChild(buildGrid());
  state.page = 1;
  state.search = '';
  loadDrafts();
  watchHostTakeover();
}

export function refreshDraftsGrid() {
  if (rootEl()) loadDrafts();
}

export function disposeDraftsGrid() {
  if (hostObserver) {
    hostObserver.disconnect();
    hostObserver = null;
  }
  const el = rootEl();
  if (el) el.remove();
}
