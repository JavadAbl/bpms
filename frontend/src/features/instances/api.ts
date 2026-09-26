import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';

/**
 * Process Instances (runtime) + Drafts (saved start forms).
 *
 * GET list endpoints return the GetMany envelope (unwrapped);
 * start/terminate/findOne return the full instance object.
 * Submitting a draft starts the BPMN instance and completes the first
 * user task with the saved form data.
 */

export const processInstancesApi = {
  findAll: () => fetchAll<any>('/process-instances'),
  mine: () => fetchAll<any>('/process-instances/mine'),
  /** Case list: user participates (started or has a task) — admin gets all */
  cases: () => fetchAll<any>('/process-instances/cases'),
  findOne: (id: string) => apiFetch<any>(`/process-instances/${id}`),
  start: (processId: string) =>
    apiFetch('/process-instances', { method: 'POST', body: JSON.stringify({ processId }) }),
  terminate: (id: string) => apiFetch(`/process-instances/${id}/terminate`, { method: 'POST' }),
};

export const processDraftsApi = {
  findAll: () => fetchAll<any>('/process-drafts'),
  findOne: (id: string) => apiFetch<any>(`/process-drafts/${id}`),
  create: (processId: string) =>
    apiFetch('/process-drafts', { method: 'POST', body: JSON.stringify({ processId }) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch(`/process-drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    }),
  submit: (id: string, data?: Record<string, any>) =>
    apiFetch(`/process-drafts/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ data: data || {} }),
    }),
  remove: (id: string) =>
    apiFetch(`/process-drafts/${id}`, { method: 'DELETE' }),
};
