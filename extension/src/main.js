/**
 * main.js — composition root & lifecycle.
 * -----------------------------------------
 * Wires the modules together (dependency injection keeps the import graph
 * acyclic) and owns the lifecycle.
 *
 * v1.9 wiring (draft-first start):
 *   header «جریان کار جدید» → openStartDialog → createDraft → openDraftDialog
 *   sidebar «پیش‌نویس‌ها» → openDraftsGrid
 *   draft submit → refresh tasks badge + drafts grid
 */

import { IDS } from './config.js';
import { isTargetPage } from './url-gate.js';
import { ensureStyles } from './styles.js';
import { injectHeaderButton, syncButtonState } from './header-button.js';
import { injectModal, openModal, disposeModal } from './modal.js';
import { cleanupLegacyCredentials } from './storage.js';
import { getAuthSession, clearAuthSession } from './api.js';
import {
  injectSidebarItem,
  removeSidebarItem,
  refreshSidebarBadge,
} from './sidebar.js';
import {
  injectTasksGrid,
  openTasksGrid,
  refreshTasksGrid,
  disposeTasksGrid,
} from './tasks-grid.js';
import {
  injectCasesGrid,
  openCasesGrid,
  disposeCasesGrid,
} from './cases-grid.js';
import {
  injectDraftsGrid,
  openDraftsGrid,
  refreshDraftsGrid,
  disposeDraftsGrid,
} from './drafts-grid.js';
import {
  injectStartDialog,
  openStartDialog,
  disposeStartDialog,
} from './start-dialog.js';
import {
  injectTaskDialog,
  openTaskDialog,
  disposeTaskDialog,
} from './task-dialog.js';
import {
  injectDraftDialog,
  openDraftDialog,
  disposeDraftDialog,
} from './draft-dialog.js';

/* ============================ Session events =============================== */

function onSessionChange() {
  syncButtonState();
  if (getAuthSession()) {
    injectSidebarItem();
    refreshSidebarBadge();
  } else {
    removeSidebarItem();
  }
}

function onSessionExpired() {
  clearAuthSession();
  syncButtonState();
  removeSidebarItem();
}

/* ============================== Injection ================================== */

function onLogout() {
  clearAuthSession();
  disposeTasksGrid();
  disposeCasesGrid();
  disposeDraftsGrid();
  onSessionChange();
}

function injectAll() {
  if (!document.body) return;
  ensureStyles();
  injectHeaderButton(openModal, openStartDialog, onLogout);
  injectModal({ onSaved: onSessionChange });
  injectTasksGrid({
    onRelogin: openModal,
    onSessionExpired: onSessionExpired,
    onOpenTask: openTaskDialog,
  });
  injectCasesGrid({
    onRelogin: openModal,
    onSessionExpired: onSessionExpired,
  });
  injectDraftsGrid({
    onRelogin: openModal,
    onSessionExpired: onSessionExpired,
    onOpenDraft: openDraftDialog,
  });
  injectStartDialog({
    onSessionExpired: onSessionExpired,
    onRelogin: openModal,
    onDraftCreated: (draft) => {
      if (draft && draft.id) openDraftDialog(draft.id);
      refreshDraftsGrid();
    },
  });
  injectTaskDialog({
    onCompleted: refreshTasksGrid,
    onSessionExpired: onSessionExpired,
    onRelogin: openModal,
  });
  injectDraftDialog({
    onSubmitted: () => {
      refreshTasksGrid();
      refreshSidebarBadge(true);
      refreshDraftsGrid();
    },
    onDiscarded: refreshDraftsGrid,
    onSessionExpired: onSessionExpired,
    onRelogin: openModal,
  });
  injectSidebarItem({
    onOpen: openTasksGrid,
    onOpenCases: openCasesGrid,
    onOpenDrafts: openDraftsGrid,
    onSessionExpired: onSessionExpired,
  });
  if (getAuthSession()) {
    refreshSidebarBadge();
  }
}

function removeAll() {
  disposeModal();
  disposeTaskDialog();
  disposeDraftDialog();
  disposeTasksGrid();
  disposeCasesGrid();
  disposeDraftsGrid();
  disposeStartDialog();
  for (const id of [IDS.section, IDS.overlay, IDS.style]) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
  removeSidebarItem();
}

/* ============================== Lifecycle ================================ */

let active = false;
let domObserver = null;
let urlWatcher = null;
let lastHref = location.href;

function startDomObserver() {
  if (domObserver) return;
  domObserver = new MutationObserver(() => {
    if (!active) return;
    const buttonGone = !document.getElementById(IDS.button);
    const modalGone = !document.getElementById(IDS.overlay);
    const session = getAuthSession();
    const sidebarGone =
      !!session &&
      (!document.getElementById(IDS.sidebarItem) ||
        !document.getElementById(IDS.sidebarCasesItem) ||
        !document.getElementById(IDS.sidebarDraftsItem));
    const startButtonGone =
      !!session && !document.getElementById(IDS.startButton);
    if (buttonGone || modalGone || sidebarGone || startButtonGone) injectAll();
  });
  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopDomObserver() {
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
}

function setActive(state) {
  if (state === active) return;
  active = state;
  if (state) {
    injectAll();
    startDomObserver();
  } else {
    stopDomObserver();
    removeAll();
  }
}

function startUrlWatcher() {
  if (urlWatcher) return;
  urlWatcher = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setActive(isTargetPage());
    }
  }, 500);
}

function boot() {
  lastHref = location.href;
  cleanupLegacyCredentials();
  setActive(isTargetPage());
  startUrlWatcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
