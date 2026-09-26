import { apiFetch } from './client';

/**
 * GetMany envelope — the backend's standard list response shape.
 * List endpoints accept page/pageSize/sortBy/sortOrder/search (pageSize is
 * capped at 100 by the backend).
 */

/** Envelope returned by every backend list endpoint. */
export interface GetManyReply<T> {
  items: T[];
  totalCount: number;
}

export interface GetManyParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/** Backend caps `pageSize` at 100 — request full pages. */
const PAGE_SIZE = 100;
/** Hard safety cap: 20 pages = 2,000 rows per list call. */
const MAX_PAGES = 20;

/**
 * GET a list endpoint and UNWRAP the `{ items, totalCount }` envelope,
 * fetching every page until `totalCount` rows are collected (or the safety
 * cap is hit). Resolves to a plain array — the old unpaginated contract.
 */
export async function fetchAll<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const merged = (page: number): Record<string, string | number | boolean | undefined> => ({
    ...params,
    page,
    pageSize: PAGE_SIZE,
  });
  const first = await apiFetch<GetManyReply<T>>(path, { params: merged(1) });
  const items = [...(first.items ?? [])];
  const total = Math.min(first.totalCount ?? items.length, PAGE_SIZE * MAX_PAGES);
  while (items.length < total) {
    const next = await apiFetch<GetManyReply<T>>(path, {
      params: merged(Math.floor(items.length / PAGE_SIZE) + 1),
    });
    if (!next.items?.length) break; // server-side drift — stop paging
    items.push(...next.items);
  }
  return items;
}
