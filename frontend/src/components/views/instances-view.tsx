'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { processInstancesApi, processesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import { StartProcessDialog } from '@/components/processes/start-process-dialog';
import type { GridColDef } from '@mui/x-data-grid';
import { Chip, IconButton } from '@mui/material';
import { Search } from 'lucide-react';
import {
  Activity,
  Ban,
  CheckCircle2,
  GitBranch,
  Plus,
  RefreshCw,
  Square,
} from 'lucide-react';

interface Props {
  onViewInstance: (id: string) => void;
}

/** Status → Chip colors, sourced from the MD3 tokens (theme-aware). */
const statusChipSx: Record<string, Record<string, unknown>> = {
  RUNNING: {
    bgcolor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    color: 'var(--primary)',
    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
  },
  COMPLETED: {
    bgcolor: 'color-mix(in srgb, var(--success) 12%, transparent)',
    color: 'var(--success)',
    border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
  },
  FAILED: {
    bgcolor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
    color: 'var(--destructive)',
    border: '1px solid color-mix(in srgb, var(--destructive) 30%, transparent)',
  },
  TERMINATED: {
    bgcolor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--border)',
  },
};

const statusOrder: Record<string, number> = {
  RUNNING: 0,
  COMPLETED: 1,
  FAILED: 2,
  TERMINATED: 3,
};

function StatusChip({ status }: { status: string }) {
  const label = (t as Record<string, string>)[status] ?? status;
  return (
    <Chip
      size="small"
      label={label}
      variant="outlined"
      sx={{
        ...statusChipSx[status],
        fontWeight: 600,
        fontSize: 12,
        height: 26,
      }}
    />
  );
}

export function InstancesView({ onViewInstance }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [instances, setInstances] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [startProcessId, setStartProcessId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processFilter, setProcessFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [terminateTarget, setTerminateTarget] = useState<any>(null);
  const [terminating, setTerminating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link seam: /instances?start=<processId|1> opens the start dialog
  // (used by the command palette and dashboard quick actions)
  useEffect(() => {
    const start = searchParams.get('start');
    if (!start) return;
    if (start !== '1') setStartProcessId(start);
    setShowStart(true);
    router.replace('/instances', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, procs] = await Promise.all([
        processInstancesApi.findAll(),
        processesApi.findAll(),
      ]);
      setInstances(insts);
      setProcesses(procs.filter((p) => p.status === 'ACTIVE'));
    } catch (err: any) {
      // The all-instances report is ADMIN-only — non-admins following a
      // deep-link (palette/dashboard "start process") gracefully degrade
      // to their own instances instead of an error screen.
      if (err?.status === 403) {
        try {
          const [mine, procs] = await Promise.all([
            processInstancesApi.mine(),
            processesApi.findAll(),
          ]);
          setInstances(mine);
          setProcesses(procs.filter((p) => p.status === 'ACTIVE'));
        } catch (e: any) {
          toast({ title: 'خطا', description: e.message, variant: 'destructive' });
        }
      } else {
        toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    setTerminating(true);
    try {
      await processInstancesApi.terminate(terminateTarget.id);
      toast({ title: 'موفقیت', description: 'نمونه خاتمه یافت' });
      setTerminateTarget(null);
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setTerminating(false);
    }
  };

  // KPI summary (admin report overview; for non-admins it reflects their own scope)
  const kpis = useMemo(
    () => ({
      total: instances.length,
      running: instances.filter((i) => i.status === 'RUNNING').length,
      completed: instances.filter((i) => i.status === 'COMPLETED').length,
      ended: instances.filter((i) => i.status === 'FAILED' || i.status === 'TERMINATED').length,
    }),
    [instances],
  );

  // Distinct processes present in the loaded scope → report filter options
  const processOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const inst of instances) {
      if (inst.process?.id && !map.has(inst.process.id)) {
        map.set(inst.process.id, inst.process.name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [instances]);

  const filtered = useMemo(() => {
    return instances.filter((inst) => {
      if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
      if (processFilter !== 'all' && inst.process?.id !== processFilter) return false;
      if (search) {
        const q = search.trim();
        const haystack = [
          inst.process?.name ?? '',
          inst.startedBy?.name ?? '',
        ].join(' ');
        if (q && !haystack.includes(q)) return false;
      }
      return true;
    });
  }, [instances, statusFilter, processFilter, search]);

  const columns: GridColDef[] = [
    {
      field: 'processName',
      headerName: t.processName,
      flex: 1.4,
      minWidth: 180,
      valueGetter: (_v, row) => row.process?.name ?? '',
      renderCell: (p) => (
        <span className="truncate font-semibold">{p.value as string}</span>
      ),
    },
    {
      field: 'status',
      headerName: t.status,
      width: 150,
      sortComparator: (a, b) => (statusOrder[a] ?? 9) - (statusOrder[b] ?? 9),
      renderCell: (p) => <StatusChip status={p.row.status} />,
    },
    {
      field: 'currentStep',
      headerName: t.currentStep,
      flex: 1.1,
      minWidth: 150,
      valueGetter: (_v, row) =>
        (row.tasks ?? [])
          .filter((tk: any) => tk.status === 'PENDING')
          .map((tk: any) => tk.name)
          .join('، '),
      renderCell: (p) =>
        p.value ? (
          <span className="truncate text-sm">{p.value as string}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      field: 'startedBy',
      headerName: t.startedBy,
      flex: 1,
      minWidth: 130,
      valueGetter: (_v, row) => row.startedBy?.name ?? '—',
    },
    {
      field: 'startedAt',
      headerName: t.startedAt,
      width: 140,
      renderCell: (p) => (
        <span className="text-muted-foreground" suppressHydrationWarning>
          {formatPersianDateOnly(p.row.startedAt)}
        </span>
      ),
    },
    {
      field: 'completedAt',
      headerName: t.completedAt,
      width: 140,
      renderCell: (p) => (
        <span className="text-muted-foreground" suppressHydrationWarning>
          {p.row.completedAt ? formatPersianDateOnly(p.row.completedAt) : '—'}
        </span>
      ),
    },
    {
      field: 'actions',
      headerName: t.actions,
      width: 110,
      sortable: false,
      renderCell: (p) =>
        p.row.status === 'RUNNING' && (isAdmin || p.row.startedById === user?.userId) ? (
          <IconButton
            size="small"
            aria-label={t.terminate}
            title={t.terminate}
            sx={{
              color: 'var(--destructive)',
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              setTerminateTarget(p.row);
            }}
          >
            <Square size={16} />
          </IconButton>
        ) : null,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{t.instances}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" onClick={() => setShowStart(true)}>
            <Plus className="w-4 h-4 ml-2" />
            {t.startInstance}
          </Button>
        </div>
      </div>

      {/* KPI summary cards ------------------------------------------------ */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpi
          icon={<GitBranch className="w-5 h-5" />}
          label={t.kpiAllInstances}
          value={kpis.total}
          tint="bg-primary-container text-on-primary-container"
        />
        <ReportKpi
          icon={<Activity className="w-5 h-5" />}
          label={t.kpiRunningInstances}
          value={kpis.running}
          tint="bg-warning/15 text-warning"
        />
        <ReportKpi
          icon={<CheckCircle2 className="w-5 h-5" />}
          label={t.COMPLETED}
          value={kpis.completed}
          tint="bg-success/15 text-success"
        />
        <ReportKpi
          icon={<Ban className="w-5 h-5" />}
          label={t.kpiEndedInstances}
          value={kpis.ended}
          tint="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Filter row */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی فرآیند یا شروع‌کننده…"
              className="ps-9"
            />
          </div>
          <Select value={processFilter} onValueChange={setProcessFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t.allProcesses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allProcesses}</SelectItem>
              {processOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </CardContent>
      </Card>

      {/* Data grid */}
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(row) => row.id as string}
        onRowClick={(row) => onViewInstance(row.id as string)}
        emptyTitle={t.noInstances}
      />

      {/* Start process dialog (shared with the top bar) */}
      <StartProcessDialog
        open={showStart}
        onOpenChange={setShowStart}
        initialProcessId={startProcessId}
      />

      <AlertDialog
        open={!!terminateTarget}
        onOpenChange={(open) => !open && setTerminateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTerminate}</AlertDialogTitle>
            <AlertDialogDescription>
              {terminateTarget?.process?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={terminating}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={terminating}
              onClick={(e) => {
                e.preventDefault(); // keep dialog open until API resolves
                handleTerminate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.terminate}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Compact KPI card for the report overview row (total / running / completed / ended).
 * Static by design — the dashboard owns the animated counters.
 */
function ReportKpi({
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
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}
        >
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
