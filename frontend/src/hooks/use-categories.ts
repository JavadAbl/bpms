'use client';

import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, type Category } from '@/lib/api';

// ---------------------------------------------------------------------------
// Module-level cache — categories are global and change rarely, so every
// consumer (form builders, runtime selects, previews) shares one fetch.
// ---------------------------------------------------------------------------

let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;
const listeners = new Set<(cats: Category[]) => void>();

function publish(cats: Category[]) {
  cache = cats;
  listeners.forEach((fn) => fn(cats));
}

export function invalidateCategories() {
  cache = null;
  inflight = null;
  // Re-fetch in background so subscribed components refresh
  loadCategories().catch(() => undefined);
}

export function loadCategories(force = false): Promise<Category[]> {
  if (!force && cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = categoriesApi
      .findAll()
      .then((cats) => {
        publish(cats);
        return cats;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Fetches (and caches) all global categories. Returns the list plus a
 * `reload` that forces a fresh fetch (call after CRUD operations).
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    const listener = (cats: Category[]) => {
      setCategories(cats);
      setLoading(false);
    };
    listeners.add(listener);
    let cancelled = false;
    loadCategories()
      .then((cats) => {
        if (!cancelled) listener(cats);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(async () => {
    const cats = await loadCategories(true);
    return cats;
  }, []);

  return { categories, loading, reload };
}

/** Resolve one category by id from the shared cache. */
export function useCategory(categoryId?: string | null): Category | undefined {
  const { categories } = useCategories();
  if (!categoryId) return undefined;
  return categories.find((c) => c.id === categoryId);
}
