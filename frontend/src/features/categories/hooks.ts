'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from './api';
import { type Category } from './types';

// ---------------------------------------------------------------------------
// Categories are global and change rarely — every consumer (form builders,
// runtime selects, previews) shares ONE cached query instead of the old
// hand-rolled module-level cache. Mutations invalidate the key below and
// every mounted consumer refreshes automatically.
// ---------------------------------------------------------------------------

/** Shared query key — invalidate this after any category mutation. */
export const CATEGORIES_QUERY_KEY = ['categories'] as const;

/**
 * Fetches (and caches) all global categories. Returns the list plus a
 * `loading` flag and a `reload` that forces a fresh fetch.
 */
export function useCategories() {
  const query = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => categoriesApi.findAll(),
    staleTime: 5 * 60_000, // semi-static reference data
  });
  return {
    categories: query.data ?? [],
    loading: query.isPending,
    reload: query.refetch,
  };
}

/**
 * Invalidate the shared categories cache — call after CRUD operations so
 * form builders and runtime selects everywhere pick up the change.
 */
export function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
  };
}

/** Resolve one category by id from the shared cache. */
export function useCategory(categoryId?: string | null): Category | undefined {
  const { categories } = useCategories();
  if (!categoryId) return undefined;
  return categories.find((c) => c.id === categoryId);
}
