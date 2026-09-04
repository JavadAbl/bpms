'use client';

import { useState, useEffect } from 'react';
import { processInstancesApi } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Clock, CheckCircle, XCircle, Circle } from 'lucide-react';

interface Props {
  instanceId: string;
  onBack: () => void;
}

export function InstanceDetailView({ instanceId, onBack }: Props) {
  const [instance, setInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await processInstancesApi.findOne(instanceId);
        setInstance(data);
      } catch (err: any) {
        toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!instance) return null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowRight className="w-4 h-4 ml-2" />
        {t.back}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{instance.process?.name}</h2>
            <Badge className={statusColors[instance.status]}>
              {(t as any)[instance.status] || instance.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">شروع کننده</p>
              <p className="font-medium">{instance.startedBy?.name}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">تاریخ شروع</p>
              <p className="font-medium">
                {new Date(instance.startedAt).toLocaleDateString('fa-IR')}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">تاریخ تکمیل</p>
              <p className="font-medium">
                {instance.completedAt
                  ? new Date(instance.completedAt).toLocaleDateString('fa-IR')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">نسخه</p>
              <p className="font-medium">v{instance.process?.version}</p>
            </div>
          </div>
          {instance.lastError && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              {instance.lastError}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">زمان‌بندی وظایف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(instance.tasks || []).map((task: any, i: number) => (
              <div key={task.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  {task.status === 'COMPLETED' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : task.status === 'PENDING' ? (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  ) : task.status === 'CANCELLED' ? (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                  {i < (instance.tasks?.length || 0) - 1 && (
                    <div className="w-px h-8 bg-gray-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.name}</span>
                    <Badge className={`text-xs ${statusColors[task.status]}`}>
                      {(t as any)[task.status] || task.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {task.assignee && <span>مسئول: {task.assignee.name}</span>}
                    {task.position && !task.assignee && (
                      <span>موقعیت: {task.position.name}</span>
                    )}
                    {task.createdAt && (
                      <span>{new Date(task.createdAt).toLocaleDateString('fa-IR')}</span>
                    )}
                    {task.completedAt && (
                      <span>→ {new Date(task.completedAt).toLocaleDateString('fa-IR')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
