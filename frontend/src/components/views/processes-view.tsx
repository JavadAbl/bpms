"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { processesApi } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ProcessPreviewDialog } from "@/components/processes/process-preview-dialog";
import { DataTable } from "@/components/common/data-table";
import type { GridColDef } from "@mui/x-data-grid";
import { Chip, IconButton } from "@mui/material";
import { Search } from "lucide-react";
import {
  Workflow,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Play,
} from "lucide-react";

interface Props {
  onOpenDesigner: (processId?: string) => void;
}

const statusChipSx: Record<string, Record<string, unknown>> = {
  DRAFT: {
    bgcolor: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "1px solid var(--border)",
  },
  ACTIVE: {
    bgcolor: "color-mix(in srgb, var(--success) 12%, transparent)",
    color: "var(--success)",
    border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
  },
  ARCHIVED: {
    bgcolor: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "1px solid var(--border)",
  },
};

export function ProcessesView({ onOpenDesigner }: Props) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // ---- read-only preview dialog state ----
  const [previewProcess, setPreviewProcess] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewXml, setPreviewXml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (proc: any) => {
    setPreviewProcess({ id: proc.id, name: proc.name });
    setPreviewXml(null);
    setPreviewLoading(true);
    try {
      const full = await processesApi.findOne(proc.id);
      setPreviewXml(full.bpmnXml || null);
    } catch (err: any) {
      toast({ title: "خطا", description: err.message, variant: "destructive" });
      setPreviewProcess(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await processesApi.findAll();
      setProcesses(data);
    } catch (err: any) {
      toast({ title: "خطا", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف این فرآیند مطمئن هستید؟")) return;
    try {
      await processesApi.remove(id);
      toast({ title: "موفقیت", description: "فرآیند حذف شد" });
      await load();
    } catch (err: any) {
      toast({ title: "خطا", description: err.message, variant: "destructive" });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await processesApi.update(id, { status: "ACTIVE" });
      toast({ title: "موفقیت", description: "فرآیند فعال شد" });
      await load();
    } catch (err: any) {
      toast({ title: "خطا", description: err.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    return processes.filter((proc) => {
      if (statusFilter !== "all" && proc.status !== statusFilter) return false;
      if (search) {
        const q = search.trim();
        if (q && !`${proc.name} ${proc.description ?? ""}`.includes(q))
          return false;
      }
      return true;
    });
  }, [processes, statusFilter, search]);

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: t.name,
      flex: 1.6,
      minWidth: 220,
      renderCell: (p) => (
        <span className="flex h-full w-full min-w-0 flex-col justify-center overflow-hidden leading-tight">
          <button
            type="button"
            className="truncate font-semibold text-start hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDesigner(p.row.id);
            }}
          >
            {p.row.name}
          </button>
          {p.row.description && (
            <span className="truncate text-xs text-muted-foreground">
              {p.row.description}
            </span>
          )}
        </span>
      ),
    },
    {
      field: "version",
      headerName: t.version,
      width: 90,
      renderCell: (p) => <span>v{p.row.version}</span>,
    },
    {
      field: "status",
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
      field: "assignments",
      headerName: t.assignments,
      width: 110,
      valueGetter: (_v, row) => row.assignments?.length ?? 0,
      renderCell: (p) => (
        <span className="tabular-nums">
          {(p.value ?? 0).toLocaleString("fa-IR")}
        </span>
      ),
    },
    {
      field: "actions",
      headerName: t.actions,
      width: 190,
      sortable: false,
      renderCell: (p) => (
        <span className="flex items-center gap-0.5">
          <IconButton
            size="small"
            title="پیش‌نمایش (فقط خواندنی، همراه شرط‌ها)"
            aria-label="پیش‌نمایش"
            sx={{ color: "var(--primary)" }}
            onClick={(e) => {
              e.stopPropagation();
              openPreview(p.row);
            }}
          >
            <Eye size={16} />
          </IconButton>
          <IconButton
            size="small"
            title={t.edit}
            aria-label={t.edit}
            sx={{ color: "var(--primary)" }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDesigner(p.row.id);
            }}
          >
            <Edit size={16} />
          </IconButton>
          {p.row.status === "DRAFT" && (
            <IconButton
              size="small"
              title="فعال‌سازی"
              aria-label="فعال‌سازی"
              sx={{ color: "var(--success)" }}
              onClick={(e) => {
                e.stopPropagation();
                handleActivate(p.row.id);
              }}
            >
              <Play size={16} />
            </IconButton>
          )}
          <IconButton
            size="small"
            title={t.delete}
            aria-label={t.delete}
            sx={{
              color: "var(--destructive)",
              "&:hover": {
                bgcolor:
                  "color-mix(in srgb, var(--destructive) 10%, transparent)",
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(p.row.id);
            }}
          >
            <Trash2 size={16} />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{t.processes}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" onClick={() => onOpenDesigner()}>
            <Plus className="w-4 h-4 ml-2" />
            ایجاد فرآیند
          </Button>
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
              placeholder="جستجوی فرآیند…"
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.all}</SelectItem>
              <SelectItem value="DRAFT">{t.draft}</SelectItem>
              <SelectItem value="ACTIVE">{t.active}</SelectItem>
              <SelectItem value="ARCHIVED">{t.archived}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Data grid */}
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(row) => row.id as string}
        onRowClick={(row) => onOpenDesigner(row.id as string)}
        emptyTitle={t.noProcesses}
      />

      <ProcessPreviewDialog
        open={!!previewProcess}
        processName={previewProcess?.name || ""}
        bpmnXml={previewXml}
        loadingXml={previewLoading}
        onClose={() => setPreviewProcess(null)}
      />
    </div>
  );
}
