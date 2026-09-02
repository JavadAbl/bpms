/**
 * Format an ISO date string into a Persian (Jalali) date.
 * Returns a placeholder if the date is missing or invalid.
 */
export function formatPersianDate(input?: string | Date | null): string {
  if (!input) return '—';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(input);
  }
}

/** Format only the date portion (no time) in Persian. */
export function formatPersianDateOnly(input?: string | Date | null): string {
  if (!input) return '—';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(input);
  }
}

/** Safely parse a JSON string that may already be an object. */
export function safeJsonParse<T = any>(value: any): T {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value;
  }
}

/** Generate a short unique id (client-only). */
export function shortId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
