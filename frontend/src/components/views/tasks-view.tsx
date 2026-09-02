'use client';

import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Eye,
  Hand,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  onViewTask: (taskId: string) => void;
}

export function TasksView({ onViewTask }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const completedTasks = tasks.filter((t) => t.status !== 'PENDING');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.myTasks}</h2>
          <Badge variant="secondary">{pendingTasks.length} در انتظار</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 ml-2" />
          بروزرسانی
        </Button>
      </div>

      {/* Tasks table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">وظایف در انتظار</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTasks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{t.noTasks}</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{task.name}</span>
                      {task.selfService && !task.assigneeId && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">
                          {t.selfService}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{task.processInstance?.process?.name}</span>
                      {task.assignee && (
                        <span>• مسئول: {task.assignee.name}</span>
                      )}
                      {task.position && !task.assigneeId && (
                        <span>• موقعیت: {task.position.name}</span>
                      )}
                      <span>• {new Date(task.createdAt).toLocaleDateString('fa-IR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.selfService && !task.assigneeId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaim(task.id)}
                        disabled={actionLoading === task.id}
                      >
                        <Hand className="w-3.5 h-3.5 ml-1" />
                        {t.claim}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onViewTask(task.id)}
                    >
                      <Eye className="w-3.5 h-3.5 ml-1" />
                      {t.view}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              وظایف تکمیل شده ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onViewTask(task.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{task.name}</span>
                    <span className="text-xs text-gray-400 mr-2">
                      {task.processInstance?.process?.name}
                    </span>
                  </div>
                  <Badge className={`text-xs ${statusColors[task.status]}`}>
                    {(t as any)[task.status] || task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
