'use client';

import { useState, useEffect, useCallback } from 'react';
import { formsApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, RefreshCw, Trash2, Edit, Variable } from 'lucide-react';
import { FormBuilderPanel } from '@/components/forms/form-builder-panel';

export function FormsView() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Show all forms (including global + process-scoped) in the forms list
      const data = await formsApi.findAll();
      setForms(data);
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
    if (!confirm('آیا از حذف این فرم مطمئن هستید؟')) return;
    try {
      await formsApi.remove(id);
      toast({ title: 'موفقیت', description: 'فرم حذف شد' });
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
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <FileText className="w-5 h-5" />
          </span>
          <h2 className="text-2xl font-bold">{t.forms}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            {t.refresh}
          </Button>
          <Button size="sm" onClick={() => { setEditForm(null); setShowPanel(true); }}>
            <Plus className="w-4 h-4 ml-2" />
            ایجاد فرم
          </Button>
        </div>
      </div>

      <Card className="shadow-elev-1 overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/70 bg-muted/50">
                <tr>
                  <th className="text-right p-4 font-medium text-muted-foreground text-xs">{t.formName}</th>
                  <th className="text-right p-4 font-medium text-muted-foreground text-xs">توضیحات</th>
                  <th className="text-right p-4 font-medium text-muted-foreground text-xs">تعداد فیلدها</th>
                  <th className="text-right p-4 font-medium text-muted-foreground text-xs">متغیرها</th>
                  <th className="text-right p-4 font-medium text-muted-foreground text-xs">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">
                      فرمی یافت نشد
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="border-b border-border/50 last:border-0 hover:bg-accent/60 transition-colors">
                      <td className="p-4 font-medium">{form.name}</td>
                      <td className="p-4 text-muted-foreground">{form.description || '—'}</td>
                      <td className="p-4">
                        <Badge variant="secondary" className="rounded-full">{form.fields?.length || 0}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(form.fields || []).slice(0, 3).map((f: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-mono" dir="ltr">
                              <Variable className="w-2.5 h-2.5 ml-1" />
                              {f.variable || f.name}
                            </Badge>
                          ))}
                          {(form.fields || []).length > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{(form.fields || []).length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditForm(form); setShowPanel(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(form.id)}
                            className="text-destructive"
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

      {showPanel && (
        <FormBuilderPanel
          form={editForm}
          onClose={() => setShowPanel(false)}
          onSaved={async () => {
            setShowPanel(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
