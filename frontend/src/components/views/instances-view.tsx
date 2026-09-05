'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { processInstancesApi, processesApi, tasksApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import type { GridColDef } from '@mui/x-data-grid';
import { Chip, IconButton } from '@mui/material';
import { Search } from 'lucide-react';
import { GitBranch, Plus, Play, RefreshCw, Square } from 'lucide-react';

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
  const [instances, setInstances] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
    if (start !== '1') setSelectedProcess(start);
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
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async () => {
    if (!selectedProcess) return;
    setStarting(true);
    try {
      const inst = await processInstancesApi.start(selectedProcess);
      toast({ title: 'موفقیت', description: 'نمونه فرآیند شروع شد' });
      setShowStart(false);
      setSelectedProcess('');
      // Go straight to the process form: the backend has already created the
      // first task (waitForFirstTask), so if any active step of this instance
      // is visible to the current user (assignee or unclaimed position pool),
      // open its form immediately. Otherwise fall back to the instance detail.
      let firstActive: any = null;
      try {
        const mine = await tasksApi.mine();
        firstActive = (mine as any[])
          .filter((tk) => tk.processInstance?.id === inst?.id)
          .find((tk) => tk.status === 'PENDING');
      } catch {
        // visibility lookup is best-effort — fall back below
      }
      if (firstActive) {
        router.push(`/tasks/${firstActive.id}`);
        return;
      }
      router.push(`/instances/${inst?.id}`);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      await load();
    } finally {
      setStarting(false);
    }
  };

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

  const filtered = useMemo(() => {
    return instances.filter((inst) => {
      if (statusFilter !== 'all' && inst.status !== statusFilter) return false;
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
  }, [instances, statusFilter, search]);

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
        p.row.status === 'RUNNING' ? (
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
          <Dialog open={showStart} onOpenChange={setShowStart}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 ml-2" />
                {t.startInstance}
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{t.startInstance}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">انتخاب فرآیند</label>
                  <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                    <SelectTrigger>
                      <SelectValue placeholder="فرآیند را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (v{p.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleStart}
                  disabled={!selectedProcess || starting}
                  className="w-full"
                >
                  {starting ? (
                    <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 ml-2" />
                  )}
                  شروع
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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

      {/* Terminate confirm */}
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
