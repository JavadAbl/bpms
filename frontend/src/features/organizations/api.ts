import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';

/**
 * Organizations — departments and the positions inside them.
 *
 * GET list endpoints return the GetMany envelope (unwrapped by fetchAll);
 * by-department lists stay plain arrays; create returns the id, update void.
 */

/** Departments. */
export const departmentsApi = {
  findAll: () => fetchAll<any>('/departments'),
  findOne: (id: string) => apiFetch<any>(`/departments/${id}`),
  create: (data: { name: string; description?: string }) =>
    apiFetch<string>('/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<void>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' }),
};

/** Positions — always scoped to a department. */
export const positionsApi = {
  findAll: () => fetchAll<any>('/positions'),
  findByDepartment: (deptId: string) => apiFetch<any[]>(`/positions/by-department/${deptId}`),
  findOne: (id: string) => apiFetch<any>(`/positions/${id}`),
  create: (deptId: string, data: { name: string; description?: string }) =>
    apiFetch<string>(`/positions/by-department/${deptId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<void>(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/positions/${id}`, { method: 'DELETE' }),
  assignUsers: (id: string, userIds: string[]) =>
    apiFetch(`/positions/${id}/users`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  removeUser: (positionId: string, userId: string) =>
    apiFetch(`/positions/${positionId}/users/${userId}`, { method: 'DELETE' }),
};
