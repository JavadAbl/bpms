import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';
import type { Category, CategoryItemInput } from './types';

export const categoriesApi = {
  /** List endpoints return the GetMany envelope — unwrapped to Category[]. */
  findAll: () => fetchAll<Category>('/categories'),
  findOne: (id: string) => apiFetch<Category>(`/categories/${id}`),
  /** Returns the created category id (string), not the entity. */
  create: (data: { key: string; name: string; description?: string; items?: CategoryItemInput[] }) =>
    apiFetch<string>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  /** Returns void (200, empty body). */
  update: (
    id: string,
    data: { key?: string; name?: string; description?: string; items?: CategoryItemInput[] },
  ) => apiFetch<void>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
};
