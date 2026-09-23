/**
 * storage.js — remembered username (for prefill) + legacy cleanup.
 * ----------------------------------------------------------------
 * The login response (JWT) intentionally lives in sessionStorage — see
 * api.js. Only the last username is persisted in chrome.storage.local so the
 * modal can prefill it. The PASSWORD IS NEVER STORED.
 */

import {
  REMEMBERED_USERNAME_KEY,
  REMEMBERED_EMAIL_KEY,
  LEGACY_CREDENTIALS_KEY,
} from './config.js';

function hasChromeStorage() {
  try {
    return (
      typeof chrome !== 'undefined' &&
      !!(chrome.storage && chrome.storage.local)
    );
  } catch (e) {
    return false;
  }
}

/** Remembers the last login username (never the password). */
export async function saveRememberedUsername(username) {
  try {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [REMEMBERED_USERNAME_KEY]: username });
      await chrome.storage.local.remove(REMEMBERED_EMAIL_KEY);
    } else {
      try {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch (e) {
        /* private mode etc. — not critical */
      }
    }
  } catch (e) {
    /* storage failures must never break the login flow */
  }
}

/** Returns the last remembered username (or null). */
export async function loadRememberedUsername() {
  try {
    if (hasChromeStorage()) {
      const res = await chrome.storage.local.get([
        REMEMBERED_USERNAME_KEY,
        REMEMBERED_EMAIL_KEY,
      ]);
      const username = res && res[REMEMBERED_USERNAME_KEY];
      if (typeof username === 'string' && username) return username;
      // Migrate prefill from old email key (local-part before @)
      const legacy = res && res[REMEMBERED_EMAIL_KEY];
      if (typeof legacy === 'string' && legacy) {
        const at = legacy.indexOf('@');
        return at > 0 ? legacy.slice(0, at) : legacy;
      }
      return null;
    }
    return (
      localStorage.getItem(REMEMBERED_USERNAME_KEY) ||
      (() => {
        const legacy = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (!legacy) return null;
        const at = legacy.indexOf('@');
        return at > 0 ? legacy.slice(0, at) : legacy;
      })()
    );
  } catch (e) {
    return null;
  }
}

/**
 * One-time cleanup: v1.3 and earlier stored {username, password} under
 * LEGACY_CREDENTIALS_KEY. That is obsolete (we use the JWT now) — remove
 * the stored password from every store.
 */
export async function cleanupLegacyCredentials() {
  try {
    if (hasChromeStorage()) {
      await chrome.storage.local.remove(LEGACY_CREDENTIALS_KEY);
    }
  } catch (e) {
    /* ignore */
  }
  try {
    localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
  } catch (e) {
    /* ignore */
  }
}
