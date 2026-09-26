import { apiFetch } from './client';
import { fetchAll } from './envelope';

/**
 * Report builder (v6) — admin-defined tabular reports over process instances.
 */

export interface ReportColumnConfig {
  /** stable key — convention: "field:<fieldKey>" or "var:<variableName>" */
  key: string;
  source: 'INSTANCE' | 'VARIABLE';
  fieldKey: string;
  label?: string;
}

export interface ReportFilterConfig {
  type: 'STATUS' | 'DATE_RANGE' | 'VARIABLE';
  statuses?: string[];
  from?: string;
  to?: string;
  name?: string;
  op?: 'eq' | 'neq' | 'contains';
  value?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string | null;
  processId: string;
  process: { id: string; name: string; status: string } | undefined;
  columns: ReportColumnConfig[];
  filters: ReportFilterConfig[];
  columnCount: number;
  filterCount: number;
  createdBy: { id: string; name: string; email: string } | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportFieldCatalog {
  instanceFields: { key: string; label: string; type: string }[];
  variables: {
    name: string;
    label: string;
    type: string;
    options?: ReportOption[];
  }[];
}

export interface ReportResultColumn extends ReportColumnConfig {
  label: string;
  type: string;
  options?: ReportOption[];
}

export interface ReportExecutionResult {
  report: { id: string; name: string; description?: string | null } | null;
  process: { id: string; name: string };
  columns: ReportResultColumn[];
  rows: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    values: Record<string, any>;
  }[];
  total: number;
  byStatus: Record<string, number>;
  generatedAt: string;
}

export interface SaveReportInput {
  name: string;
  description?: string;
  processId: string;
  columns: ReportColumnConfig[];
  filters?: ReportFilterConfig[];
}

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
