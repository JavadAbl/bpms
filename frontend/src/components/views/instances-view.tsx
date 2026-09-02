'use client';

import { useState, useEffect, useCallback } from 'react';
import { processInstancesApi, processesApi } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GitBranch, Plus, Play, RefreshCw, Square } from 'lucide-react';

interface Props {
  onViewInstance: (id: string) => void;
}

export function InstancesView({ onViewInstance }: Props) {
  const [instances, setInstances] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, procs] = await Promise.all([
        processInstancesApi.findAll(),
        processesApi.findAll(),
      ]);
      setInstances(insts);
      setProcesses(procs.filter((p) => p.status === 'ACTIVE'));
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async () => {
    if (!selectedProcess) return;
    setStarting(true);
    try {
      await processInstancesApi.start(selectedProcess);
      toast({ title: 'موفقیت', description: 'نمونه فرآیند شروع شد' });
      setShowStart(false);
      setSelectedProcess('');
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  const handleTerminate = async (id: string) => {
    try {
      await processInstancesApi.terminate(id);
      toast({ title: 'موفقیت', description: 'نمونه خاتمه یافت' });
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
          <GitBranch className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.instances}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Dialog open={showStart} onOpenChange={setShowStart}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 ml-2" />
                {t.startInstance}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.startInstance}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">انتخاب فرآیند</label>
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {starting ? (
                    <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 ml-2" />
                  )}
                  شروع
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-right p-4 font-medium text-gray-600">{t.processName}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.status}</th>
                  <th className="text-right p-4 font-medium text-gray-600">شروع کننده</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.createdAt}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.completedAt}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {instances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      نمونه‌ای یافت نشد
                    </td>
                  </tr>
                ) : (
                  instances.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onViewInstance(inst.id)}
                    >
                      <td className="p-4 font-medium">{inst.process?.name}</td>
                      <td className="p-4">
                        <Badge className={statusColors[inst.status]}>
                          {(t as any)[inst.status] || inst.status}
                        </Badge>
                      </td>
                      <td className="p-4">{inst.startedBy?.name || '—'}</td>
                      <td className="p-4 text-gray-500">
                        {new Date(inst.startedAt).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="p-4 text-gray-500">
                        {inst.completedAt
                          ? new Date(inst.completedAt).toLocaleDateString('fa-IR')
                          : '—'}
                      </td>
                      <td className="p-4">
                        {inst.status === 'RUNNING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTerminate(inst.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Square className="w-3.5 h-3.5 ml-1" />
                            {t.terminate}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
