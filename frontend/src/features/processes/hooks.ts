'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processesApi, formsApi } from './api';
import { dashboardKeys } from '@/features/dashboard';

// ---------------------------------------------------------------------------
// Process definitions + versions + per-process forms. Every write that
// changes the catalog (delete/activate/restore) also refreshes the dashboard
// KPIs — that invalidation matrix lives HERE, not in each view.
//
// NOTE: queryKey prefixes matter — invalidating ['processes'] also refetches
// ['processes','versions',id]; invalidating ['forms', id] only that process's
// forms. Keep new process sub-queries under these prefixes.
// ---------------------------------------------------------------------------

/** Shared query keys. */
export const processesKeys = {
  all: ['processes'] as const,
  versions: (processId: string) => ['processes', 'versions', processId] as const,
};

export const formsKeys = {
  byProcess: (processId: string) => ['forms', processId] as const,
};

/** Fetch (and cache) all process definitions. `enabled` gates dialog usage. */
export function useProcesses({ enabled }: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: processesKeys.all,
    queryFn: () => processesApi.findAll(),
    enabled,
  });
  return {
    processes: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** Version history of one process (fetched while the dialog is open). */
export function useProcessVersions(processId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: processesKeys.versions(processId),
    queryFn: () => processesApi.getVersions(processId),
    enabled: enabled && !!processId,
  });
  return {
    versions: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** Forms scoped to one process (disabled in designer "new" mode). */
export function useProcessForms(processId: string | null | undefined) {
  const query = useQuery({
    queryKey: formsKeys.byProcess(processId ?? 'none'),
    queryFn: () => formsApi.findAll(processId as string),
    enabled: !!processId,
  });
  return {
    forms: query.data ?? [],
    loading: query.isPending,
  };
}

/** Invalidate the process catalog only (no dashboard). */
export function useInvalidateProcesses() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: processesKeys.all });
  };
}

/** Delete a process; refreshes processes + dashboard. */
export function useDeleteProcess(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => processesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: processesKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      options?.onSuccess?.();
    },
  });
}

/** Activate a DRAFT process; refreshes processes + dashboard. */
export function useActivateProcess(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => processesApi.update(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: processesKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      options?.onSuccess?.();
    },
  });
}

/**
 * Restore an old version (backend appends it as a NEW version). Invalidates
 * the whole processes prefix — versions history included.
 */
export function useRestoreProcessVersion(options?: {
  onSuccess?: (proc: any) => void;
  onError?: (error: any) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ processId, version, note }: { processId: string; version: number; note?: string }) =>
      processesApi.restoreVersion(processId, version, note),
    onSuccess: (proc) => {
      queryClient.invalidateQueries({ queryKey: processesKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      options?.onSuccess?.(proc);
    },
    onError: (error) => options?.onError?.(error),
  });
}
