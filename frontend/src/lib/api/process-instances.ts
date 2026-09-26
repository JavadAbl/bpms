import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Process Instances — GET list endpoints return the GetMany envelope
 * (unwrapped); start/terminate/findOne return the full instance object.
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
