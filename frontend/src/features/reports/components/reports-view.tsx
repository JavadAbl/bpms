'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { IconButton } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { reportsApi } from '../api';
import { type ReportDefinition } from '../types';
import { t } from '@/lib/i18n';
import { formatPersianDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/common/data-table';
import { useToast } from '@/hooks/use-toast';

// The runner (MUI grid + execute flow) is a lazy chunk, mounted only while a
// report is actually being run — the reports landing page stays light.
const ReportRunnerDialog = dynamic(
  () => import('@/features/reports/components/report-runner-dialog').then((m) => m.ReportRunnerDialog),
  { ssr: false },
);

interface Props {
  onViewInstance: (id: string) => void;
}

/**
 * گزارش‌ساز (v7) — admin report landing page.
 * Lists the saved report definitions; each row runs / deletes.
 * ADMIN-only route (guarded by the /admin layout).
 */
export function ReportsView({ onViewInstance }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.findAll(),
  });
  const reports = data ?? [];
  const loading = isPending;

  const [running, setRunning] = useState<ReportDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportDefinition | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.remove(id),
    onSuccess: () => {
      toast({ title: 'موفقیت', description: t.reportDeleted });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };
  const deleting = deleteMutation.isPending;

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t.reportName,
      flex: 1.5,
      minWidth: 180,
      renderCell: (p) => (
        <div className="min-w-0">
          <span className="truncate font-semibold block">{p.row.name as string}</span>
          {(p.row.description as string) && (
            <span className="truncate block text-xs text-muted-foreground">
              {p.row.description as string}
            </span>
          )}
        </div>
      ),
    },
    {
      field: 'process',
      headerName: t.reportProcess,
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) => row.process?.name ?? '—',
    },
    {
      field: 'columnCount',
      headerName: t.reportColumns,
      width: 110,
      renderCell: (p) => (
        <span className="tabular-nums">{(p.value as number).toLocaleString('fa-IR')}</span>
      ),
    },
    {
      field: 'filterCount',
      headerName: t.reportFilters,
      width: 110,
      renderCell: (p) =>
        (p.value as number) > 0 ? (
          <span className="tabular-nums">{(p.value as number).toLocaleString('fa-IR')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      field: 'createdBy',
      headerName: t.assigneeUser,
      flex: 0.9,
      minWidth: 120,
      valueGetter: (_v, row) => row.createdBy?.name ?? '—',
    },
    {
      field: 'updatedAt',
      headerName: t.updatedDate,
      width: 150,
      renderCell: (p) => (
        <span className="text-muted-foreground" suppressHydrationWarning>
          {formatPersianDate(p.row.updatedAt as string)}
        </span>
      ),
    },
    {
      field: 'actions',
      headerName: t.actions,
      width: 150,
      sortable: false,
      renderCell: (p) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <IconButton
            size="small"
            aria-label={t.runReport}
            title={t.runReport}
            sx={{
              color: 'var(--primary)',
              '&:hover': { bgcolor: 'color-mix(in srgb, var(--primary) 10%, transparent)' },
            }}
            onClick={() => setRunning(p.row as unknown as ReportDefinition)}
          >
            <Play fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={t.deleteReport}
            title={t.deleteReport}
            sx={{
              color: 'var(--destructive)',
              '&:hover': { bgcolor: 'color-mix(in srgb, var(--destructive) 10%, transparent)' },
            }}
            onClick={() => setDeleteTarget(p.row as unknown as ReportDefinition)}
          >
            <Trash2 fontSize="small" />
          </IconButton>
        </div>
      ),
    },
  ];

  if (loading && !reports.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <BarChart3 className="w-6 h-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight">{t.reportBuilder}</h2>
            <p className="text-sm text-muted-foreground truncate">{t.reportBuilderHint}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">{t.noReports}</p>
              <p className="text-sm text-muted-foreground">{t.reportBuilderHint}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          rows={reports as unknown as Record<string, unknown>[]}
          columns={columns}
          getRowId={(row) => row.id as string}
          onRowClick={(row) => setRunning(row as unknown as ReportDefinition)}
          emptyTitle={t.noReports}
        />
      )}

      {/* Runner (execute + CSV export) — mounted only while a report runs */}
      {running && (
        <ReportRunnerDialog
          open
          onOpenChange={(open) => {
            if (!open) setRunning(null);
          }}
          report={running}
          onViewInstance={onViewInstance}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteReport}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault(); // keep dialog open until API resolves
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
