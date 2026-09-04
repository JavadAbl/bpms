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
          <FileText className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.forms}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditForm(null); setShowPanel(true); }}>
            <Plus className="w-4 h-4 ml-2" />
            ایجاد فرم
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-right p-4 font-medium text-gray-600">{t.formName}</th>
                  <th className="text-right p-4 font-medium text-gray-600">توضیحات</th>
                  <th className="text-right p-4 font-medium text-gray-600">تعداد فیلدها</th>
                  <th className="text-right p-4 font-medium text-gray-600">متغیرها</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      فرمی یافت نشد
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4 font-medium">{form.name}</td>
                      <td className="p-4 text-gray-500">{form.description || '—'}</td>
                      <td className="p-4">
                        <Badge variant="secondary">{form.fields?.length || 0}</Badge>
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
                            className="text-red-600"
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
