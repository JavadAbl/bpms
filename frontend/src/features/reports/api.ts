import { apiFetch } from '@/lib/api/client';
import { fetchAll } from '@/lib/api/envelope';
import type {
  ReportDefinition,
  ReportExecutionResult,
  ReportFieldCatalog,
  ReportColumnConfig,
  ReportFilterConfig,
  SaveReportInput,
} from './types';

export const reportsApi = {
  /** GET /reports returns the GetMany envelope — unwrapped to ReportDefinition[]. */
  findAll: () => fetchAll<ReportDefinition>('/reports'),
  findOne: (id: string) => apiFetch<ReportDefinition>(`/reports/${id}`),
  create: (data: SaveReportInput) =>
    apiFetch<ReportDefinition>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SaveReportInput>) =>
    apiFetch<ReportDefinition>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch(`/reports/${id}`, { method: 'DELETE' }),
  /** Selectable fields for a process: fixed instance fields + process variables */
  getFieldCatalog: (processId: string) =>
    apiFetch<ReportFieldCatalog>(`/reports/field-catalog/${processId}`),
  /** Execute an UNSAVED config (builder «پیش‌نمایش») — admin only */
  preview: (data: { processId: string; columns: ReportColumnConfig[]; filters?: ReportFilterConfig[] }) =>
    apiFetch<ReportExecutionResult>('/reports/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  /** Execute a saved report — live rows over the process instances */
  execute: (id: string) => apiFetch<ReportExecutionResult>(`/reports/${id}/execute`, { method: 'POST' }),
};
