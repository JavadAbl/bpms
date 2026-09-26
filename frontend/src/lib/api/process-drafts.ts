import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Process drafts — pre-start form fill. Submit starts the BPMN instance and
 * completes the first user task with the saved form data.
 */
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
