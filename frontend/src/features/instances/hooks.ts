'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processInstancesApi, processDraftsApi } from './api';
import { dashboardKeys } from '@/features/dashboard';
import { tasksKeys } from '@/features/tasks';

// ---------------------------------------------------------------------------
// Process instances (runtime) + drafts (saved start forms). Draft submission
// is the widest invalidation in the app: it creates an instance, completes
// the first task and shifts every KPI — that matrix is defined ONCE here.
//
// NOTE: tasks/hooks.ts imports instancesKeys and this file imports tasksKeys.
// The cycle is safe: both reference each other's keys only inside callbacks
// (ESM live bindings), never at module-evaluation time.
// ---------------------------------------------------------------------------

/** Shared query keys (prefix semantics: invalidating .all covers every sub-key). */
export const instancesKeys = {
  all: ['process-instances'] as const,
  cases: ['process-instances', 'cases'] as const,
  detail: (instanceId: string) => ['process-instances', 'detail', instanceId] as const,
};

export const draftsKeys = {
  all: ['drafts'] as const,
  detail: (draftId: string) => ['drafts', 'detail', draftId] as const,
};

/**
 * Case list — every instance the user participates in (admins get all).
 * Returns the raw query so callers can react to 403 errors.
 */
export function useCases() {
  const query = useQuery({
    queryKey: instancesKeys.cases,
    queryFn: () => processInstancesApi.cases(),
  });
  return {
    cases: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** One instance (timeline, variables, tasks). Returns the raw query (403 → denied). */
export function useInstanceDetail(instanceId: string) {
  return useQuery({
    queryKey: instancesKeys.detail(instanceId),
    queryFn: () => processInstancesApi.findOne(instanceId),
  });
}

/** All drafts of the signed-in user. */
export function useDrafts() {
  const query = useQuery({
    queryKey: draftsKeys.all,
    queryFn: () => processDraftsApi.findAll(),
  });
  return {
    drafts: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** One draft with its form definition. Returns the raw query. */
export function useDraftDetail(draftId: string) {
  return useQuery({
    queryKey: draftsKeys.detail(draftId),
    queryFn: () => processDraftsApi.findOne(draftId),
  });
}

/** Invalidate every instance list (cases / mine / detail). */
export function useInvalidateInstances() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: instancesKeys.all });
  };
}

/** Terminate a running instance; refreshes instances + dashboard. */
export function useTerminateInstance(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => processInstancesApi.terminate(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instancesKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      options?.onSuccess?.();
    },
  });
}

/** Discard a draft; refreshes the drafts list. */
export function useDeleteDraft(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => processDraftsApi.remove(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      options?.onSuccess?.();
    },
  });
}

/**
 * Save (partial) draft data without submitting — updates the cached detail
 * in place so the form keeps its freshly-saved values.
 */
export function useSaveDraft(draftId: string, options?: { onSuccess?: (updated: any) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => processDraftsApi.update(draftId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(draftsKeys.detail(draftId), updated);
      options?.onSuccess?.(updated);
    },
  });
}

/**
 * Submit a draft: starts the BPMN instance and completes the first task.
 * Invalidates drafts + instances + tasks + dashboard (the full matrix).
 */
export function useSubmitDraft(options?: { onSuccess?: (instance: any) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data?: Record<string, any> }) =>
      processDraftsApi.submit(draftId, data),
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      queryClient.invalidateQueries({ queryKey: instancesKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      options?.onSuccess?.(instance);
    },
  });
}

/** Create a draft for a process (start dialog) — refreshes the drafts list. */
export function useCreateDraft(options?: { onSuccess?: (draft: any) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (processId: string) => processDraftsApi.create(processId),
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: draftsKeys.all });
      options?.onSuccess?.(draft);
    },
  });
}
