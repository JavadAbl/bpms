'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { processDraftsApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  DynamicForm,
  validateDynamicForm,
  type FormField,
} from '@/components/common/dynamic-form';
import { navigateToInstanceEntry } from '@/components/processes/start-process-dialog';
import {
  ArrowRight,
  CheckCircle,
  FileEdit,
  FileText,
  GitBranch,
  Loader2,
  Save,
  Trash2,
  CalendarDays,
} from 'lucide-react';

interface Props {
  draftId: string;
  onBack: () => void;
}

export function DraftDetailView({ draftId, onBack }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: draft, isPending } = useQuery({
    queryKey: ['drafts', 'detail', draftId],
    queryFn: () => processDraftsApi.findOne(draftId),
  });
  const loading = isPending;

  // Seed the editable form from the saved draft data (+ field defaults)
  useEffect(() => {
    if (!draft) return;
    const fields: FormField[] = draft.form?.fields || [];
    const prefill: Record<string, any> = { ...(draft.formData || {}) };
    for (const f of fields) {
      if (prefill[f.name] === undefined && f.defaultValue !== undefined) {
        prefill[f.name] = (f as any).defaultValue;
      }
    }
    setFormData(prefill);
  }, [draft]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) => processDraftsApi.update(draftId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['drafts', 'detail', draftId], updated);
      toast({ title: 'موفقیت', description: t.draftSaved });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, any>) => processDraftsApi.submit(draftId, data),
    onSuccess: async (inst) => {
      toast({ title: 'موفقیت', description: t.draftSubmitted });
      // The submission created an instance — every list that shows them must
      // refresh (they would otherwise serve the 30s-stale cache).
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['process-instances'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await navigateToInstanceEntry(router, inst);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => processDraftsApi.remove(draftId),
    onSuccess: () => {
      toast({ title: 'موفقیت', description: t.draftDiscarded });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      onBack();
    },
  });

  const saving = saveMutation.isPending;
  const submitting = submitMutation.isPending;
  const deleting = deleteMutation.isPending;

  const handleSave = () => saveMutation.mutate(formData);

  const handleSubmit = () => {
    const fields: FormField[] = draft?.form?.fields || [];
    const errors = validateDynamicForm(fields, formData);
    if (Object.keys(errors).length > 0) {
      const firstMsg = Object.values(errors)[0];
      const firstField = fields.find((f) => errors[f.name]);
      toast({
        title: t.invalidFormTitle,
        description: `${firstField?.label || ''}: ${firstMsg}`.trim(),
        variant: 'destructive',
      });
      return;
    }
    submitMutation.mutate(formData);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl md-skeleton" />
        <Skeleton className="h-72 w-full rounded-xl md-skeleton" />
      </div>
    );
  }

  if (!draft) return null;

  const fields: FormField[] = draft.form?.fields || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="-mr-2">
          <ArrowRight className="w-4 h-4 ml-1" />
          {t.back}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="text-destructive"
        >
          <Trash2 className="w-4 h-4 ml-2" />
          {t.discardDraft}
        </Button>
      </div>

      <Card className="border-0 shadow-elev-1 overflow-hidden">
        <div className="bg-primary/8 dark:bg-primary/12 px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <FileEdit className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">
                  {draft.process?.name || t.draftDetail}
                </h2>
                <Badge variant="secondary">{t.draft}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.draftFormHint}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-4 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-muted-foreground mb-0.5 text-xs">
                    <GitBranch className="size-3.5" />
                    {t.taskName}
                  </p>
                  <p className="font-medium truncate">{draft.firstTaskName}</p>
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-muted-foreground mb-0.5 text-xs">
                    <CalendarDays className="size-3.5" />
                    {t.updatedAt || t.createdAt}
                  </p>
                  <p className="font-medium truncate">
                    {formatPersianDateOnly(draft.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="shadow-elev-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <FileText className="size-4" />
            </span>
            {draft.form?.name || 'فرم شروع'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length > 0 ? (
            <DynamicForm
              fields={fields}
              values={formData}
              onChange={setFormData}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              این مرحله فرمی ندارد — با ارسال، فرآیند شروع می‌شود.
            </p>
          )}
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <Button onClick={handleSubmit} disabled={submitting || saving} size="lg">
              {submitting ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 ml-2" />
              )}
              {t.submitDraft}
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || submitting}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              {t.saveDraft}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
