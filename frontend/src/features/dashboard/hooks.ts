'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from './api';

// ---------------------------------------------------------------------------
// Dashboard aggregate (KPIs, charts, quick lists). One query, one key —
// every mutation anywhere that shifts instance/task counts invalidates it
// (the individual slices import dashboardKeys for exactly that).
// ---------------------------------------------------------------------------

/** Shared query key — invalidate after anything that changes KPI counts. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
};

/** Fetch the dashboard aggregate. Returns the raw query (data/error/refetch). */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: () => dashboardApi.get(),
  });
}

/** Invalidate the dashboard aggregate (call after task/instance mutations). */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
}
