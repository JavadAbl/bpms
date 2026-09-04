'use client';

import { useState, useEffect, useCallback } from 'react';
import { processesApi } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ProcessPreviewDialog } from '@/components/processes/process-preview-dialog';
import { Workflow, Plus, RefreshCw, Trash2, Edit, Eye, Play } from 'lucide-react';

interface Props {
  onOpenDesigner: (processId?: string) => void;
}

export function ProcessesView({ onOpenDesigner }: Props) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ---- read-only preview dialog state ----
  const [previewProcess, setPreviewProcess] = useState<{ id: string; name: string } | null>(null);
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
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
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
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این فرآیند مطمئن هستید؟')) return;
    try {
      await processesApi.remove(id);
      toast({ title: 'موفقیت', description: 'فرآیند حذف شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await processesApi.update(id, { status: 'ACTIVE' });
      toast({ title: 'موفقیت', description: 'فرآیند فعال شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.processes}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onOpenDesigner()}>
            <Plus className="w-4 h-4 ml-2" />
            ایجاد فرآیند
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-right p-4 font-medium text-gray-600">نام</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.version}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.status}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.assignments}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      فرآیندی یافت نشد
                    </td>
                  </tr>
                ) : (
                  processes.map((proc) => (
                    <tr key={proc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4">
                        <button
                          onClick={() => onOpenDesigner(proc.id)}
                          className="text-right"
                        >
                          <p className="font-medium hover:text-emerald-600">{proc.name}</p>
                          {proc.description && (
                            <p className="text-xs text-gray-500">{proc.description}</p>
                          )}
                        </button>
                      </td>
                      <td className="p-4">v{proc.version}</td>
                      <td className="p-4">
                        <Badge className={statusColors[proc.status]}>
                          {(t as any)[proc.status] || proc.status}
                        </Badge>
                      </td>
                      <td className="p-4">{proc.assignments?.length || 0}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreview(proc)}
                            title="پیش‌نمایش (فقط خواندنی، همراه شرط‌ها)"
                            className="text-violet-600"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenDesigner(proc.id)}
                            title="ویرایش"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {proc.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(proc.id)}
                              title="فعال‌سازی"
                              className="text-green-600"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(proc.id)}
                            className="text-red-600"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ProcessPreviewDialog
        open={!!previewProcess}
        processName={previewProcess?.name || ''}
        bpmnXml={previewXml}
        loadingXml={previewLoading}
        onClose={() => setPreviewProcess(null)}
      />
    </div>
  );
}
