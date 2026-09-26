import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';

export const tasksApi = {
  /** List endpoints (mine / participated / all) return the GetMany envelope; unwrapped to Task[]. */
  mine: () => fetchAll<any>('/tasks/mine'),
  participated: () => fetchAll<any>('/tasks/participated'),
  findAll: () => fetchAll<any>('/tasks'),
  findOne: (id: string) => apiFetch<any>(`/tasks/${id}`),
  complete: (id: string, data: Record<string, any>) =>
    apiFetch(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({ data }) }),
  claim: (id: string) => apiFetch(`/tasks/${id}/claim`, { method: 'POST' }),
  release: (id: string) => apiFetch(`/tasks/${id}/release`, { method: 'POST' }),
};
