/**
 * cases.js — the BPMS process-instance (سوابق کارتابل) API (v1.7).
 * ----------------------------------------------------------------
 * Backend contract (NestJS ProcessInstanceController, "process-instances"):
 *
 *   GET /api/process-instances/cases
 *       The case list (موارد): every process instance the current user
 *       participates in — started by them or holding any task in it, ANY
 *       status (ADMIN sees all). GetManyReply envelope:
 *         { items: ProcessInstanceDto[], totalCount }
 *       Each item carries its task timeline:
 *         tasks: [{id, name, status, createdAt, assignee: {id, name}}]
 *       ordered by createdAt ASC. NOTE: the backend defines no searchable
 *       fields for this route — `search` is ignored, so no search box here.
 *
 *   GET /api/process-instances/:id
 *       One instance, participant-gated, with the RICH timeline used by the
 *       «انجام کار» dialog's سوابق کارتابل section — per task: assignee
 *       {id, email, name}, position {id, name, department}, form {id, name},
 *       status, createdAt, completedAt.
 */

import { API } from './config.js';
import { authedFetch, ApiError } from './api.js';

/** GET /api/process-instances/cases — the user's case list (paged). */
export async function fetchCases(opts) {
  const o = opts || {};
  const params = new URLSearchParams();
  params.set('page', String(o.page || 1));
  params.set('pageSize', String(o.pageSize || API.casesPageSize));
  if (API.casesSortBy) params.set('sortBy', API.casesSortBy);
  if (API.casesSortOrder) params.set('sortOrder', API.casesSortOrder);

  const res = await authedFetch(API.casesPath + '?' + params.toString(), {
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

/**
 * GET /api/process-instances/:id — one case with the rich task timeline
 * (assignee + position + form per step). Used by the task dialog's
 * «سوابق کارتابل» section for the task's own instance.
 */
export async function fetchCaseDetail(instanceId) {
  const res = await authedFetch(
    API.caseDetailPath + '/' + encodeURIComponent(String(instanceId)),
    { headers: { Accept: 'application/json' } }
  );

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
  if (!Array.isArray(data.tasks)) data.tasks = [];
  return data;
}
