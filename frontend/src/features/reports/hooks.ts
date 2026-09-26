'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from './api';
import type { ReportDefinition, ReportFieldCatalog } from './types';

// ---------------------------------------------------------------------------
// Reports — saved definitions, the live execution snapshot and the per-
// process field catalog the builder needs. Execution is a POST-as-read (a
// fresh snapshot every run) so its cache is intentionally short-lived.
// ---------------------------------------------------------------------------

/** Shared query keys. */
export const reportsKeys = {
  all: ['reports'] as const,
  detail: (reportId: string) => ['reports', 'detail', reportId] as const,
  execute: (reportId: string) => ['reports', 'execute', reportId] as const,
  fieldCatalog: (processId: string) => ['reports', 'field-catalog', processId] as const,
};

/** All saved report definitions (admin landing page). */
export function useReports() {
  const query = useQuery({
    queryKey: reportsKeys.all,
    queryFn: () => reportsApi.findAll(),
  });
  return {
    reports: query.data ?? [],
    loading: query.isPending,
    refetch: query.refetch,
  };
}

/** One saved definition (edit mode of the builder). Returns the raw query. */
export function useReportDetail(reportId: string) {
  return useQuery({
    queryKey: reportsKeys.detail(reportId),
    queryFn: () => reportsApi.findOne(reportId),
  });
}

/**
 * Execute a saved report while its dialog is open — a live snapshot, so it
 * refetches on every open (staleTime/gcTime 0). Returns the raw query.
 */
export function useReportExecution(reportId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: reportsKeys.execute(reportId ?? 'none'),
    queryFn: () => reportsApi.execute(reportId as string),
    enabled: enabled && !!reportId,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Selectable fields of one process (builder column picker). */
export function useReportFieldCatalog(processId: string | null | undefined) {
  const query = useQuery({
    queryKey: reportsKeys.fieldCatalog(processId ?? 'none'),
    queryFn: () => reportsApi.getFieldCatalog(processId as string),
    enabled: !!processId,
  });
  return {
    catalog: (query.data as ReportFieldCatalog | undefined) ?? null,
    catalogLoading: query.isPending && !!processId,
  };
}

/** Invalidate the saved-reports list (builder save / delete). */
export function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: reportsKeys.all });
  };
}

/** Delete a saved report; invalidates the list. */
export function useDeleteReport(options?: { onSuccess?: () => void }) {
  const invalidateReports = useInvalidateReports();
  return useMutation({
    mutationFn: (reportId: string) => reportsApi.remove(reportId),
    onSuccess: () => {
      invalidateReports();
      options?.onSuccess?.();
    },
  });
}
