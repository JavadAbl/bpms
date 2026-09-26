import { z } from 'zod';
import { t } from '@/lib/i18n';
import type {
  ReportColumnConfig,
  ReportDefinition,
  ReportFilterConfig,
  SaveReportInput,
} from './types';

/**
 * Report builder (v7) — zod contract for the no-code report designer.
 *
 * The form holds the EDITABLE shape (statuses as a list, date range as two
 * strings, variable filters as rows with a UI-only uid); the pure helpers at
 * the bottom convert between it and the wire formats (SaveReportInput /
 * ReportDefinition.filters) so the component never re-implements that logic.
 */

/** Instance statuses the STATUS filter can narrow to (mirrors the engine). */
export const INSTANCE_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'] as const;

/** VARIABLE filter operators (mirrors backend REPORT_VARIABLE_OPS). */
export const REPORT_VARIABLE_OPS = ['eq', 'neq', 'contains'] as const;

export const REPORT_COLUMN_SOURCES = ['INSTANCE', 'VARIABLE'] as const;

/** One editable VARIABLE filter row. `uid` is UI-only (stable React keys). */
export const variableFilterRowSchema = z.object({
  uid: z.number(),
  name: z.string(),
  op: z.enum(REPORT_VARIABLE_OPS),
  value: z.string(),
});

export type VariableFilterRow = z.infer<typeof variableFilterRowSchema>;

/**
 * Builder form values. Validation mirrors the historical rules exactly:
 * name required · process required · ≥1 column · engaged variable rows need
 * a variable · date range order sanity-checked (new — the old builder let
 * an inverted range silently return zero rows).
 */
export const reportBuilderSchema = z
  .object({
    name: z.string().trim().min(1, `${t.reportName} الزامی است`),
    description: z.string().trim(),
    processId: z.string().min(1, t.reportNeedsProcess),
    columns: z
      .array(
        z.object({
          /** stable key — convention: "field:<fieldKey>" or "var:<variableName>" */
          key: z.string().min(1),
          source: z.enum(REPORT_COLUMN_SOURCES),
          fieldKey: z.string().min(1),
          label: z.string().optional(),
        }),
      )
      .min(1, t.noReportColumns),
    statuses: z.array(z.enum(INSTANCE_STATUSES)),
    /** '' | 'YYYY-MM-DD' (native date inputs) */
    dateFrom: z.string(),
    dateTo: z.string(),
    varFilters: z.array(variableFilterRowSchema).superRefine((rows, ctx) => {
      rows.forEach((row, i) => {
        // A row counts as "engaged" once a variable OR a value is typed —
        // untouched rows stay valid and are dropped when building the payload
        // (same silent-skip semantics as the old builder for empty rows).
        const engaged = row.name.trim() !== '' || row.value.trim() !== '';
        if (engaged && row.name.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'name'],
            message: `${t.variableName} الزامی است`,
          });
        }
      });
    }),
  })
  .refine((v) => !(v.dateFrom && v.dateTo && v.dateFrom > v.dateTo), {
    path: ['dateTo'],
    message: 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد',
  });

export type ReportBuilderValues = z.infer<typeof reportBuilderSchema>;

/** Blank builder state (create mode). */
export const EMPTY_REPORT_BUILDER: ReportBuilderValues = {
  name: '',
  description: '',
  processId: '',
  columns: [],
  statuses: [],
  dateFrom: '',
  dateTo: '',
  varFilters: [],
};

/** Build the wire filters from validated form values (empty pieces omitted). */
export function reportFiltersFromValues(v: ReportBuilderValues): ReportFilterConfig[] {
  const filters: ReportFilterConfig[] = [];
  if (v.statuses.length > 0) filters.push({ type: 'STATUS', statuses: v.statuses });
  if (v.dateFrom || v.dateTo) {
    filters.push({ type: 'DATE_RANGE', from: v.dateFrom || undefined, to: v.dateTo || undefined });
  }
  for (const row of v.varFilters) {
    if (!row.name.trim()) continue; // untouched/empty rows are dropped
    filters.push({ type: 'VARIABLE', name: row.name.trim(), op: row.op, value: row.value });
  }
  return filters;
}

/** Build the create/update payload from validated form values. */
export function reportPayloadFromValues(v: ReportBuilderValues): SaveReportInput {
  return {
    name: v.name,
    description: v.description || undefined,
    processId: v.processId,
    columns: v.columns as ReportColumnConfig[],
    filters: reportFiltersFromValues(v),
  };
}

/**
 * Parse a saved definition into editable form values. `nextUid` comes from
 * the component (a module-level sequence — the caller owns row identity).
 */
export function reportBuilderValuesFromReport(
  report: ReportDefinition,
  nextUid: () => number,
): ReportBuilderValues {
  const statuses: ReportBuilderValues['statuses'] = [];
  let dateFrom = '';
  let dateTo = '';
  const varFilters: VariableFilterRow[] = [];
  for (const f of report.filters || []) {
    if (f.type === 'STATUS') {
      for (const s of f.statuses || []) {
        if ((INSTANCE_STATUSES as readonly string[]).includes(s) && !statuses.includes(s as never)) {
          statuses.push(s as never);
        }
      }
    } else if (f.type === 'DATE_RANGE') {
      if (f.from) dateFrom = f.from.slice(0, 10);
      if (f.to) dateTo = f.to.slice(0, 10);
    } else if (f.type === 'VARIABLE') {
      varFilters.push({
        uid: nextUid(),
        name: f.name || '',
        op: (REPORT_VARIABLE_OPS as readonly string[]).includes(f.op as never)
          ? (f.op as VariableFilterRow['op'])
          : 'eq',
        value: f.value || '',
      });
    }
  }
  return {
    name: report.name,
    description: report.description || '',
    processId: report.processId,
    columns: [...(report.columns || [])] as ReportBuilderValues['columns'],
    statuses,
    dateFrom,
    dateTo,
    varFilters,
  };
}
