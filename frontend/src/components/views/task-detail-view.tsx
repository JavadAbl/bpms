'use client';

import { useState, useEffect } from 'react';
import { tasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowRight,
  Hand,
  XCircle,
  CheckCircle,
  Loader2,
  FileText,
} from 'lucide-react';

interface Props {
  taskId: string;
  onBack: () => void;
}

export function TaskDetailView({ taskId, onBack }: Props) {
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await tasksApi.findOne(taskId);
      setTask(data);
      // Pre-fill form with existing submission data if any
      if (data.submissions && data.submissions.length > 0) {
        const latest = data.submissions[data.submissions.length - 1];
        try {
          setFormData(JSON.parse(latest.data));
        } catch {}
      }
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [taskId]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await tasksApi.claim(taskId);
      toast({ title: 'موفقیت', description: 'وظیفه ادعا شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setClaiming(false);
    }
  };

  const handleRelease = async () => {
    setClaiming(true);
    try {
      await tasksApi.release(taskId);
      toast({ title: 'موفقیت', description: 'وظیفه رها شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setClaiming(false);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await tasksApi.complete(taskId, formData);
      toast({ title: 'موفقیت', description: 'وظیفه تکمیل شد' });
      onBack();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!task) return null;

  const canClaim =
    task.selfService &&
    !task.assigneeId &&
    task.positionId &&
    task.status === 'PENDING';

  const canRelease =
    task.selfService &&
    task.assigneeId === user?.userId &&
    task.status === 'PENDING';

  const canComplete =
    task.status === 'PENDING' &&
    (task.assigneeId === user?.userId ||
      (!task.selfService && task.positionId && !task.assigneeId) ||
      (!task.assigneeId && !task.positionId));

  const fields = task.form?.fields || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowRight className="w-4 h-4 ml-2" />
        {t.back}
      </Button>

      {/* Task header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{task.name}</h2>
                <Badge className={statusColors[task.status]}>
                  {(t as any)[task.status] || task.status}
                </Badge>
                {task.selfService && (
                  <Badge className="bg-orange-100 text-orange-800">{t.selfService}</Badge>
                )}
              </div>
              {task.description && (
                <p className="text-sm text-gray-500">{task.description}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">{t.processName}</p>
              <p className="font-medium">{task.processInstance?.process?.name}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">{t.assignee}</p>
              <p className="font-medium">{task.assignee?.name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">{t.position}</p>
              <p className="font-medium">{task.position?.name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">{t.createdAt}</p>
              <p className="font-medium">
                {new Date(task.createdAt).toLocaleDateString('fa-IR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {canClaim && (
          <Button onClick={handleClaim} disabled={claiming} variant="outline">
            {claiming ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Hand className="w-4 h-4 ml-2" />
            )}
            {t.claim}
          </Button>
        )}
        {canRelease && (
          <Button onClick={handleRelease} disabled={claiming} variant="outline">
            <XCircle className="w-4 h-4 ml-2" />
            {t.release}
          </Button>
        )}
      </div>

      {/* Dynamic form */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {task.form?.name || 'فرم'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field: any) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-red-500 mr-1">*</span>}
                </Label>
                {renderField(field, formData[field.name], (val) =>
                  setFormData({ ...formData, [field.name]: val }),
                )}
              </div>
            ))}
            {canComplete ? (
              <Button
                onClick={handleComplete}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 ml-2" />
                )}
                {t.complete}
              </Button>
            ) : task.selfService && !task.assigneeId ? (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                برای تکمیل این وظیفه، ابتدا آن را ادعا کنید
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Previous submissions */}
      {task.submissions && task.submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ارسال‌های قبلی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.submissions.map((sub: any, i: number) => (
              <div key={sub.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(sub.submittedAt).toLocaleDateString('fa-IR')}
                </p>
                <pre className="text-sm text-gray-700" dir="ltr">
                  {JSON.stringify(JSON.parse(sub.data), null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderField(
  field: any,
  value: any,
  onChange: (val: any) => void,
) {
  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'number':
      return (
        <Input
          id={field.name}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          required={field.required}
          dir="ltr"
          className="text-left"
        />
      );
    case 'date':
      return (
        <Input
          id={field.name}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          dir="ltr"
          className="text-left"
        />
      );
    case 'select':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'checkbox':
      return (
        <div className="flex items-center space-x-2 space-x-reverse">
          <Checkbox
            id={field.name}
            checked={value || false}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <Label htmlFor={field.name} className="text-sm font-normal">
            {field.label}
          </Label>
        </div>
      );
    default: // text
      return (
        <Input
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
  }
}
