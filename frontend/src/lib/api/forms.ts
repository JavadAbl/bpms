import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Forms — scoped to a process (processId is REQUIRED on the list endpoint).
 * create returns the new form id (string); update returns void.
 */
export const formsApi = {
  findAll: (processId: string) => fetchAll<any>('/forms', { processId }),
  findOne: (id: string) => apiFetch<any>(`/forms/${id}`),
  create: (data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<string>('/forms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; description?: string; fields: any[]; processId: string }) =>
    apiFetch<void>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/forms/${id}`, { method: 'DELETE' }),
};
