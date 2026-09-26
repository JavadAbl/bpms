import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Users — list returns the GetMany envelope (unwrapped);
 * create returns the id (string), update returns void.
 */
export const usersApi = {
  findAll: () => fetchAll<any>('/users'),
  findOne: (id: string) => apiFetch<any>(`/users/${id}`),
  create: (data: { username: string; email: string; name: string; password: string; role?: string }) =>
    apiFetch<string>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    apiFetch<void>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
};
