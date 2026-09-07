'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t, statusColors } from '@/lib/i18n';
import { formatPersianDate, formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { OptionSelect } from '@/components/common/option-select';
import { FileUploadField } from '@/components/common/file-upload-field';
import { validateDynamicForm } from '@/components/common/dynamic-form';
import {
  ArrowRight,
  Hand,
  XCircle,
  CheckCircle,
  Loader2,
  FileText,
  Lock,
  Info,
  ClipboardList,
  User,
  Users,
  CalendarDays,
  GitBranch,
  History,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  taskId: string;
  onBack: () => void;
}

export function TaskDetailView({ taskId, onBack }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setDenied(false);
    try {
      const data = await tasksApi.findOne(taskId);
      setTask(data);
      // Pre-fill the form:
      //  1. Data filled in PREVIOUS tasks of this instance (process variables)
      //  2. Field default values
      //  3. This task's own latest submission (draft recovery) — highest priority
      const fields: any[] = data.form?.fields || [];
      const vars: Record<string, any> = data.instanceVariables || {};
      const prefill: Record<string, any> = {};
      for (const f of fields) {
        const varName = f.variable || f.name;
        const fromInstance = vars[varName] ?? vars[f.name];
        if (fromInstance !== undefined && fromInstance !== null && fromInstance !== '') {
          prefill[f.name] = fromInstance;
        } else if (
          f.defaultValue !== undefined &&
          f.defaultValue !== null &&
          f.defaultValue !== ''
        ) {
          prefill[f.name] = f.defaultValue;
        }
      }
      if (data.submissions && data.submissions.length > 0) {
        const latest = data.submissions[data.submissions.length - 1];
        try {
          Object.assign(prefill, JSON.parse(latest.data));
        } catch {}
      }
      setFormData(prefill);
    } catch (err: any) {
      // کارتابل privacy: another user's task → access-denied state, not a toast
      if (err?.status === 403) {
        setDenied(true);
      } else {
        toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await tasksApi.claim(taskId);
      toast({ title: 'موفقیت', description: t.taskClaimed });
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
      toast({ title: 'موفقیت', description: t.taskReleased });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setClaiming(false);
    }
  };

  const handleComplete = async () => {
    // Client-side validation: required editable fields must be filled.
    // Read-only fields are excluded (they display previous tasks' data and
    // cannot be edited — see validateDynamicForm).
    const errors = validateDynamicForm(fields, formData);
    if (Object.keys(errors).length > 0) {
      const firstMsg = Object.values(errors)[0];
      const firstField = fields.find((f: any) => errors[f.name]);
      toast({
        title: t.invalidFormTitle,
        description: `${firstField?.label || ''}: ${firstMsg}`.trim(),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      // Read-only fields are display-only mirrors of process variables:
      // keep them when they carry a value (re-saving the same variable is
      // harmless), but never submit an EMPTY read-only field — that would
      // overwrite a real variable with an empty value.
      const payload: Record<string, any> = { ...formData };
      for (const f of fields) {
        if (!f.readOnly) continue;
        const v = payload[f.name];
        if (v === undefined || v === null || v === '') delete payload[f.name];
      }
      await tasksApi.complete(taskId, payload);
      toast({ title: 'موفقیت', description: t.taskCompleted });
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
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl md-skeleton" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-72 w-full rounded-xl md-skeleton" />
          <Skeleton className="h-72 w-full rounded-xl md-skeleton" />
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="-mr-2">
          <ArrowRight className="w-4 h-4 ml-1" />
          {t.back}
        </Button>
        <Card className="shadow-elev-1">
          <CardContent className="py-14 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-7" />
            </span>
            <h3 className="text-lg font-bold">{t.accessDeniedTitle}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {t.accessDeniedTask}
            </p>
          </CardContent>
        </Card>
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
  const instanceId: string | undefined =
    task.processInstanceId ?? task.processInstance?.id;
  const hasSubmissions = task.submissions && task.submissions.length > 0;

  return (
    <div className="space-y-5">
      {/* Back + actions row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="-mr-2">
          <ArrowRight className="w-4 h-4 ml-1" />
          {t.back}
        </Button>
        {(canClaim || canRelease) && (
          <div className="flex items-center gap-2">
            {canClaim && (
              <Button onClick={handleClaim} disabled={claiming} variant="outline" size="sm">
                {claiming ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Hand className="w-4 h-4 ml-2" />
                )}
                {t.claim}
              </Button>
            )}
            {canRelease && (
              <Button onClick={handleRelease} disabled={claiming} variant="outline" size="sm">
                <XCircle className="w-4 h-4 ml-2" />
                {t.release}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Task header — MD3 tonal banner */}
      <Card className="border-0 shadow-elev-1 overflow-hidden">
        <div className="bg-primary/8 dark:bg-primary/12 px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <ClipboardList className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{task.name}</h2>
                <Badge className={`border-transparent ${statusColors[task.status]}`}>
                  {(t as any)[task.status] || task.status}
                </Badge>
                {task.selfService && (
                  <Badge className="bg-warning/15 text-warning border-warning/25 border-transparent">
                    {t.selfService}
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-4 text-sm">
                <MetaItem icon={<GitBranch className="size-3.5" />} label={t.processName}>
                  {task.processInstance?.process?.name}
                </MetaItem>
                <MetaItem icon={<User className="size-3.5" />} label={t.assignee}>
                  {task.assignee?.name || '—'}
                </MetaItem>
                <MetaItem icon={<Users className="size-3.5" />} label={t.position}>
                  {task.position?.name || '—'}
                </MetaItem>
                <MetaItem icon={<CalendarDays className="size-3.5" />} label={t.createdAt}>
                  {formatPersianDateOnly(task.createdAt)}
                </MetaItem>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Two-pane: form RIGHT (first column in RTL), metadata+history LEFT */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* ── Right pane: dynamic form ─────────────────────────────── */}
        <div className="space-y-5">
          {fields.length > 0 ? (
            <Card className="shadow-elev-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <FileText className="size-4" />
                  </span>
                  {task.form?.name || 'فرم'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.some((f: any) => f.readOnly) && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/60 text-secondary-foreground text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <span>
                      مقادیر واردشده در وظایف قبلی این فرآیند به‌صورت خودکار نمایش داده می‌شوند؛
                      فیلدهای فقط‌خواندنی قابل ویرایش نیستند.
                    </span>
                  </div>
                )}
                {fields.map((field: any) =>
                  field.readOnly ? (
                    // Read-only: tonal surface + lock, mirrors previous-task data
                    <div
                      key={field.name}
                      className="rounded-xl border bg-secondary/40 border-border/70 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
                        <Lock className="w-3 h-3" />
                        <span>{field.label}</span>
                        {formData[field.name] !== undefined &&
                          formData[field.name] !== null &&
                          formData[field.name] !== '' && (
                            <span className="text-primary/80">· {t.readOnlySourceHint}</span>
                          )}
                      </div>
                      {renderField(field, formData[field.name], (val) =>
                        setFormData({ ...formData, [field.name]: val }),
                      )}
                      {formData[field.name] === undefined ||
                      formData[field.name] === null ||
                      formData[field.name] === '' ? (
                        <p className="text-[11px] text-muted-foreground/80 mt-1">
                          {t.readOnlyHint}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div key={field.name} className="space-y-2">
                      <label
                        htmlFor={field.name}
                        className="flex items-center gap-1.5 text-sm font-medium"
                      >
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </label>
                      {renderField(field, formData[field.name], (val) =>
                        setFormData({ ...formData, [field.name]: val }),
                      )}
                    </div>
                  ),
                )}
                {canComplete ? (
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      onClick={handleComplete}
                      disabled={submitting}
                      size="lg"
                      className="min-w-36"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 ml-2" />
                      )}
                      {t.complete}
                    </Button>
                  </div>
                ) : task.selfService && !task.assigneeId ? (
                  <p className="text-sm text-warning bg-warning/10 p-3 rounded-lg">
                    {t.claimFirstHint}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-elev-1">
              <CardContent className="py-10 text-center text-muted-foreground">
                <ClipboardList className="size-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">این وظیفه فرمی ندارد</p>
                {canComplete && (
                  <Button onClick={handleComplete} disabled={submitting} className="mt-4">
                    {submitting ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 ml-2" />
                    )}
                    {t.complete}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Left pane: metadata + history ─────────────────────────── */}
        <div className="space-y-5">
          {/* Instance link card */}
          {instanceId && (
            <Card className="shadow-elev-1">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t.instanceInfo}</p>
                <button
                  onClick={() => router.push(`/instances/${instanceId}`)}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 text-sm font-medium text-primary hover:bg-primary/8 transition-colors"
                >
                  <span className="truncate">
                    {task.processInstance?.process?.name || t.instanceDetail}
                  </span>
                  <ExternalLink className="size-4 shrink-0 opacity-70 group-hover:opacity-100" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* Previous submissions */}
          {hasSubmissions && (
            <Card className="shadow-elev-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <History className="size-4" />
                  {t.previousSubmissions}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.submissions.map((sub: any, i: number) => {
                  let parsed: Record<string, any> = {};
                  try {
                    parsed = JSON.parse(sub.data);
                  } catch {}
                  return (
                    <div
                      key={sub.id}
                      className="p-3 rounded-xl bg-muted/60 border border-border/50"
                    >
                      <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary/12 text-primary text-[9px] font-bold">
                          {i + 1}
                        </span>
                        {formatPersianDate(sub.submittedAt)}
                      </p>
                      <div className="space-y-2">
                        {Object.entries(parsed).map(([k, v]) =>
                          looksLikeFileList(v) ? (
                            <div key={k}>
                              <p className="text-[11px] text-muted-foreground/80 mb-1">{k}</p>
                              <FileUploadField value={v as any} onChange={() => {}} disabled />
                            </div>
                          ) : (
                            <p key={k} className="text-sm text-foreground" dir="auto">
                              <span className="text-muted-foreground/80">{k}: </span>
                              {String(v)}
                            </p>
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small icon+label metadata cell used in the header banner. */
function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-muted-foreground mb-0.5 text-xs">
        {icon}
        {label}
      </p>
      <p className="font-medium truncate">{children}</p>
    </div>
  );
}

/** Detects file-field values: array of {id, name, ...} metas (or a single meta object). */
function looksLikeFileList(v: any): boolean {
  const items = Array.isArray(v) ? v : [v];
  return (
    items.length > 0 &&
    items.every(
      (it) =>
        it &&
        typeof it === 'object' &&
        typeof (it as any).id === 'string' &&
        typeof (it as any).name === 'string',
    )
  );
}

function renderField(
  field: any,
  value: any,
  onChange: (val: any) => void,
) {
  const locked = !!field.readOnly;
  const lockedCls = locked ? 'bg-transparent text-muted-foreground border-transparent px-0' : '';
  switch (field.type) {
    case 'file': {
      const fileValue = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
          ? [value]
          : [];
      return (
        <FileUploadField
          value={fileValue}
          onChange={onChange}
          multiple={!!field.multiple}
          disabled={locked}
          fromPreviousTask={locked}
        />
      );
    }
    case 'textarea':
      return (
        <Textarea
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={locked}
          className={lockedCls}
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
          disabled={locked}
          dir="ltr"
          className={`text-left ${lockedCls}`}
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
          disabled={locked}
          dir="ltr"
          className={`text-left ${lockedCls}`}
        />
      );
    case 'select':
      return (
        <OptionSelect
          id={field.name}
          categoryId={field.categoryId}
          options={field.options}
          value={value}
          onChange={onChange}
          disabled={locked}
          placeholder="انتخاب کنید"
        />
      );
    case 'checkbox':
      return (
        <div className="flex items-center space-x-2 space-x-reverse">
          <Checkbox
            id={field.name}
            checked={value || false}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={locked}
          />
          {!locked && (
            <Label htmlFor={field.name} className="text-sm font-normal">
              {field.label}
            </Label>
          )}
        </div>
      );
    default: // text
      return (
        <Input
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          disabled={locked}
          className={lockedCls}
        />
      );
  }
}
