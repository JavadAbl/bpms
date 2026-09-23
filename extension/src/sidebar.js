/**
 * sidebar.js — BPMS nav items under a «جریان کار» section.
 * ----------------------------------------------------------------
 * Injects a section divider + three menu items that mimic the OA
 * navigation panel into desktop (nav#oa-nav dl.arrows-left) and mobile
 * (#CardtablPanel). Items exist ONLY while a BPMS login session is active.
 *
 * Order: کارتابل → پیش‌نویس → سوابق کارتابل
 */

import { IDS, TEXT } from './config.js';
import { getAuthSession, fetchMyTasks, ApiError } from './api.js';
import { ce, faNum } from './utils.js';

let onOpenCallback = null;
let onOpenCasesCallback = null;
let onOpenDraftsCallback = null;
let onSessionExpiredCallback = null;
let lastBadgeFetchAt = 0;

function buildItemAnchor(mobile, opts) {
  const a = document.createElement('a');
  a.className =
    'item-title oa-pa-sidebar-link' + (opts.badge ? ' with-count' : '');
  a.setAttribute('data-title', opts.label);
  a.setAttribute('href', '');
  a.setAttribute('onclick', 'return false;');
  a.title = opts.title;

  const wrap = document.createElement('div');
  const title = ce('span', 'title', opts.label);
  wrap.appendChild(title);
  if (opts.badge) {
    // Same shape as host (_NavigationPanel.css): title + .unread-count
    // as table-cells. Light/dark themes style it as a 50px gray pill.
    wrap.appendChild(ce('span', 'unread-count oa-pa-sidebar-badge'));
  }
  a.appendChild(wrap);

  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (!mobile) e.stopPropagation();
    if (opts.onOpen) opts.onOpen();
  });
  return a;
}

function buildDesktopItem(opts) {
  const dt = document.createElement('dt');
  dt.id = opts.id;
  // Host `empty` = no expandable children (hides the arrow). Our items
  // have no submenu, so always empty.
  dt.className = 'item empty oa-pa-sidebar-item';
  dt.setAttribute('data-menuitemindex', opts.index);
  dt.setAttribute('data-filter-entitytype', 'all');
  dt.setAttribute('data-cardtable-type', opts.cardtableType);
  dt.setAttribute('data-title', opts.label);
  const arrow = ce('span', 'arrow-holder');
  dt.append(arrow, buildItemAnchor(false, opts));
  return dt;
}

function buildMobileItem(opts) {
  const div = document.createElement('div');
  div.id = opts.mobileId;
  div.className = 'item empty oa-pa-sidebar-item';
  div.setAttribute('data-menuitemindex', opts.index);
  div.setAttribute('data-filter-entitytype', 'all');
  div.setAttribute('data-cardtable-type', opts.cardtableType);
  div.setAttribute('data-objectlistmode-mobile', opts.cardtableType);
  div.appendChild(buildItemAnchor(true, opts));
  return div;
}

function buildDesktopSection() {
  const dt = document.createElement('dt');
  dt.id = IDS.sidebarSection;
  dt.className = 'oa-pa-sidebar-section';
  dt.setAttribute('aria-hidden', 'true');
  const title = ce('span', 'oa-pa-sidebar-section-title', TEXT.sidebarSectionTitle);
  dt.appendChild(title);
  return dt;
}

function buildMobileSection() {
  const div = document.createElement('div');
  div.id = IDS.sidebarSectionMobile;
  div.className = 'oa-pa-sidebar-section';
  div.setAttribute('aria-hidden', 'true');
  div.appendChild(
    ce('span', 'oa-pa-sidebar-section-title', TEXT.sidebarSectionTitle)
  );
  return div;
}

function desktopList() {
  return (
    document.querySelector('nav#oa-nav dl.arrows-left') ||
    document.querySelector('dl.arrows-left')
  );
}

function mobilePanel() {
  return (
    document.querySelector('#mobile-oa-nav-parent #CardtablPanel') ||
    document.querySelector('#CardtablPanel')
  );
}

/** Ensures each BPMS <dt> is followed by an empty hidden <dd> like host items. */
function ensureDesktopDd(desktopId) {
  if (document.querySelector('dd[data-oa-pa-for="' + desktopId + '"]')) return;
  const dt = document.getElementById(desktopId);
  if (!dt || !dt.parentNode) return;
  const dd = document.createElement('dd');
  dd.className = 'hidden';
  dd.setAttribute('data-oa-pa-for', desktopId);
  dt.parentNode.insertBefore(dd, dt.nextSibling);
}

function ensureItem(desktopId, mobileId, opts) {
  if (!document.getElementById(desktopId)) {
    const dl = desktopList();
    if (dl) {
      dl.appendChild(buildDesktopItem(opts));
      const dd = document.createElement('dd');
      dd.className = 'hidden';
      dd.setAttribute('data-oa-pa-for', desktopId);
      dl.appendChild(dd);
    }
  } else {
    ensureDesktopDd(desktopId);
  }
  if (!document.getElementById(mobileId)) {
    const panel = mobilePanel();
    if (panel) panel.appendChild(buildMobileItem(opts));
  }
}

function ensureSection() {
  if (!document.getElementById(IDS.sidebarSection)) {
    const dl = desktopList();
    if (dl) {
      dl.appendChild(buildDesktopSection());
      const dd = document.createElement('dd');
      dd.className = 'hidden';
      dd.setAttribute('data-oa-pa-for', IDS.sidebarSection);
      dl.appendChild(dd);
    }
  } else {
    ensureDesktopDd(IDS.sidebarSection);
  }
  if (!document.getElementById(IDS.sidebarSectionMobile)) {
    const panel = mobilePanel();
    if (panel) panel.appendChild(buildMobileSection());
  }
}

/**
 * Desired DOM order after host items:
 *   section → کارتابل → پیش‌نویس → سوابق کارتابل
 * (each desktop <dt> paired with its hidden <dd>).
 */
function reorderSidebar() {
  const dl = desktopList();
  if (dl) {
    const desktopOrder = [
      IDS.sidebarSection,
      IDS.sidebarItem,
      IDS.sidebarDraftsItem,
      IDS.sidebarCasesItem,
    ];
    for (const id of desktopOrder) {
      const dt = document.getElementById(id);
      if (!dt) continue;
      dl.appendChild(dt);
      const dd = document.querySelector('dd[data-oa-pa-for="' + id + '"]');
      if (dd) dl.appendChild(dd);
    }
  }

  const panel = mobilePanel();
  if (panel) {
    const mobileOrder = [
      IDS.sidebarSectionMobile,
      IDS.sidebarItemMobile,
      IDS.sidebarDraftsItemMobile,
      IDS.sidebarCasesItemMobile,
    ];
    for (const id of mobileOrder) {
      const el = document.getElementById(id);
      if (el) panel.appendChild(el);
    }
  }
}

/** Sync labels/titles on already-injected items after a rename. */
function syncItemLabels(desktopId, mobileId, label, title, withCount) {
  for (const id of [desktopId, mobileId]) {
    const item = document.getElementById(id);
    if (!item) continue;
    item.setAttribute('data-title', label);
    const link = item.querySelector('.oa-pa-sidebar-link');
    if (link) {
      link.setAttribute('data-title', label);
      link.title = title;
      if (withCount) link.classList.add('with-count');
      else link.classList.remove('with-count');
    }
    const titleEl = item.querySelector('.title');
    if (titleEl) titleEl.textContent = label;
  }
}

function repairSidebarBadges() {
  document.querySelectorAll('.oa-pa-sidebar-item').forEach((item) => {
    item.classList.add('empty');
    const link = item.querySelector('.oa-pa-sidebar-link');
    const badge = item.querySelector('.oa-pa-sidebar-badge');
    if (!badge && link) link.classList.remove('with-count');
    if (badge) badge.classList.remove('oa-pa-hidden');
  });
  const secTitle = document.querySelectorAll('.oa-pa-sidebar-section-title');
  secTitle.forEach((el) => {
    el.textContent = TEXT.sidebarSectionTitle;
  });
}

export function injectSidebarItem(deps) {
  if (!document.body) return false;
  if (deps) {
    if (typeof deps.onOpen === 'function') onOpenCallback = deps.onOpen;
    if (typeof deps.onOpenCases === 'function') {
      onOpenCasesCallback = deps.onOpenCases;
    }
    if (typeof deps.onOpenDrafts === 'function') {
      onOpenDraftsCallback = deps.onOpenDrafts;
    }
    if (typeof deps.onSessionExpired === 'function') {
      onSessionExpiredCallback = deps.onSessionExpired;
    }
  }

  if (!getAuthSession()) {
    removeSidebarItem();
    return false;
  }

  const tasksOpts = {
    id: IDS.sidebarItem,
    mobileId: IDS.sidebarItemMobile,
    index: '99',
    cardtableType: 'BpmsTasks',
    label: TEXT.sidebarLabel,
    title: TEXT.sidebarTitle,
    badge: true,
    onOpen: () => onOpenCallback && onOpenCallback(),
  };
  const draftsOpts = {
    id: IDS.sidebarDraftsItem,
    mobileId: IDS.sidebarDraftsItemMobile,
    index: '100',
    cardtableType: 'BpmsDrafts',
    label: TEXT.sidebarDraftsLabel,
    title: TEXT.sidebarDraftsTitle,
    badge: false,
    onOpen: () => onOpenDraftsCallback && onOpenDraftsCallback(),
  };
  const casesOpts = {
    id: IDS.sidebarCasesItem,
    mobileId: IDS.sidebarCasesItemMobile,
    index: '101',
    cardtableType: 'BpmsCases',
    label: TEXT.sidebarCasesLabel,
    title: TEXT.sidebarCasesTitle,
    badge: false,
    onOpen: () => onOpenCasesCallback && onOpenCasesCallback(),
  };

  ensureSection();
  ensureItem(IDS.sidebarItem, IDS.sidebarItemMobile, tasksOpts);
  ensureItem(IDS.sidebarDraftsItem, IDS.sidebarDraftsItemMobile, draftsOpts);
  ensureItem(IDS.sidebarCasesItem, IDS.sidebarCasesItemMobile, casesOpts);

  syncItemLabels(
    IDS.sidebarItem,
    IDS.sidebarItemMobile,
    TEXT.sidebarLabel,
    TEXT.sidebarTitle,
    true
  );
  syncItemLabels(
    IDS.sidebarDraftsItem,
    IDS.sidebarDraftsItemMobile,
    TEXT.sidebarDraftsLabel,
    TEXT.sidebarDraftsTitle,
    false
  );
  syncItemLabels(
    IDS.sidebarCasesItem,
    IDS.sidebarCasesItemMobile,
    TEXT.sidebarCasesLabel,
    TEXT.sidebarCasesTitle,
    false
  );

  reorderSidebar();
  repairSidebarBadges();
  return true;
}

export function removeSidebarItem() {
  const ids = [
    IDS.sidebarSection,
    IDS.sidebarSectionMobile,
    IDS.sidebarItem,
    IDS.sidebarItemMobile,
    IDS.sidebarCasesItem,
    IDS.sidebarCasesItemMobile,
    IDS.sidebarDraftsItem,
    IDS.sidebarDraftsItemMobile,
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.remove();
    document
      .querySelectorAll('dd[data-oa-pa-for="' + id + '"]')
      .forEach((dd) => dd.remove());
  }
}

function itemIds(kind) {
  if (kind === 'tasks') return [IDS.sidebarItem, IDS.sidebarItemMobile];
  if (kind === 'cases') return [IDS.sidebarCasesItem, IDS.sidebarCasesItemMobile];
  if (kind === 'drafts') return [IDS.sidebarDraftsItem, IDS.sidebarDraftsItemMobile];
  return [
    IDS.sidebarItem,
    IDS.sidebarItemMobile,
    IDS.sidebarCasesItem,
    IDS.sidebarCasesItemMobile,
    IDS.sidebarDraftsItem,
    IDS.sidebarDraftsItemMobile,
  ];
}

export function selectSidebarItem(kind) {
  const mine = itemIds(kind);
  for (const id of mine) {
    const el = document.getElementById(id);
    if (el) el.classList.add('selected');
  }
  document
    .querySelectorAll('#oa-nav dt.item.selected, #CardtablPanel div.item.selected')
    .forEach((el) => {
      if (!mine.includes(el.id)) {
        el.classList.remove('selected');
      }
    });
}

export function deselectSidebarItem(kind) {
  for (const id of itemIds(kind)) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('selected');
  }
}

export function setSidebarBadge(count) {
  const badges = document.querySelectorAll('.oa-pa-sidebar-badge');
  const n = Number(count) || 0;
  badges.forEach((b) => {
    if (n > 0) {
      b.textContent = faNum(n);
      b.title = TEXT.badgeTitle(faNum(n));
    } else {
      b.textContent = '';
      b.removeAttribute('title');
    }
  });
}

export async function refreshSidebarBadge(force) {
  if (!getAuthSession()) return;
  const now = Date.now();
  if (!force && now - lastBadgeFetchAt < 30000) return;
  lastBadgeFetchAt = now;
  try {
    const res = await fetchMyTasks({ page: 1, pageSize: 1 });
    setSidebarBadge(res.totalCount);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 401 || err.kind === 'no-session')
    ) {
      if (onSessionExpiredCallback) onSessionExpiredCallback();
    }
  }
}
