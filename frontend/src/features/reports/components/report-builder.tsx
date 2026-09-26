'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Eye,
  Loader2,
  Plus,
  Table2,
  Trash2,
  Variable as VariableIcon,
  X,
} from 'lucide-react';
import { reportsApi } from '../api';
import { useReportFieldCatalog, useInvalidateReports } from '../hooks';
import {
  INSTANCE_STATUSES,
  REPORT_VARIABLE_OPS,
  EMPTY_REPORT_BUILDER,
  reportBuilderSchema,
  reportBuilderValuesFromReport,
  reportFiltersFromValues,
  reportPayloadFromValues,
  type ReportBuilderValues,
  type VariableFilterRow,
} from '../schemas';
import type {
  ReportColumnConfig,
  ReportDefinition,
  ReportExecutionResult,
  SaveReportInput,
} from '../types';
import { useProcesses } from '@/features/processes';
import { useZodForm } from '@/hooks/use-zod-form';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatReportValue } from './report-value';

interface Props {
  /** null/undefined = create mode; otherwise edit the given definition */
  report?: ReportDefinition | null;
  /** Leave the builder (back to the reports landing page). */
  onBack: () => void;
}

let filterRowSeq = 0;
const nextFilterRow = (): VariableFilterRow => ({
  uid: ++filterRowSeq,
  name: '',
  op: 'eq',
  value: '',
});

const OP_LABELS: Record<string, string> = {
  eq: t.opEq,
  neq: t.opNeq,
  contains: t.opContains,
};

/**
 * Report builder (v7, rebuilt) — the admin "no-code" report designer, now a
 * real route (/admin/reports/build[/id]) instead of dead code. A report is
 * pure declarative configuration: pick a process, then select columns from
 * its instance data fields and process variables, optionally add STATUS /
 * DATE_RANGE / VARIABLE filters, preview the live result and save. The same
 * execution endpoint runs the preview and the saved report, so
 * «پیش‌نمایش» can never lie.
 *
 * State is a single zod-backed form (reportBuilderSchema) — inline errors
 * under the name / process / date / filter rows; the banner is reserved for
 * API failures. Processes + field catalog arrive via the slice query hooks.
 */
export function ReportBuilder({ report, onBack }: Props) {
  const isEdit = !!report;
  const { toast } = useToast();

  const {
    values,
    setValue,
    errorFor,
    validate,
    reset,
  } = useZodForm<ReportBuilderValues>(reportBuilderSchema, EMPTY_REPORT_BUILDER);

  const { processes } = useProcesses();
  const { catalog, catalogLoading } = useReportFieldCatalog(values.processId || undefined);
  const invalidateReports = useInvalidateReports();

  // Live preview result — local by design: any config change drops it so the
  // user can never mistake a stale table for the current configuration.
  const [preview, setPreview] = useState<ReportExecutionResult | null>(null);
  const [error, setError] = useState('');

  const previewMutation = useMutation({ mutationFn: reportsApi.preview });

  const saveMutation = useMutation({
    mutationFn: (payload: SaveReportInput) =>
      isEdit && report ? reportsApi.update(report.id, payload) : reportsApi.create(payload),
    onSuccess: () => {
      invalidateReports();
      toast({ title: 'موفقیت', description: t.reportSaved });
      onBack();
    },
    onError: (e: any) => {
      setError(e.message);
      toast({ title: 'خطا', description: e.message, variant: 'destructive' });
    },
  });

  // Initialize state on mount / when the edited report changes
  useEffect(() => {
    setError('');
    setPreview(null);
    reset(report ? reportBuilderValuesFromReport(report, () => ++filterRowSeq) : EMPTY_REPORT_BUILDER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const clearPreview = () => setPreview(null);

  // ---- column selection (order = click order) ------------------------------

  const columnKeys = useMemo(() => new Set(values.columns.map((c) => c.key)), [values.columns]);

  const toggleInstanceField = (fieldKey: string) => {
    const key = `field:${fieldKey}`;
    setValue(
      'columns',
      values.columns.some((c) => c.key === key)
        ? values.columns.filter((c) => c.key !== key)
        : [...values.columns, { key, source: 'INSTANCE' as const, fieldKey }],
    );
    clearPreview();
  };

  const toggleVariable = (varName: string) => {
    const key = `var:${varName}`;
    setValue(
      'columns',
      values.columns.some((c) => c.key === key)
        ? values.columns.filter((c) => c.key !== key)
        : [...values.columns, { key, source: 'VARIABLE' as const, fieldKey: varName }],
    );
    clearPreview();
  };

  const removeColumn = (key: string) => {
    setValue('columns', values.columns.filter((c) => c.key !== key));
    clearPreview();
  };

  const labelForColumn = (col: ReportColumnConfig): string => {
    if (col.source === 'INSTANCE') {
      return catalog?.instanceFields.find((f) => f.key === col.fieldKey)?.label || col.fieldKey;
    }
    return catalog?.variables.find((v) => v.name === col.fieldKey)?.label || col.fieldKey;
  };

  // ---- filters ----------------------------------------------------------------

  const toggleStatus = (s: (typeof INSTANCE_STATUSES)[number]) => {
    setValue(
      'statuses',
      values.statuses.includes(s)
        ? values.statuses.filter((x) => x !== s)
        : [...values.statuses, s],
    );
    clearPreview();
  };

  const patchFilterRow = (uid: number, patch: Partial<VariableFilterRow>) => {
    setValue('varFilters', values.varFilters.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    clearPreview();
  };

  const addFilterRow = () => {
    setValue('varFilters', [...values.varFilters, nextFilterRow()]);
    clearPreview();
  };

  const removeFilterRow = (uid: number) => {
    setValue('varFilters', values.varFilters.filter((r) => r.uid !== uid));
    clearPreview();
  };

  // ---- preview / save ----------------------------------------------------------

  const handlePreview = () => {
    const parsed = validate();
    if (!parsed) return;
    setError('');
    previewMutation.mutate(
      { processId: parsed.processId, columns: parsed.columns, filters: reportFiltersFromValues(parsed) },
      {
        onSuccess: (result) => setPreview(result),
        onError: (e: any) => setError(e.message),
      },
    );
  };

  const handleSave = () => {
    const parsed = validate();
    if (!parsed) return;
    setError('');
    saveMutation.mutate(reportPayloadFromValues(parsed));
  };

  const previewing = previewMutation.isPending;
  const saving = saveMutation.isPending;

  // ---- render -------------------------------------------------------------------

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight">{isEdit ? t.editReport : t.createReport}</h2>
            <p className="text-sm text-muted-foreground truncate">{t.reportBuilderHint}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowRight className="w-4 h-4" />
          {t.back}
        </Button>
      </div>

      {error && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Section 1 — report info */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Table2 className="w-4 h-4 text-primary" />
          {t.reportName}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-name">{t.name} *</Label>
            <Input
              id="report-name"
              value={values.name}
              onChange={(e) => setValue('name', e.target.value)}
              placeholder="مثلا گزارش مرخصی‌ها"
              aria-invalid={!!errorFor('name')}
            />
            {errorFor('name') && <p className="text-xs text-destructive">{errorFor('name')}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-process">{t.reportProcess} *</Label>
            <Select
              value={values.processId || undefined}
              onValueChange={(v) => {
                // switching processes invalidates every process-scoped choice
                setValue('processId', v);
                setValue('columns', []);
                setValue('statuses', []);
                setValue('dateFrom', '');
                setValue('dateTo', '');
                setValue('varFilters', []);
                clearPreview();
              }}
            >
              <SelectTrigger id="report-process" aria-invalid={!!errorFor('processId')}>
                <SelectValue placeholder={t.selectProcess} />
              </SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorFor('processId') && (
              <p className="text-xs text-destructive">{errorFor('processId')}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-desc">{t.description}</Label>
          <Input
            id="report-desc"
            value={values.description}
            onChange={(e) => setValue('description', e.target.value)}
            placeholder="اختیاری"
          />
        </div>
      </section>

      {/* Section 2 — column selection */}
      <section className="space-y-3 pt-2 border-t border-border/70">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Table2 className="w-4 h-4 text-primary" />
          {t.reportColumns}
        </h3>

        {!values.processId && (
          <p className="text-sm text-muted-foreground">{t.selectProcessFirst}</p>
        )}
        {errorFor('columns') && (
          <p className="text-sm text-destructive">{errorFor('columns')}</p>
        )}

        {values.processId && catalogLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.loading}
          </div>
        )}

        {values.processId && !catalogLoading && catalog && (
          <>
            {/* selected columns — ordered, removable */}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.selectedColumns}{' '}
                  <Badge variant="secondary" className="ms-1">
                    {values.columns.length.toLocaleString('fa-IR')}
                  </Badge>
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {t.selectedColumnsHint}
                </span>
              </div>
              {values.columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noReportColumns}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {values.columns.map((col) => (
                    <Badge
                      key={col.key}
                      variant="secondary"
                      className="gap-1 pe-1 font-normal"
                    >
                      {labelForColumn(col)}
                      <button
                        type="button"
                        onClick={() => removeColumn(col.key)}
                        className="rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive"
                        aria-label={t.delete}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {/* instance data fields */}
              <div className="rounded-xl border border-border/70 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Table2 className="w-3.5 h-3.5 text-primary" />
                  {t.instanceDataGroup}
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pe-1">
                  {catalog.instanceFields.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={columnKeys.has(`field:${f.key}`)}
                        onCheckedChange={() => toggleInstanceField(f.key)}
                      />
                      <span>{f.label}</span>
                      <code className="text-[10px] text-muted-foreground ms-auto" dir="ltr">
                        {f.key}
                      </code>
                    </label>
                  ))}
                </div>
              </div>

              {/* process variables */}
              <div className="rounded-xl border border-border/70 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <VariableIcon className="w-3.5 h-3.5 text-primary" />
                  {t.processVarsGroup}
                </div>
                <p className="text-[11px] text-muted-foreground">{t.processVarsHint}</p>
                {catalog.variables.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noVariables}</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pe-1">
                    {catalog.variables.map((v) => (
                      <label
                        key={v.name}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={columnKeys.has(`var:${v.name}`)}
                          onCheckedChange={() => toggleVariable(v.name)}
                        />
                        <span className="truncate">{v.label}</span>
                        <code className="text-[10px] text-muted-foreground ms-auto shrink-0" dir="ltr">
                          {v.name}
                        </code>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Section 3 — filters */}
      <section className="space-y-3 pt-2 border-t border-border/70">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Table2 className="w-4 h-4 text-primary" />
          {t.reportFilters}
        </h3>

        <div className="grid gap-3 md:grid-cols-2">
          {/* status filter */}
          <div className="rounded-xl border border-border/70 p-3 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t.statusFilter}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {INSTANCE_STATUSES.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={values.statuses.includes(s)}
                    onCheckedChange={() => toggleStatus(s)}
                  />
                  {(t as Record<string, string>)[s] ?? s}
                </label>
              ))}
            </div>
          </div>

          {/* date range */}
          <div className="rounded-xl border border-border/70 p-3 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t.dateRangeFilter}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]" htmlFor="date-from">
                  {t.dateFrom}
                </Label>
                <Input
                  id="date-from"
                  type="date"
                  value={values.dateFrom}
                  onChange={(e) => {
                    setValue('dateFrom', e.target.value);
                    clearPreview();
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]" htmlFor="date-to">
                  {t.dateTo}
                </Label>
                <Input
                  id="date-to"
                  type="date"
                  value={values.dateTo}
                  onChange={(e) => {
                    setValue('dateTo', e.target.value);
                    clearPreview();
                  }}
                  aria-invalid={!!errorFor('dateTo')}
                />
                {errorFor('dateTo') && (
                  <p className="text-xs text-destructive">{errorFor('dateTo')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* variable filters */}
        <div className="rounded-xl border border-border/70 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {t.variableFilters}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!catalog?.variables.length}
              onClick={addFilterRow}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addVariableFilter}
            </Button>
          </div>
          {values.varFilters.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="space-y-2">
              {values.varFilters.map((row) => (
                <div key={row.uid} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Select
                      value={row.name || undefined}
                      onValueChange={(v) => patchFilterRow(row.uid, { name: v })}
                    >
                      <SelectTrigger className="w-40 shrink-0" aria-invalid={!!errorFor(`varFilters.${values.varFilters.findIndex((r) => r.uid === row.uid)}.name`)}>
                        <SelectValue placeholder={t.variableName} />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalog?.variables || []).map((v) => (
                          <SelectItem key={v.name} value={v.name}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={row.op}
                      onValueChange={(v) =>
                        patchFilterRow(row.uid, {
                          op: (REPORT_VARIABLE_OPS as readonly string[]).includes(v)
                            ? (v as VariableFilterRow['op'])
                            : row.op,
                        })
                      }
                    >
                      <SelectTrigger className="w-44 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OP_LABELS).map(([op, label]) => (
                          <SelectItem key={op} value={op}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => patchFilterRow(row.uid, { value: e.target.value })}
                      placeholder={t.filterValue}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => removeFilterRow(row.uid)}
                      aria-label={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {errorFor(`varFilters.${values.varFilters.findIndex((r) => r.uid === row.uid)}.name`) && (
                    <p className="text-xs text-destructive">
                      {errorFor(`varFilters.${values.varFilters.findIndex((r) => r.uid === row.uid)}.name`)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Preview result */}
      {preview && (
        <section className="space-y-2 pt-2 border-t border-border/70">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            {t.previewResult}
            <Badge variant="secondary" className="ms-1">
              {preview.total.toLocaleString('fa-IR')} {t.reportRows}
            </Badge>
          </h3>
          <div className="rounded-xl border border-border/70 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  {preview.columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-start font-medium px-3 py-2 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    {preview!.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                        {formatReportValue(col, row.values[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {preview.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={preview.columns.length}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {t.noInstances}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/70">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          {t.cancel}
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewing || saving || !values.processId || !values.columns.length}
            className="gap-1.5"
          >
            {previewing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {t.previewReport}
          </Button>
          <Button onClick={handleSave} disabled={saving || previewing} className="gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
