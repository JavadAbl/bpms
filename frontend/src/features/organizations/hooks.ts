'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, positionsApi } from './api';

// ---------------------------------------------------------------------------
// Organizations — departments and the positions inside them. The two trees
// are fetched together (expandable master-detail view) and invalidated
// together: any dept/position/membership write refreshes both.
// ---------------------------------------------------------------------------

/** Shared query keys — invalidate after any organization mutation. */
export const departmentsKeys = {
  all: ['departments'] as const,
};

export const positionsKeys = {
  all: ['positions'] as const,
};

/** Fetch (and cache) all departments. */
export function useDepartments() {
  const query = useQuery({
    queryKey: departmentsKeys.all,
    queryFn: () => departmentsApi.findAll(),
  });
  return {
    departments: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** Fetch (and cache) all positions (the designer's assignment modal uses these too). */
export function usePositions() {
  const query = useQuery({
    queryKey: positionsKeys.all,
    queryFn: () => positionsApi.findAll(),
  });
  return {
    positions: query.data ?? [],
    loading: query.isPending,
  };
}

/**
 * Invalidate both organization trees — departments AND positions — after any
 * dept/position/membership write (the views render them as one structure).
 */
export function useInvalidateOrganizations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: departmentsKeys.all });
    queryClient.invalidateQueries({ queryKey: positionsKeys.all });
  };
}

/** Delete a department; invalidates both organization trees. */
export function useDeleteDepartment(options?: { onSuccess?: () => void }) {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      invalidateOrganizations();
      options?.onSuccess?.();
    },
  });
}

/** Delete a position; invalidates both organization trees. */
export function useDeletePosition(options?: { onSuccess?: () => void }) {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: (id: string) => positionsApi.remove(id),
    onSuccess: () => {
      invalidateOrganizations();
      options?.onSuccess?.();
    },
  });
}

/** Remove a user from a position; invalidates both organization trees. */
export function useRemovePositionUser(
  options?: { onSuccess?: () => void },
) {
  const invalidateOrganizations = useInvalidateOrganizations();
  return useMutation({
    mutationFn: ({ positionId, userId }: { positionId: string; userId: string }) =>
      positionsApi.removeUser(positionId, userId),
    onSuccess: () => {
      invalidateOrganizations();
      options?.onSuccess?.();
    },
  });
}
