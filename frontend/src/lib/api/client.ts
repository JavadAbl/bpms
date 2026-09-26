/**
 * Core HTTP client for the BPMS backend (axios).
 *
 * All calls go through the same-origin `/api` prefix (Next.js rewrites proxy
 * to the NestJS backend on :3001, so CORS never comes up). Token handling and
 * error normalization live in the shared axios instance interceptors; domain
 * modules under src/lib/api/ and the per-slice api.ts files build on top of it.
 */
import axios, { AxiosError, type AxiosInstance } from 'axios';

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

/**
 * Shared axios instance — every request in the app goes through it, so the
 * auth header, 401 handling and error shape are applied in exactly one place.
 */
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  // Backend "void" endpoints (e.g. update) answer 200 with an EMPTY body and
  // some answers are plain text — the default JSON-only transform would throw
  // on both. Parse defensively, mirroring the old fetch client.
  transformResponse: [
    (data: unknown) => {
      if (typeof data !== 'string') return data; // Blob / ArrayBuffer / …
      if (data === '') return undefined; // empty body → "void"
      try {
        return JSON.parse(data);
      } catch {
        return undefined; // non-JSON body → don't explode
      }
    },
  ],
});

// Attach the JWT (if any) to every request.
http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) {
    config.headers.set('Authorization', `Bearer ${t}`);
  }
  return config;
});

// Normalize errors + handle session expiry.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';

    // Expired / revoked token on a non-auth endpoint: drop the token and
    // hard-navigate to /login. The full reload re-runs AuthProvider, so no
    // stale user context survives. Login/register endpoints are excluded —
    // a failed login is a normal 401, not a session expiry.
    if (status === 401 && !url.startsWith('/auth/')) {
      setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // Plain Error with `.status`, message from the backend envelope when
    // present — the contract domain modules branch on (403/404/…).
    const body = error.response?.data;
    const err = new Error(
      body && typeof body === 'object' ? body.message || body.error || '' : '',
    ) as Error & { status?: number };
    err.message = err.message || error.message || `HTTP ${status ?? 'network'}`;
    err.status = status;
    return Promise.reject(err);
  },
);

export interface FetchOptions {
  method?: string;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** JSON string (JSON.stringify'd) or FormData for uploads. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Promise-based request helper on top of the shared axios instance.
 * Kept as a thin `fetch`-like signature so domain modules stay unchanged.
 */
export async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, body, signal, method } = options;

  // Don't stamp Content-Type on FormData/Blob bodies — axios lets the
  // browser set the multipart boundary itself.
  const isBinary =
    typeof FormData !== 'undefined' && body instanceof FormData ||
    typeof Blob !== 'undefined' && body instanceof Blob;

  const finalHeaders: Record<string, string> = {
    ...(body != null && !isBinary ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  const response = await http.request<T>({
    url: path,
    method: method ?? (body != null ? 'POST' : 'GET'),
    params,
    data: body,
    headers: finalHeaders,
    signal,
  });

  return response.data;
}
