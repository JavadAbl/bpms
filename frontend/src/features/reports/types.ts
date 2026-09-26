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
