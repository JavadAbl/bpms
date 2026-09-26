'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Activity,
  BarChart3,
  Download,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  Square,
} from 'lucide-react';
import { IconButton } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { useReportExecution } from '../hooks';
import { type ReportDefinition } from '../types';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/common/data-table';
import { useToast } from '@/hooks/use-toast';
import { formatReportValue, ReportGridCell } from './report-value';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ReportDefinition | null;
  /** navigate to the instance detail of a clicked row */
  onViewInstance?: (id: string) => void;
}

/**
 * Report runner (v6) — executes a saved report definition and renders the
 * live result: KPI summary, client-side status/search narrowing, the dynamic
 * MUI grid (columns built from the report config) and CSV export. Clicking a
 * row opens the instance timeline for drill-down.
 */
export function ReportRunnerDialog({ open, onOpenChange, report, onViewInstance }: Props) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Execute the saved report while the dialog is open (POST-as-read — the
  // result is a live snapshot, so it refetches on every open).
  const { data: result, isPending: loading, error: runError, refetch: run } = useReportExecution(
    report?.id,
    open,
  );
  const error = runError ? (runError instanceof Error ? runError.message : String(runError)) : '';

  // Client-side narrowing on top of the server-applied saved filters
  const filteredRows = useMemo(() => {
    if (!result) return [];
    return result.rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim();
        const haystack = result.columns
          .map((col) => formatReportValue(col, row.values[col.key]))
          .join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [result, statusFilter, search]);

  // Dynamic grid columns from the report's resolved column meta
  const gridColumns: GridColDef[] = useMemo(() => {
    if (!result) return [];
    const cols: GridColDef[] = result.columns.map((col, idx) => ({
      field: col.key,
      headerName: col.label,
      flex: idx === 0 ? 1.2 : 1,
      minWidth: 130,
      renderCell: (p: any) => <ReportGridCell col={col} raw={p.row.values?.[col.key]} />,
    }));
    if (onViewInstance) {
      cols.push({
        field: '__open',
        headerName: t.actions,
        width: 90,
        sortable: false,
        renderCell: () => (
          <IconButton size="small" aria-label={t.viewInstanceFromReport} title={t.viewInstanceFromReport}>
            <GitBranch fontSize="small" />
          </IconButton>
        ),
      });
    }
    return cols;
  }, [result, onViewInstance]);

  const kpis = useMemo(() => {
    const src = filteredRows;
    return {
      total: src.length,
      running: src.filter((r) => r.status === 'RUNNING').length,
      completed: src.filter((r) => r.status === 'COMPLETED').length,
      ended: src.filter((r) => r.status === 'FAILED' || r.status === 'TERMINATED').length,
    };
  }, [filteredRows]);

  // CSV export — display-formatted values, BOM so Persian survives Excel
  const exportCsv = () => {
    if (!result || !result.columns.length) return;
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = result.columns.map((col) => escape(col.label)).join(',');
    const lines = filteredRows.map((row) =>
      result!.columns
        .map((col) => escape(formatReportValue(col, row.values[col.key], { csv: true })))
        .join(','),
    );
    const csv = '\uFEFF' + [header, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(report?.name || 'report').replace(/[\\/:*?"<>|]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'موفقیت', description: t.csvExported });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pe-12">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </span>
            <span className="truncate">{report?.name}</span>
          </DialogTitle>
          <DialogDescription className="truncate">
            {report?.description || report?.process?.name}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t.loading}
          </div>
        )}

        {!loading && result && (
          <>
            {/* KPI row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <RunnerKpi
                icon={<GitBranch className="w-5 h-5" />}
                label={t.reportRows}
                value={kpis.total}
                tint="bg-primary-container text-on-primary-container"
              />
              <RunnerKpi
                icon={<Activity className="w-5 h-5" />}
                label={t.RUNNING}
                value={kpis.running}
                tint="bg-warning/15 text-warning"
              />
              <RunnerKpi
                icon={<CheckCircle2 className="w-5 h-5" />}
                label={t.COMPLETED}
                value={kpis.completed}
                tint="bg-success/15 text-success"
              />
              <RunnerKpi
                icon={<Ban className="w-5 h-5" />}
                label={t.kpiEndedInstances}
                value={kpis.ended}
                tint="bg-destructive/10 text-destructive"
              />
            </div>

            {/* Toolbar */}
            <Card>
              <CardContent className="p-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-52">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="جستجو در نتایج…"
                    className="ps-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t.status} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.all}</SelectItem>
                    <SelectItem value="RUNNING">{t.RUNNING}</SelectItem>
                    <SelectItem value="COMPLETED">{t.COMPLETED}</SelectItem>
                    <SelectItem value="FAILED">{t.FAILED}</SelectItem>
                    <SelectItem value="TERMINATED">{t.TERMINATED}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => run()} className="gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  {t.refresh}
                </Button>
                <Button size="sm" onClick={exportCsv} className="gap-1.5">
                  <Download className="w-4 h-4" />
                  {t.exportCsv}
                </Button>
              </CardContent>
            </Card>

            {/* result grid */}
            <DataTable
              rows={filteredRows as unknown as Record<string, unknown>[]}
              columns={gridColumns}
              getRowId={(row) => row.id as string}
              onRowClick={
                onViewInstance
                  ? (row) => {
                      onOpenChange(false);
                      onViewInstance(row.id as string);
                    }
                  : undefined
              }
              emptyTitle={t.noInstances}
            />

            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Square className="w-3 h-3" />
              {t.generatedAt}: {new Date(result.generatedAt).toLocaleString('fa-IR')}
              <Badge variant="secondary" className="ms-auto">
                {result.process.name}
              </Badge>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Compact KPI card (same pattern as the instances report overview). */
function RunnerKpi({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold tabular-nums leading-none">
            {value.toLocaleString('fa-IR')}
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
