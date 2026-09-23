/**
 * header-button.js — the OA header buttons.
 * -------------------------------------------
 * Two buttons are prepended as the first children of
 * #header-userinfo-inner (ahead of profile / settings / notifications /
 * sign-out; falls back to before #header-userinfo, then to floating):
 *   1. «فعال سازی فرآیند» / «خروج» — login when logged out, logout when
 *      a session is active.
 *   2. «جریان کار جدید» (v1.8) — starts a new case (opens the start
 *      dialog); visible ONLY while a login session exists, mirroring the
 *      sidebar items' login gating.
 *
 * Host layout (_Layout.css): #header-userinfo is a fixed-width table-cell
 * (320px) with overflow:hidden; #header-userinfo-inner is inline-table and
 * its direct children are table-cells. Inline buttons stay table-cells, and
 * fitUserinfoWidth() widens #header-userinfo to the row's natural width so
 * the host icons are not clipped.
 *
 * Dependency injection: click handlers are passed in by main.js so this
 * module never imports modal.js / start-dialog.js (no circular imports).
 */

import { IDS, TEXT, BOLT_SVG } from './config.js';
import { getAuthSession } from './api.js';
import { ce } from './utils.js';

let onLoginCallback = null;
let onLogoutCallback = null;
let onStartCallback = null;

function buildHeaderButton(onClick, id, label, title, opts) {
  const o = opts || {};
  const section = document.createElement('div');
  section.id = o.sectionId;
  // Outer header slot uses the host's header-section class; when inlined
  // into #header-userinfo-inner we use oa-pa-inline-item so host
  // `#header-userinfo-inner > * { display: table-cell }` still applies.
  section.className = o.inline ? 'oa-pa-inline-item' : 'header-section';
  section.dir = 'rtl';

  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.className = 'oa-pa-btn' + (o.startClass ? ' ' + o.startClass : '');
  btn.title = title;

  const icon = document.createElement('span');
  icon.className = 'oa-pa-btn-icon';
  icon.innerHTML = BOLT_SVG; // static string — safe

  const labelEl = ce('span', 'oa-pa-label headbar-item-text', label);

  btn.append(icon, labelEl);
  btn.addEventListener('click', onClick);
  section.appendChild(btn);
  return section;
}

function onAuthButtonClick() {
  if (getAuthSession()) {
    if (onLogoutCallback) onLogoutCallback();
  } else if (onLoginCallback) {
    onLoginCallback();
  }
}

/**
 * Insert `section` into the host header.
 * Preferred: prepend into #header-userinfo-inner (first children).
 */
function placeInHeader(section, beforeEl, header, userinfo) {
  const inner =
    (header && header.querySelector('#header-userinfo-inner')) ||
    document.querySelector('#header-userinfo-inner');

  if (inner) {
    section.className = 'oa-pa-inline-item';
    const before =
      beforeEl && beforeEl.parentNode === inner
        ? beforeEl
        : inner.firstChild;
    if (before) {
      inner.insertBefore(section, before);
    } else {
      inner.appendChild(section);
    }
    return;
  }

  if (header) {
    header.insertBefore(section, userinfo || null);
    return;
  }

  section.classList.add('oa-pa-floating');
  document.body.appendChild(section);
}

const DESKTOP_MQ = '(min-width: 768px)';
let fitObserver = null;

/**
 * Grow #header-userinfo to the natural width of #header-userinfo-inner.
 * The host cell is a fixed 320px with overflow:hidden, so without this the
 * extra buttons push the host icons out of view. Desktop only — the host's
 * mobile layout sets its own width.
 */
function fitUserinfoWidth() {
  const userinfo = document.getElementById('header-userinfo');
  const inner = document.getElementById('header-userinfo-inner');
  if (!userinfo || !inner || !inner.querySelector('.oa-pa-inline-item')) return;

  if (!window.matchMedia(DESKTOP_MQ).matches) {
    userinfo.style.removeProperty('width');
    return;
  }
  const natural = inner.offsetWidth;
  if (!natural) return;
  userinfo.style.setProperty('width', Math.max(320, natural + 4) + 'px', 'important');
}

function watchUserinfoWidth() {
  const inner = document.getElementById('header-userinfo-inner');
  if (!inner || fitObserver) return;
  if (typeof ResizeObserver === 'function') {
    fitObserver = new ResizeObserver(fitUserinfoWidth);
    fitObserver.observe(inner);
  }
  window.addEventListener('resize', fitUserinfoWidth);
}

/**
 * Injects the buttons if not already present.
 * `onLogin` — login modal opener; `onStart` — start dialog opener;
 * `onLogout` — session clear / cleanup (all injected by main.js).
 */
export function injectHeaderButton(onLogin, onStart, onLogout) {
  if (!document.body) return false;
  if (typeof onLogin === 'function') onLoginCallback = onLogin;
  if (typeof onStart === 'function') onStartCallback = onStart;
  if (typeof onLogout === 'function') onLogoutCallback = onLogout;

  const header = document.querySelector('header.content-wrapper');
  const userinfo = header ? header.querySelector('#header-userinfo') : null;
  const inner = header
    ? header.querySelector('#header-userinfo-inner')
    : document.querySelector('#header-userinfo-inner');

  if (!document.getElementById(IDS.button)) {
    const section = buildHeaderButton(
      onAuthButtonClick,
      IDS.button,
      TEXT.buttonLabel,
      TEXT.buttonTitle,
      { sectionId: IDS.section, inline: !!inner }
    );
    placeInHeader(section, inner ? inner.firstChild : null, header, userinfo);
  }

  if (!document.getElementById(IDS.startButton)) {
    const section = buildHeaderButton(
      () => onStartCallback && onStartCallback(),
      IDS.startButton,
      TEXT.sidebarStartLabel,
      TEXT.sidebarStartTitle,
      { sectionId: IDS.startSection, startClass: 'oa-pa-btn-start', inline: !!inner }
    );
    // Immediately before the auth button — both stay first in the row.
    const loginSection = document.getElementById(IDS.section);
    const before =
      loginSection && loginSection.parentNode
        ? loginSection
        : inner
          ? inner.firstChild
          : null;
    placeInHeader(section, before, header, userinfo);
  }
  syncButtonState();
  watchUserinfoWidth();
  return true;
}

/**
 * Syncs both buttons with the session state:
 *   - auth button: «فعال سازی فرآیند» when logged out, «خروج» when logged in;
 *   - start button: visible ONLY while logged in (login-gated, like the
 *     sidebar items).
 */
export function syncButtonState() {
  const loginSection = document.getElementById(IDS.section);
  const loginBtn = document.getElementById(IDS.button);
  const startSection = document.getElementById(IDS.startSection);
  const startBtn = document.getElementById(IDS.startButton);
  const session = getAuthSession();

  if (loginSection && loginBtn) {
    const labelEl = loginBtn.querySelector('.oa-pa-label');
    if (session) {
      loginSection.classList.add('oa-pa-active');
      if (labelEl) labelEl.textContent = TEXT.buttonLogoutLabel;
      loginBtn.title = TEXT.buttonTitleSession(
        session.name || session.username || '',
        session.username || session.email || ''
      );
    } else {
      loginSection.classList.remove('oa-pa-active');
      if (labelEl) labelEl.textContent = TEXT.buttonLabel;
      loginBtn.title = TEXT.buttonTitle;
    }
  }

  if (startSection && startBtn) {
    startSection.classList.toggle('oa-pa-hidden', !session);
    if (session) {
      startBtn.title = TEXT.sidebarStartTitle;
    }
  }
  fitUserinfoWidth();
}
