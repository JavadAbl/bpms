/**
 * processes.js — the BPMS process-definitions API (v1.8).
 * --------------------------------------------------------
 * Backend contract (NestJS ProcessController, "processes"):
 *
 *   GET /api/processes
 *       Paginated list of process definitions (any authenticated user may
 *       read it — the @Roles('ADMIN') guards sit only on the write routes).
 *       GetManyReply envelope: { items: ProcessDto[], totalCount }.
 *       Fields used by the start dialog: id, name, description, status
 *       ('ACTIVE' | 'DRAFT'), version.
 *
 *   POST /api/process-instances     body: { processId }
 *       Starts a NEW case (process instance) of the given process —
 *       exactly what the web app's «شروع نمونه» does. Returns the created
 *       ProcessInstanceDto (id, status, startedAt, …).
 *
 *       Access rules enforced by the backend:
 *         - the process must be ACTIVE (400 otherwise)
 *         - if the process has a starter restriction, only its members
 *           (and admins) may start it (403 otherwise) — surfaced as
 *           Persian messages by the start dialog.
 */

import { API } from './config.js';
import { authedFetch, getAuthSession, ApiError } from './api.js';

/**
 * GET /api/processes — loads the startable processes for the start dialog.
 * Auto-paginates (the backend caps pageSize at 100) up to a safety cap,
 * keeps ACTIVE ones, and applies the SAME starter-restriction rule as the
 * web app's start dialog (like the front end):
 *   - a process with NO starter list may be started by everyone;
 *   - a process WITH a starter list is only listed for its starters
 *     (admins bypass — so flows never dead-end).
 * Processes the user may not start are NOT shown at all.
 */
export async function fetchActiveProcesses() {
  const pageSize = 100;
  const maxPages = 10; // 1,000 processes — far beyond any real deployment
  const items = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', 'name');
    params.set('sortOrder', 'asc');

    const res = await authedFetch(API.processesPath + '?' + params.toString(), {
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

    items.push(...data.items);
    const total = Number(data.totalCount) || items.length;
    if (items.length >= total) break; // last page reached
  }

  const session = getAuthSession();
  const isAdmin = String((session && session.role) || '') === 'ADMIN';
  const userId = String((session && session.userId) || '');

  return items.filter((p) => {
    if (!p || p.status !== 'ACTIVE') return false;
    const starters = (p.starters || []).map((s) => s.userId);
    if (starters.length === 0) return true; // unrestricted — everyone
    if (isAdmin) return true; // admins bypass the restriction
    return !!userId && starters.includes(userId);
  });
}

/**
 * POST /api/process-instances { processId } — starts a new case. Returns
 * the created ProcessInstanceDto (its first task lands in the starter's
 * کارتابل — the tasks grid / badge will pick it up on the next refresh).
 *
 *   → 201 ProcessInstanceDto
 *   → 400 the process is not ACTIVE
 *   → 403 starter restriction (the user may not start this process)
 *   → 401 expired session
 */
export async function startProcessCase(processId) {
  const res = await authedFetch(API.instancesPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ processId: String(processId || '') }),
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
  if (!data || !data.id) {
    throw new ApiError('badresponse', res.status);
  }
  return data;
}
