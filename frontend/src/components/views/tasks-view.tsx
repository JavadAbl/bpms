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
import {
  ClipboardList,
  Eye,
  Hand,
  RefreshCw,
  Search,
} from 'lucide-react';

interface Props {
  onViewTask: (taskId: string) => void;
}

const statusChipSx: Record<string, Record<string, unknown>> = {
  PENDING: {
    bgcolor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
    color: 'var(--warning)',
    border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
  },
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
  SKIPPED: {
    bgcolor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--border)',
  },
};

export function TasksView({ onViewTask }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.mine();
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

  const handleClaim = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await tasksApi.claim(taskId);
      toast({ title: 'موفقیت', description: 'وظیفه ادعا شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // کارتابل = received tasks only. The backend (/tasks/mine) already returns
  // PENDING tasks exclusively — completed/passed tasks are not part of the
  // inbox (they stay visible on the instance timeline). Search is the only
  // client-side filter left.
  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.trim();
    return tasks.filter((task) => {
      const haystack = [
        task.name,
        task.processInstance?.process?.name ?? '',
        task.assignee?.name ?? '',
        task.position?.name ?? '',
      ].join(' ');
      return haystack.includes(q);
    });
  }, [tasks, search]);

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t.taskName,
      flex: 1.5,
      minWidth: 220,
      renderCell: (p) => (
        <span className="flex items-center gap-2 truncate">
          <span className="truncate font-semibold">{p.row.name}</span>
          {p.row.selfService && !p.row.assigneeId && (
            <Chip
              size="small"
              label={t.selfService}
              variant="outlined"
              sx={{
                color: 'var(--warning)',
                bgcolor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--warning) 25%, transparent)',
                fontWeight: 600,
                fontSize: 11,
                height: 22,
              }}
            />
          )}
        </span>
      ),
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
      field: 'assignee',
      headerName: t.assignee,
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) =>
        row.assignee?.name ?? (row.position ? `${t.position}: ${row.position.name}` : '—'),
      renderCell: (p) => (
        <span className="truncate text-muted-foreground">{p.value as string}</span>
      ),
    },
    {
      field: 'status',
      headerName: t.status,
      width: 140,
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
      field: 'createdAt',
      headerName: t.createdAt,
      width: 130,
      renderCell: (p) => (
        <span className="text-muted-foreground" suppressHydrationWarning>
          {formatPersianDateOnly(p.row.createdAt)}
        </span>
      ),
    },
    {
      field: 'actions',
      headerName: t.actions,
      width: 110,
      sortable: false,
      renderCell: (p) => (
        <span className="flex items-center gap-1">
          {p.row.selfService && !p.row.assigneeId && (
            <IconButton
              size="small"
              aria-label={t.claim}
              title={t.claim}
              disabled={actionLoading === p.row.id}
              sx={{ color: 'var(--warning)' }}
              onClick={(e) => {
                e.stopPropagation();
                handleClaim(p.row.id);
              }}
            >
              <Hand size={16} />
            </IconButton>
          )}
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
        </span>
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
          <ClipboardList className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{t.myTasks}</h2>
          <Badge variant="secondary">{tasks.length.toLocaleString('fa-IR')} در انتظار اقدام</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 ml-2" />
          بروزرسانی
        </Button>
      </div>

      {/* Filter row — کارتابل lists received (pending) tasks only; search is the sole filter */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی وظیفه، فرآیند یا مسئول…"
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
        emptyTitle={t.noTasks}
      />
    </div>
  );
}
