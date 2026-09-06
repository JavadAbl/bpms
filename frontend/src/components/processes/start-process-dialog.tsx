'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { processesApi, processInstancesApi, tasksApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect a process id (deep-link ?start=<processId>) */
  initialProcessId?: string;
}

/**
 * Global "start a process" dialog — reachable from the top bar for every
 * user and from the process report page (deep-link seam ?start=...).
 *
 * On success the user is taken straight to the process form: the backend
 * has already created the first task (waitForFirstTask), so if any active
 * step of the new instance is visible to the current user (assignee or
 * unclaimed position pool), its task form opens immediately; otherwise the
 * user lands on the instance detail page.
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
  router.push(`/instances/${inst?.id}`);
}

export function StartProcessDialog({ open, onOpenChange, initialProcessId }: Props) {
  const [processes, setProcesses] = useState<any[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Load startable (ACTIVE) processes each time the dialog opens
  useEffect(() => {
    if (!open) return;
    let alive = true;
    processesApi
      .findAll()
      .then((data) => {
        if (!alive) return;
        const active = (data || []).filter((p: any) => p.status === 'ACTIVE');
        setProcesses(active);
        setSelectedProcess(
          initialProcessId && active.some((p: any) => p.id === initialProcessId)
            ? initialProcessId
            : ''
        );
      })
      .catch((err: any) => {
        toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      });
    return () => {
      alive = false;
    };
  }, [open, initialProcessId]);

  const handleStart = async () => {
    if (!selectedProcess) return;
    setStarting(true);
    try {
      const inst = await processInstancesApi.start(selectedProcess);
      toast({ title: 'موفقیت', description: 'نمونه فرآیند شروع شد' });
      onOpenChange(false);
      await navigateToInstanceEntry(router, inst);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
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
            {t.startInstance}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
