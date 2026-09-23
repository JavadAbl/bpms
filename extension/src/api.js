/**
 * api.js — real API calls + JWT session handling.
 * -----------------------------------------------
 * POST /api/auth/login { username, password }
 *   → 200 { accessToken, userId, email, name, role }
 *
 * Task actions (v1.6 — the «انجام کار» dialog):
 *   GET  /api/tasks/:id           → TaskDto detail (form.fields +
 *                                   instanceVariables for read-only prefill)
 *   POST /api/tasks/:id/complete  → submits the filled form; the BPMN engine
 *                                   advances the flow to the next user task
 *   POST /api/tasks/:id/claim     → claims a self-service position task
 *
 * The response is kept in sessionStorage (key: AUTH_SESSION_KEY) for use
 * in future API calls — see authedFetch(), which attaches the JWT as an
 * Authorization: Bearer header automatically.
 *
 * sessionStorage is per-origin AND per-tab: the session lives exactly as
 * long as the OA tab it was created in.
 */

import { API, AUTH_SESSION_KEY } from './config.js';

/* ============================ Errors ===================================== */

/** API failure with an HTTP status code (0 = network layer). */
export class ApiError extends Error {
  constructor(kind, status) {
    super(kind + (status ? ' (HTTP ' + status + ')' : ''));
    this.name = 'ApiError';
    this.kind = kind; // 'network' | 'http' | 'badresponse' | 'notoken' | 'no-session'
    this.status = status || 0;
  }
}



/* ======================== Extension-owned fetch ======================== */
/**
 * Content-script fetch() to localhost is attributed to the OA page origin
 * (https://oa.*) and Chrome blocks it as CORS / Local Network Access.
 * The background service worker performs the same request under
 * host_permissions. Local HTTP testing (no chrome.runtime.id) still uses
 * window.fetch.
 */
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function canUseBackgroundFetch() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function' &&
    !!chrome.runtime.id
  );
}
async function serializeBody(body) {
  if (body == null) return { bodyKind: 'empty' };
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const formFiles = [];
    for (const [key, value] of body.entries()) {
      if (typeof File !== 'undefined' && value instanceof File) {
        const buf = new Uint8Array(await value.arrayBuffer());
        formFiles.push({
          key,
          filename: value.name,
          type: value.type,
          data: bytesToBase64(buf),
        });
      }
    }
    return { bodyKind: 'form', formFiles };
  }
  return {
    bodyKind: 'text',
    body: typeof body === 'string' ? body : String(body),
  };
}
async function extFetch(url, options) {
  const opts = options || {};
  if (!canUseBackgroundFetch()) {
    return fetch(url, opts);
  }
  if (opts.signal && opts.signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const headers = Object.assign({}, opts.headers || {});
  const serialized = await serializeBody(opts.body);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });
    chrome.runtime.sendMessage(
      {
        type: 'OA_PA_FETCH',
        url,
        method: opts.method || 'GET',
        headers,
        bodyKind: serialized.bodyKind,
        body: serialized.body,
        formFiles: serialized.formFiles,
      },
      (resp) => {
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!resp) {
          reject(new Error('empty background response'));
          return;
        }
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        const bytes = base64ToBytes(resp.bodyBase64);
        resolve(
          new Response(bytes, {
            status: resp.status || 0,
            statusText: resp.statusText || '',
            headers: resp.headers || {},
          }),
        );
      },
    );
  });
}

/* ======================== Session (sessionStorage) ====================== */

/** Returns the stored login session, or null. */
export function getAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data.accessToken === 'string' ? data : null;
  } catch (e) {
    return null;
  }
}

/** Persists a login response ({ accessToken, userId, username, email, name, role }). */
export function setAuthSession(session) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

/** Removes the session (logout). */
export function clearAuthSession() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
}

/* ============================== Login ==================================== */

/**
 * Logs in via POST /api/auth/login and stores the response in
 * sessionStorage. Throws ApiError on any failure.
 */
export async function login(username, password) {
  const url = API.baseUrl + API.loginPath;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API.timeoutMs);

  let res;
  try {
    res = await extFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username: username, password: password }),
      signal: controller.signal,
    });
  } catch (e) {
    // Network failure or timeout (AbortError).
    throw new ApiError('network', 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ApiError('http', res.status);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
  if (!data || typeof data.accessToken !== 'string' || !data.accessToken) {
    throw new ApiError('notoken', res.status);
  }

  setAuthSession(data);
  return data;
}

/* ========================= Future API calls ============================== */

/**
 * fetch() wrapper for authenticated endpoints: reads the JWT from
 * sessionStorage and attaches it as "Authorization: Bearer <token>".
 * Throws ApiError('no-session') when nobody is logged in.
 *
 * Example:
 *   const res = await authedFetch('/api/processes/123/activate', {
 *     method: 'POST',
 *   });
 */
export async function authedFetch(path, options) {
  const opts = options || {};
  const session = getAuthSession();
  if (!session) {
    throw new ApiError('no-session', 401);
  }
  const headers = Object.assign({}, opts.headers || {});
  headers['Authorization'] = 'Bearer ' + session.accessToken;
  const absolute = /^https?:/i.test(path) ? path : API.baseUrl + path;
  return extFetch(absolute, Object.assign({}, opts, { headers: headers }));
}

/* ========================= Process tasks inbox ============================ */

/**
 * GET /api/tasks/mine — "List the RECEIVED (PENDING) tasks of the current
 * user" — the BPMS کارتابل shown by the «جریان کار» sidebar item.
 *
 * Backend contract (NestJS GetManyReply<TaskDto>):
 *   → 200 { items: TaskDto[], totalCount: number }
 *   → 401 when the JWT is missing/expired  (ApiError kind 'http', 401)
 *
 * TaskDto fields used by the grid: id, name, description, assignee{name},
 * position{name}, selfService, form{name}, status, createdAt,
 * processInstance{ process{ name } }.
 */
export async function fetchMyTasks(opts) {
  const o = opts || {};
  const params = new URLSearchParams();
  params.set('page', String(o.page || 1));
  params.set('pageSize', String(o.pageSize || API.tasksPageSize));
  if (o.search) params.set('search', o.search);
  if (API.tasksSortBy) params.set('sortBy', API.tasksSortBy);
  if (API.tasksSortOrder) params.set('sortOrder', API.tasksSortOrder);

  const res = await authedFetch(API.tasksMinePath + '?' + params.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (res.status === 401) {
    throw new ApiError('http', 401);
  }
  if (!res.ok) {
    throw new ApiError('http', res.status);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
  if (!data || !Array.isArray(data.items)) {
    throw new ApiError('badresponse', res.status);
  }
  return {
    items: data.items,
    totalCount: Number(data.totalCount) || 0,
  };
}

/* ====================== Task detail / actions (v1.6) ====================== */

/** Builds /api/tasks/{id} (+ an optional suffix like '/complete'). */
function taskUrl(id, suffix) {
  return (
    API.tasksPath +
    '/' +
    encodeURIComponent(String(id)) +
    (suffix || '')
  );
}

/** Shared response handling for the task endpoints (throws ApiError). */
async function readTaskResponse(res) {
  if (res.status === 401) {
    throw new ApiError('http', 401);
  }
  if (!res.ok) {
    throw new ApiError('http', res.status);
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
  if (!data || !data.id) {
    throw new ApiError('badresponse', res.status);
  }
  return data;
}

/**
 * GET /api/tasks/:id — the task detail, only visible in the caller's
 * کارتابل. Includes form.fields AND instanceVariables (the merged data of
 * all previous form submissions in the instance — used to pre-fill
 * read-only fields with what earlier users filled in).
 */
export async function fetchTaskById(taskId) {
  const res = await authedFetch(taskUrl(taskId), {
    headers: { Accept: 'application/json' },
  });
  return readTaskResponse(res);
}

/**
 * POST /api/tasks/:id/complete — submits the filled form data and completes
 * the task. The backend signals the BPMN engine with the values (mapped to
 * process variables), which advances the flow: the NEXT userTask is created
 * for the next user in the process — that is how the task is "sent to the
 * next user". Returns the completed TaskDto.
 *
 *   body: { data: {field: value, ...}, formId?: string }
 *   → 200 TaskDto(status COMPLETED) | 401 expired | 403 forbidden
 *      (not yours / already completed / self-service not claimed)
 */
export async function completeTask(taskId, values, formId) {
  const body = { data: values || {} };
  if (formId) body.formId = formId;
  const res = await authedFetch(taskUrl(taskId, '/complete'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readTaskResponse(res);
}

/**
 * POST /api/tasks/:id/claim — claims a position-based self-service task for
 * the current user. Required before such tasks can be completed; after
 * claiming, the task disappears from other holders' queues.
 */
export async function claimTask(taskId) {
  const res = await authedFetch(taskUrl(taskId, '/claim'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return readTaskResponse(res);
}
