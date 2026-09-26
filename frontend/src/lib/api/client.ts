/**
 * Core fetch client for the BPMS backend.
 *
 * All calls go through the same-origin `/api` prefix (Next.js rewrites proxy
 * to the NestJS backend on :3001, so CORS never comes up). Token handling and
 * error normalization live here; domain modules under src/lib/api/ build on
 * top of this and everything is re-exported from ./index.
 */

export const API_BASE = '/api';

let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
  if (typeof window !== 'undefined') {
    if (t) {
      localStorage.setItem('bpms_token', t);
    } else {
      localStorage.removeItem('bpms_token');
    }
  }
}

export function getToken(): string | null {
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('bpms_token');
  }
  return token;
}

export interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  const t = getToken();
  if (t) {
    finalHeaders['Authorization'] = `Bearer ${t}`;
  }

  const res = await fetch(url.toString(), {
    ...rest,
    headers: finalHeaders,
  });

  if (!res.ok) {
    // Expired / revoked token on a non-auth endpoint: drop the token and
    // hard-navigate to /login. The full reload re-runs AuthProvider, so no
    // stale user context survives. Login/register endpoints are excluded —
    // a failed login is a normal 401, not a session expiry.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(errorBody.message || `HTTP ${res.status}`);
    (err as any).status = res.status; // let callers branch on 403/404/…
    throw err;
  }

  // Backend "void" endpoints (e.g. update) answer 200 with an EMPTY body —
  // res.json() would throw on those, so parse defensively via text.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}
