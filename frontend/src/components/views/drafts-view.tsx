'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processDraftsApi } from '@/lib/api';
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
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import type { GridColDef } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import { Eye, FileEdit, RefreshCw, Search, Trash2 } from 'lucide-react';

interface Props {
  onViewDraft: (id: string) => void;
}

export function DraftsView({ onViewDraft }: Props) {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, refetch } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => processDraftsApi.findAll(),
  });
  const drafts = data ?? [];
  const loading = isPending;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => processDraftsApi.remove(id),
    onSuccess: () => {
      toast({ title: 'موفقیت', description: t.draftDiscarded });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  };
  const deleting = deleteMutation.isPending;

  const filtered = useMemo(() => {
    if (!search.trim()) return drafts;
    const q = search.trim().toLowerCase();
    return drafts.filter((d) => {
      const hay = [d.process?.name, d.firstTaskName].map((x) =>
        String(x || '').toLowerCase(),
      );
      return hay.some((h) => h.includes(q));
    });
  }, [drafts, search]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'processName',
        headerName: t.processName,
        flex: 1.4,
        minWidth: 180,
        valueGetter: (_v, row) => row.process?.name || '—',
      },
      {
        field: 'firstTaskName',
        headerName: t.taskName,
        flex: 1,
        minWidth: 140,
      },
      {
        field: 'updatedAt',
        headerName: t.updatedAt || t.createdAt,
        width: 140,
        valueGetter: (_v, row) => formatPersianDateOnly(row.updatedAt),
      },
      {
        field: 'actions',
        headerName: '',
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <div className="flex items-center gap-1">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onViewDraft(params.row.id);
              }}
              title={t.view}
            >
              <Eye className="w-4 h-4" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(params.row.id);
              }}
              title={t.delete}
            >
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </div>
        ),
      },
    ],
    [onViewDraft],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-72 w-full rounded-xl md-skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <FileEdit className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold">{t.drafts}</h2>
            <p className="text-xs text-muted-foreground">{t.draftFormHint}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 ml-2" />
          {t.refresh || 'بروزرسانی'}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search || 'جستجو...'}
          className="pr-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-elev-1">
          <CardContent className="py-14 text-center text-muted-foreground">
            <FileEdit className="size-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t.noDrafts}</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(row) => onViewDraft(row.id)}
          emptyTitle={t.noDrafts}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.discardDraft}</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این پیش‌نویس مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
