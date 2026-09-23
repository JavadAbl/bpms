/**
 * drafts.js — BPMS process-drafts API (v1.9).
 * -------------------------------------------
 * Draft-first start: selecting a process creates a ProcessDraft (no BPMN
 * start). Submitting the draft starts the instance and completes the first
 * user task with the form data.
 */

import { API } from './config.js';
import { authedFetch, ApiError } from './api.js';

async function parseJson(res) {
  try {
    return await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
}

/**
 * GET /api/process-drafts — paginated list of the current user's drafts.
 */
export async function fetchDrafts(opts) {
  const page = (opts && opts.page) || 1;
  const pageSize = (opts && opts.pageSize) || API.draftsPageSize;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  params.set('sortBy', API.draftsSortBy);
  params.set('sortOrder', API.draftsSortOrder);
  if (opts && opts.search) params.set('search', String(opts.search));

  const res = await authedFetch(API.draftsPath + '?' + params.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) throw new ApiError('http', 401);
  if (!res.ok) throw new ApiError('http', res.status);

  const data = await parseJson(res);
  if (!data || !Array.isArray(data.items)) throw new ApiError('badresponse', res.status);
  return { items: data.items, totalCount: Number(data.totalCount) || data.items.length };
}

/** POST /api/process-drafts { processId } */
export async function createDraft(processId) {
  const res = await authedFetch(API.draftsPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ processId: String(processId || '') }),
  });
  if (res.status === 401) throw new ApiError('http', 401);
  if (!res.ok) throw new ApiError('http', res.status);
  const data = await parseJson(res);
  if (!data || !data.id) throw new ApiError('badresponse', res.status);
  return data;
}

/** GET /api/process-drafts/:id */
export async function fetchDraftById(id) {
  const res = await authedFetch(API.draftsPath + '/' + encodeURIComponent(id), {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) throw new ApiError('http', 401);
  if (res.status === 404) throw new ApiError('http', 404);
  if (!res.ok) throw new ApiError('http', res.status);
  const data = await parseJson(res);
  if (!data || !data.id) throw new ApiError('badresponse', res.status);
  return data;
}

/** PATCH /api/process-drafts/:id { data } */
export async function updateDraft(id, formData) {
  const res = await authedFetch(API.draftsPath + '/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ data: formData || {} }),
  });
  if (res.status === 401) throw new ApiError('http', 401);
  if (!res.ok) throw new ApiError('http', res.status);
  const data = await parseJson(res);
  if (!data || !data.id) throw new ApiError('badresponse', res.status);
  return data;
}

/** POST /api/process-drafts/:id/submit { data? } → ProcessInstanceDto */
export async function submitDraft(id, formData) {
  const res = await authedFetch(
    API.draftsPath + '/' + encodeURIComponent(id) + '/submit',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: formData || {} }),
    },
  );
  if (res.status === 401) throw new ApiError('http', 401);
  if (!res.ok) throw new ApiError('http', res.status);
  const data = await parseJson(res);
  if (!data || !data.id) throw new ApiError('badresponse', res.status);
  return data;
}

/** DELETE /api/process-drafts/:id */
export async function deleteDraft(id) {
  const res = await authedFetch(API.draftsPath + '/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) throw new ApiError('http', 401);
  if (!res.ok && res.status !== 204) throw new ApiError('http', res.status);
}
