/**
 * utils.js — tiny shared helpers.
 */

/** Create an element with optional class and text content. */
export function ce(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Format a timestamp as a Persian (fa-IR) date string, safely. */
export function formatFaDate(ts) {
  try {
    return new Date(ts).toLocaleString('fa-IR');
  } catch (e) {
    return new Date(ts).toISOString();
  }
}

/** Format a number with Persian digits (fa-IR), safely. */
export function faNum(n) {
  try {
    return Number(n).toLocaleString('fa-IR');
  } catch (e) {
    return String(n);
  }
}

/** Mask a JWT for console logging: "eyJhbGci…abcd (123 chars)". */
export function maskToken(token) {
  const t = String(token || '');
  if (t.length <= 12) return t.slice(0, 4) + '…(' + t.length + ')';
  return t.slice(0, 8) + '…' + t.slice(-4) + ' (' + t.length + ' chars)';
}

/**
 * Human-readable file size with Persian digits: "۲٫۳ مگابایت",
 * "۳۴ کیلوبایت", "۵۱۲ بایت" — used by the attachment chips/lists.
 */
export function formatBytes(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1024 * 1024) {
    return faNum((v / (1024 * 1024)).toFixed(1)) + ' مگابایت';
  }
  if (v >= 1024) {
    return faNum(Math.round(v / 1024)) + ' کیلوبایت';
  }
  return faNum(v) + ' بایت';
}
