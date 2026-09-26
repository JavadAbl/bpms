import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Departments — list returns the GetMany envelope (unwrapped);
 * create returns the id, update returns void.
 */
export const departmentsApi = {
  findAll: () => fetchAll<any>('/departments'),
  findOne: (id: string) => apiFetch<any>(`/departments/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiFetch<string>('/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<void>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' }),
};
