'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { tasksApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import type { GridColDef } from '@mui/x-data-grid';
import { Chip, IconButton } from '@mui/material';
import { Eye, History, RefreshCw, Search } from 'lucide-react';

interface Props {
  onViewTask: (taskId: string) => void;
}

const statusChipSx: Record<string, Record<string, unknown>> = {
  COMPLETED: {
    bgcolor: 'color-mix(in srgb, var(--success) 12%, transparent)',
    color: 'var(--success)',
    border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
  },
  CANCELLED: {
    bgcolor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--border)',
  },
};

type StatusFilter = 'ALL' | 'COMPLETED' | 'CANCELLED';

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'COMPLETED', 'CANCELLED'];

/**
 * سوابق کارتابل — the "participated tasks" view (v4).
 *
 * Counterpart of the کارتابل inbox: tasks the user once RECEIVED and has
 * since PASSED — completed by them, or cancelled when the instance ended.
 * The backend keeps the two lists strictly disjoint: /tasks/mine returns
 * PENDING tasks only, /tasks/participated returns non-PENDING ones only.
 */
export function ParticipatedTasksView({ onViewTask }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.participated();
      setTasks(data);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      ALL: tasks.length,
      COMPLETED: tasks.filter((task) => task.status === 'COMPLETED').length,
      CANCELLED: tasks.filter((task) => task.status === 'CANCELLED').length,
    }),
    [tasks],
  );

  const filtered = useMemo(() => {
    let rows = tasks;
    if (statusFilter !== 'ALL') {
      rows = rows.filter((task) => task.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim();
      rows = rows.filter((task) => {
        const haystack = [
          task.name,
          task.processInstance?.process?.name ?? '',
          task.position?.name ?? '',
        ].join(' ');
        return haystack.includes(q);
      });
    }
    return rows;
  }, [tasks, statusFilter, search]);

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t.taskName,
      flex: 1.5,
      minWidth: 220,
      renderCell: (p) => <span className="truncate font-semibold">{p.row.name}</span>,
    },
    {
      field: 'process',
      headerName: t.processName,
      flex: 1.2,
      minWidth: 170,
      valueGetter: (_v, row) => row.processInstance?.process?.name ?? '',
      renderCell: (p) => (
        <span className="truncate text-muted-foreground">{p.value as string}</span>
      ),
    },
    {
      field: 'status',
      headerName: t.status,
      width: 130,
      renderCell: (p) => {
        const s = p.row.status as string;
        return (
          <Chip
            size="small"
            label={(t as Record<string, string>)[s] ?? s}
            variant="outlined"
            sx={{
              ...statusChipSx[s],
              fontWeight: 600,
              fontSize: 12,
              height: 26,
            }}
          />
        );
      },
    },
    {
      field: 'instanceStatus',
      headerName: 'وضعیت نمونه',
      width: 130,
      valueGetter: (_v, row) => row.processInstance?.status ?? '',
      renderCell: (p) => (
        <span className="truncate text-muted-foreground text-sm">
          {(t as Record<string, string>)[p.value as string] ?? ((p.value as string) || '—')}
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
      width: 90,
      sortable: false,
      renderCell: (p) => (
        <IconButton
          size="small"
          aria-label={t.view}
          title={t.view}
          sx={{ color: 'var(--primary)' }}
          onClick={(e) => {
            e.stopPropagation();
            onViewTask(p.row.id);
          }}
        >
          <Eye size={16} />
        </IconButton>
      ),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{t.participatedTasks}</h2>
          <Badge variant="secondary">{counts.ALL.toLocaleString('fa-IR')} وظیفه</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 ml-2" />
          بروزرسانی
        </Button>
      </div>

      {/* Filter row — status chips + search */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f;
              const label = f === 'ALL' ? t.all : (t as Record<string, string>)[f];
              return (
                <Chip
                  key={f}
                  size="small"
                  clickable
                  label={`${label} (${counts[f].toLocaleString('fa-IR')})`}
                  onClick={() => setStatusFilter(f)}
                  sx={{
                    fontWeight: active ? 700 : 500,
                    fontSize: 12,
                    height: 28,
                    bgcolor: active ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                    border: `1px solid ${
                      active
                        ? 'color-mix(in srgb, var(--primary) 35%, transparent)'
                        : 'var(--border)'
                    }`,
                  }}
                />
              );
            })}
          </div>
          <div className="relative flex-1 min-w-52">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی وظیفه یا فرآیند…"
              className="ps-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data grid */}
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(row) => row.id as string}
        onRowClick={(row) => onViewTask(row.id as string)}
        emptyTitle={t.noParticipatedTasks}
      />
    </div>
  );
}
