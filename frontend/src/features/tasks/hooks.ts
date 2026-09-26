'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from './api';
import { dashboardKeys } from '@/features/dashboard';
import { instancesKeys } from '@/features/instances';

// ---------------------------------------------------------------------------
// User tasks. The "matrix" is the important part: completing/claiming a task
// can move an instance forward, so every task mutation refreshes the inbox
// AND the instance lists AND the dashboard KPIs. It lives here once instead
// of being copy-pasted into every view.
// ---------------------------------------------------------------------------

/** Shared query keys (prefix semantics: ['tasks'] covers mine + detail). */
export const tasksKeys = {
  all: ['tasks'] as const,
  mine: ['tasks', 'mine'] as const,
  detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
};

/** کارتابل — the signed-in user's pending inbox. */
export function useMyTasks() {
  const query = useQuery({
    queryKey: tasksKeys.mine,
    queryFn: () => tasksApi.mine(),
  });
  return {
    tasks: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** One task with its form definition + prefill variables. Returns the raw query. */
export function useTaskDetail(taskId: string) {
  return useQuery({
    queryKey: tasksKeys.detail(taskId),
    queryFn: () => tasksApi.findOne(taskId),
  });
}

/** Shared post-action invalidation: inbox + instances + dashboard. */
function useInvalidateAfterTaskAction() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: tasksKeys.all });
    queryClient.invalidateQueries({ queryKey: instancesKeys.all });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}

/** Claim a self-service task. */
export function useClaimTask(options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateAfterTaskAction();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.claim(taskId),
    onSuccess: () => {
      invalidate();
      options?.onSuccess?.();
    },
  });
}

/** Release a claimed task back to the pool. */
export function useReleaseTask(options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateAfterTaskAction();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.release(taskId),
    onSuccess: () => {
      invalidate();
      options?.onSuccess?.();
    },
  });
}

/** Complete a task with the form payload. */
export function useCompleteTask(options?: { onSuccess?: () => void }) {
  const invalidate = useInvalidateAfterTaskAction();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Record<string, any> }) =>
      tasksApi.complete(taskId, data),
    onSuccess: () => {
      invalidate();
      options?.onSuccess?.();
    },
  });
}
