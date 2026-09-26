'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { AuthProvider } from '@/features/auth';

/**
 * App-wide client providers that must live above every route
 * (UI redesign Phase 2 — auth state now survives route changes).
 *
 * TanStack Query (data layer):
 * - queries: 30s staleTime (internal tool — snappy back-navigation without
 *   hammering the backend), no refetch on window focus, one retry.
 * - global error toast via QueryCache/MutationCache onError — every view
 *   previously repeated the same «خطا» toast by hand. 401s are skipped
 *   (apiFetch already redirects to /login) and 403s are skipped (detail
 *   views render their access-denied state instead of toasting).
 */
function makeQueryClient() {
  const onError = (err: unknown) => {
    const status = (err as any)?.status;
    if (status === 401 || status === 403) return;
    toast({
      title: 'خطا',
      description: err instanceof Error ? err.message : String(err),
      variant: 'destructive',
    });
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
