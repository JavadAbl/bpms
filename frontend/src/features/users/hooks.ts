'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from './api';

// ---------------------------------------------------------------------------
// Users — reference data for many consumers (admin views, org dialogs, the
// process designer) plus the admin CRUD mutations. All list consumers share
// ONE cached query; user mutations invalidate it everywhere at once.
// ---------------------------------------------------------------------------

/** Shared query key — invalidate after any user mutation. */
export const usersKeys = {
  all: ['users'] as const,
};

/** Fetch (and cache) all users. */
export function useUsers() {
  const query = useQuery({
    queryKey: usersKeys.all,
    queryFn: () => usersApi.findAll(),
  });
  return {
    users: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** Invalidate the shared users cache — call after CRUD operations. */
export function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: usersKeys.all });
  };
}

/** Delete a user; invalidates the shared users cache. Toasts stay in the view. */
export function useDeleteUser(options?: { onSuccess?: () => void }) {
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidateUsers();
      options?.onSuccess?.();
    },
  });
}
