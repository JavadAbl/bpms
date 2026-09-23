'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  reportsApi,
  processesApi,
  type ReportColumnConfig,
  type ReportDefinition,
  type ReportFieldCatalog,
  type ReportExecutionResult,
  type ReportFilterConfig,
} from '@/lib/api';
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
  onSaved: (report: ReportDefinition) => void;
  onCancel: () => void;
}

interface VariableFilterRow {
  uid: number;
  name: string;
  op: 'eq' | 'neq' | 'contains';
  value: string;
}

let filterRowSeq = 0;
const nextFilterRow = (): VariableFilterRow => ({ uid: ++filterRowSeq, name: '', op: 'eq', value: '' });

const INSTANCE_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'] as const;

const OP_LABELS: Record<string, string> = {
  eq: t.opEq,
  neq: t.opNeq,
  contains: t.opContains,
};

/**
 * Report builder page (v7) — the admin "no-code" report designer, rendered
 * inline as a full page (not a modal). A report is pure declarative
 * configuration: pick a process, then select columns from its instance data
 * fields and process variables, optionally add STATUS / DATE_RANGE / VARIABLE
 * filters, preview the live result and save. The same execution endpoint runs
 * the preview and the saved report, so «پیش‌نمایش» can never lie.
 */
export function ReportBuilder({ report, onSaved, onCancel }: Props) {
  const isEdit = !!report;
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [processId, setProcessId] = useState<string>('');
  const [processes, setProcesses] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<ReportFieldCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [columns, setColumns] = useState<ReportColumnConfig[]>([]);
  const [statusSet, setStatusSet] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [varFilters, setVarFilters] = useState<VariableFilterRow[]>([]);

  const [preview, setPreview] = useState<ReportExecutionResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Initialize state on mount / when the edited report changes
  useEffect(() => {
    setError('');
    setPreview(null);
    if (report) {
      setName(report.name);
      setDescription(report.description || '');
      setProcessId(report.processId);
      setColumns([...(report.columns || [])]);
      // Parse saved filters into the editable form state
      const status = new Set<string>();
      let from = '';
      let to = '';
      const rows: VariableFilterRow[] = [];
      for (const f of report.filters || []) {
        if (f.type === 'STATUS') (f.statuses || []).forEach((s) => status.add(s));
        else if (f.type === 'DATE_RANGE') {
          if (f.from) from = f.from.slice(0, 10);
          if (f.to) to = f.to.slice(0, 10);
        } else if (f.type === 'VARIABLE') {
          rows.push({ uid: ++filterRowSeq, name: f.name || '', op: (f.op as any) || 'eq', value: f.value || '' });
        }
      }
      setStatusSet(status);
      setDateFrom(from);
      setDateTo(to);
      setVarFilters(rows);
    } else {
      setName('');
      setDescription('');
      setProcessId('');
      setColumns([]);
      setStatusSet(new Set());
      setDateFrom('');
      setDateTo('');
      setVarFilters([]);
    }
    processesApi
      .findAll()
      .then((data) => setProcesses(data || []))
      .catch(() => setProcesses([]));
  }, [report]);

  // Load the field catalog whenever the picked process changes
  useEffect(() => {
    if (!processId) {
      setCatalog(null);
      return;
    }
    let alive = true;
    setCatalogLoading(true);
    setPreview(null);
    reportsApi
      .getFieldCatalog(processId)
      .then((data) => {
        if (alive) setCatalog(data);
      })
      .catch((e: any) => {
        if (alive) {
          setCatalog(null);
          setError(e.message);
        }
      })
      .finally(() => alive && setCatalogLoading(false));
    return () => {
      alive = false;
    };
  }, [processId]);

  // ---- column selection (order = click order) ------------------------------

  const columnKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);

  const toggleInstanceField = (fieldKey: string, label: string) => {
    const key = `field:${fieldKey}`;
    setColumns((cols) =>
      columnKeys.has(key)
        ? cols.filter((c) => c.key !== key)
        : [...cols, { key, source: 'INSTANCE', fieldKey }],
    );
    setPreview(null);
    void label;
  };

  const toggleVariable = (varName: string) => {
    const key = `var:${varName}`;
    setColumns((cols) =>
      columnKeys.has(key)
        ? cols.filter((c) => c.key !== key)
        : [...cols, { key, source: 'VARIABLE', fieldKey: varName }],
    );
    setPreview(null);
  };

  const removeColumn = (key: string) => {
    setColumns((cols) => cols.filter((c) => c.key !== key));
    setPreview(null);
  };

  const labelForColumn = (col: ReportColumnConfig): string => {
    if (col.source === 'INSTANCE') {
      return catalog?.instanceFields.find((f) => f.key === col.fieldKey)?.label || col.fieldKey;
    }
    return catalog?.variables.find((v) => v.name === col.fieldKey)?.label || col.fieldKey;
  };

  // ---- filters ----------------------------------------------------------------

  const toggleStatus = (s: string) => {
    setStatusSet((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
    setPreview(null);
  };

  const buildFilters = useCallback((): ReportFilterConfig[] => {
    const filters: ReportFilterConfig[] = [];
    if (statusSet.size) filters.push({ type: 'STATUS', statuses: Array.from(statusSet) });
    if (dateFrom || dateTo) {
      filters.push({ type: 'DATE_RANGE', from: dateFrom || undefined, to: dateTo || undefined });
    }
    for (const row of varFilters) {
      if (!row.name || !row.op) continue;
      filters.push({ type: 'VARIABLE', name: row.name, op: row.op, value: row.value });
    }
    return filters;
  }, [statusSet, dateFrom, dateTo, varFilters]);

  // ---- preview / save ----------------------------------------------------------

  const validate = (): string | null => {
    if (!name.trim()) return t.reportName + ' الزامی است';
    if (!processId) return t.reportNeedsProcess;
    if (!columns.length) return t.noReportColumns;
    return null;
  };

  const handlePreview = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setPreviewing(true);
    try {
      const result = await reportsApi.preview({
        processId,
        columns,
        filters: buildFilters(),
      });
      setPreview(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        processId,
        columns,
        filters: buildFilters(),
      };
      const saved = isEdit && report
        ? await reportsApi.update(report.id, payload)
        : await reportsApi.create(payload);
      toast({ title: 'موفقیت', description: t.reportSaved });
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
      toast({ title: 'خطا', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowRight className="w-4 h-4" />
          {t.back}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
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
            <Label htmlFor="report-name">{t.name}</Label>
            <Input
              id="report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلا گزارش مرخصی‌ها"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-process">{t.reportProcess}</Label>
            <Select
              value={processId || undefined}
              onValueChange={(v) => {
                setProcessId(v);
                setColumns([]);
                setStatusSet(new Set());
                setDateFrom('');
                setDateTo('');
                setVarFilters([]);
              }}
            >
              <SelectTrigger id="report-process">
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
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-desc">{t.description}</Label>
          <Input
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        {!processId && (
          <p className="text-sm text-muted-foreground">{t.selectProcessFirst}</p>
        )}

        {processId && catalogLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.loading}
          </div>
        )}

        {processId && !catalogLoading && catalog && (
          <>
            {/* selected columns — ordered, removable */}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.selectedColumns}{' '}
                  <Badge variant="secondary" className="ms-1">
                    {columns.length.toLocaleString('fa-IR')}
                  </Badge>
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {t.selectedColumnsHint}
                </span>
              </div>
              {columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noReportColumns}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((col) => (
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
                        onCheckedChange={() => toggleInstanceField(f.key, f.label)}
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
                    checked={statusSet.has(s)}
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
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPreview(null);
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
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPreview(null);
                  }}
                />
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
              onClick={() => {
                setVarFilters((rows) => [...rows, nextFilterRow()]);
                setPreview(null);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addVariableFilter}
            </Button>
          </div>
          {varFilters.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="space-y-2">
              {varFilters.map((row, idx) => (
                <div key={row.uid} className="flex items-center gap-2">
                  <Select
                    defaultValue={row.name || undefined}
                    onValueChange={(v) => {
                      setVarFilters((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, name: v } : r)),
                      );
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger className="w-40 shrink-0">
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
                    onValueChange={(v) => {
                      setVarFilters((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, op: v as any } : r)),
                      );
                      setPreview(null);
                    }}
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
                    onChange={(e) => {
                      setVarFilters((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                      );
                      setPreview(null);
                    }}
                    placeholder={t.filterValue}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setVarFilters((rows) => rows.filter((_, i) => i !== idx));
                      setPreview(null);
                    }}
                    aria-label={t.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t.cancel}
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewing || saving || !processId || !columns.length}
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
