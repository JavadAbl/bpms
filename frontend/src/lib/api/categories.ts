import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Categories (global reusable dropdown option lists).
 */

export interface CategoryItem {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface CategoryUsage {
  formCount: number;
  formNames: string[];
}

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  items: CategoryItem[];
  usage?: CategoryUsage;
}

export interface CategoryItemInput {
  value: string;
  label: string;
}

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
