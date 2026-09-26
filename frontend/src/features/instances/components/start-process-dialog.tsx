'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProcesses } from '@/features/processes';
import { useCreateDraft } from '../hooks';
import { tasksApi } from '@/features/tasks';
import { t } from '@/lib/i18n';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useZodForm } from '@/hooks/use-zod-form';
import { startProcessSchema } from '../schemas';
import { Lock, Play, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect a process id (deep-link ?start=<processId>) */
  initialProcessId?: string;
}

/**
 * After a draft is submitted (or a legacy start), navigate to the first
 * PENDING task of the new instance if visible to the user; else the case page.
 */
export async function navigateToInstanceEntry(
  router: ReturnType<typeof useRouter>,
  inst: { id: string } | null | undefined,
): Promise<void> {
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
  router.push(`/cases/${inst?.id}`);
}

/**
 * Global "start a process" dialog — reachable from the top bar for every
 * user and from the process report page (deep-link seam ?start=...).
 *
 * Selecting a process creates a DRAFT (does not start the BPMN engine) and
 * opens the draft form. The real instance starts only when the user submits.
 */
export function StartProcessDialog({ open, onOpenChange, initialProcessId }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const {
    values: selection,
    setValue,
    reset,
    errorFor,
    validate,
  } = useZodForm(startProcessSchema, { processId: '' });

  // Startable (ACTIVE + permitted) processes — fetched while the dialog is
  // open via the shared processes query (deduped with the other views).
  // A process with a starter list may only be started by its starters (admins
  // bypass); an empty list means everyone may start.
  const { processes: allProcesses } = useProcesses({ enabled: open });
  const processes = useMemo(
    () =>
      allProcesses
        .filter((p: any) => p.status === 'ACTIVE')
        .filter((p: any) => {
          const starters: string[] = (p.starters || []).map((s: any) => s.userId);
          if (starters.length === 0) return true; // unrestricted
          if (user?.role === 'ADMIN') return true;
          return !!user?.userId && starters.includes(user.userId);
        }),
    [allProcesses, user],
  );

  useEffect(() => {
    if (!open) return;
    reset(
      initialProcessId && processes.some((p: any) => p.id === initialProcessId)
        ? { processId: initialProcessId }
        : { processId: '' },
    );
  }, [open, initialProcessId, processes]);

  const startMutation = useCreateDraft({
    onSuccess: (draft) => {
      toast({ title: 'موفقیت', description: 'پیش‌نویس ایجاد شد — فرم را تکمیل کنید' });
      onOpenChange(false);
      router.push(`/drafts/${draft.id}`);
    },
  });
  const starting = startMutation.isPending;

  const handleStart = () => {
    const parsed = validate();
    if (!parsed) return;
    startMutation.mutate(parsed.processId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t.startProcess}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.selectProcess}</label>
            <Select
              value={selection.processId}
              onValueChange={(v) => setValue('processId', v)}
            >
              <SelectTrigger aria-invalid={!!errorFor('processId')}>
                <SelectValue placeholder="فرآیند را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="truncate">{p.name} (v{p.version})</span>
                      {(p.starters || []).length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 px-1.5 shrink-0"
                        >
                          <Lock className="w-3 h-3" />
                          محدود
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorFor('processId') && (
              <p className="text-xs text-destructive" role="alert">
                {errorFor('processId')}
              </p>
            )}
            {processes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                فرآیند فعالی برای شروع در دسترس شما نیست.
              </p>
            )}
          </div>
          <Button
            onClick={handleStart}
            disabled={starting}
            className="w-full"
          >
            {starting ? (
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 ml-2" />
            )}
            {t.startInstance}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
