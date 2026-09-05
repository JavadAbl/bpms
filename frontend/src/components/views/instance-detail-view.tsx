'use client';

import { useState, useEffect, useCallback } from 'react';
import { processInstancesApi, filesApi, InstanceAttachment } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { formatPersianDate, formatPersianDateOnly } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Circle,
  PlayCircle,
  Paperclip,
  Download,
  Loader2,
  FileText,
  User,
  CalendarDays,
  CalendarCheck,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-32 w-full rounded-xl md-skeleton" />
        <Skeleton className="h-64 w-full rounded-xl md-skeleton" />
      </div>
    );
  }

  if (!instance) return null;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-mr-2">
        <ArrowRight className="w-4 h-4 ml-1" />
        {t.back}
      </Button>

      {/* Instance header — MD3 tonal banner */}
      <Card className="border-0 shadow-elev-1 overflow-hidden">
        <div className="bg-primary/8 dark:bg-primary/12 px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <PlayCircle className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{instance.process?.name}</h2>
                <Badge className={`border-transparent ${statusColors[instance.status]}`}>
                  {(t as any)[instance.status] || instance.status}
                </Badge>
                <Badge variant="outline" className="text-xs bg-card/60">
                  {t.version} {instance.process?.version}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-4 text-sm">
                <MetaItem icon={<User className="size-3.5" />} label={t.startedBy}>
                  {instance.startedBy?.name}
                </MetaItem>
                <MetaItem icon={<CalendarDays className="size-3.5" />} label={t.startedAt}>
                  {formatPersianDateOnly(instance.startedAt)}
                </MetaItem>
                <MetaItem icon={<CalendarCheck className="size-3.5" />} label={t.completedAt}>
                  {instance.completedAt
                    ? formatPersianDateOnly(instance.completedAt)
                    : '—'}
                </MetaItem>
                <MetaItem icon={<GitBranch className="size-3.5" />} label={t.status}>
                  {(t as any)[instance.status] || instance.status}
                </MetaItem>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {instance.lastError && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{instance.lastError}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* Task timeline */}
        <Card className="shadow-elev-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.timeline}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative">
              {(instance.tasks || []).map((task: any, i: number) => {
                const last = i === (instance.tasks?.length || 0) - 1;
                return (
                  <li key={task.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {/* connector */}
                    {!last && (
                      <span
                        aria-hidden
                        className="absolute top-8 right-[15px] w-0.5 h-[calc(100%-1.75rem)] bg-border"
                      />
                    )}
                    <TimelineIcon status={task.status} />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{task.name}</span>
                        <Badge
                          className={`text-[11px] border-transparent ${statusColors[task.status]}`}
                        >
                          {(t as any)[task.status] || task.status}
                        </Badge>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        {task.assignee && <span>مسئول: {task.assignee.name}</span>}
                        {task.position && !task.assignee && (
                          <span>موقعیت: {task.position.name}</span>
                        )}
                        {task.createdAt && (
                          <span>{formatPersianDate(task.createdAt)}</span>
                        )}
                        {task.completedAt && (
                          <span className="text-success">
                            → {formatPersianDate(task.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {(!instance.tasks || instance.tasks.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t.noTasksInInstance}
                </p>
              )}
            </ol>
          </CardContent>
        </Card>

        {/* Attachments panel — roadmap item: GET /api/files/by-instance */}
        <AttachmentsPanel instanceId={instanceId} />
      </div>
    </div>
  );
}

/** MD3 timeline status icon in a tonal circle. */
function TimelineIcon({ status }: { status: string }) {
  const base =
    'relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border';
  if (status === 'COMPLETED')
    return (
      <span className={cn(base, 'bg-success/15 border-success/30 text-success')}>
        <CheckCircle className="size-4" />
      </span>
    );
  if (status === 'PENDING')
    return (
      <span className={cn(base, 'bg-warning/15 border-warning/30 text-warning')}>
        <Clock className="size-4" />
      </span>
    );
  if (status === 'CANCELLED' || status === 'SKIPPED')
    return (
      <span className={cn(base, 'bg-muted border-border text-muted-foreground')}>
        <XCircle className="size-4" />
      </span>
    );
  return (
    <span className={cn(base, 'bg-primary/12 border-primary/30 text-primary')}>
      <Circle className="size-4" />
    </span>
  );
}

/**
 * Instance attachments panel (UI redesign Phase 5 — roadmap item #2).
 * Lists every file stamped onto this instance via GET /api/files/by-instance/:id
 * and offers per-file authenticated download.
 */
function AttachmentsPanel({ instanceId }: { instanceId: string }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<InstanceAttachment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await filesApi.byInstance(instanceId);
      setFiles(data);
    } catch {
      setLoadError(true);
    }
  }, [instanceId]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (f: InstanceAttachment) => {
    setDownloadingId(f.id);
    try {
      const blob = await filesApi.download(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.originalName || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: 'خطا',
        description: err?.message || 'دانلود فایل ناموفق بود',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card className="shadow-elev-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Paperclip className="size-4" />
          </span>
          {t.attachments}
          {files && files.length > 0 && (
            <Badge variant="secondary" className="text-xs mr-1">
              {files.length.toLocaleString('fa-IR')}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{t.attachmentsHint}</p>
      </CardHeader>
      <CardContent>
        {files === null && !loadError ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl md-skeleton" />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">
              دریافت پیوست‌ها ناموفق بود
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              <Loader2 className="w-4 h-4 ml-2" />
              {t.refresh}
            </Button>
          </div>
        ) : files!.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Paperclip className="size-8 opacity-30 mb-2" />
            <p className="text-sm">{t.noAttachments}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {files!.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 hover:bg-accent/60 transition-colors"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={f.originalName} dir="auto">
                    {f.originalName}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{fmtSize(f.size)}</span>
                    {f.submittedBy?.name && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {t.uploadedBy}: {f.submittedBy.name}
                        </span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>{formatPersianDateOnly(f.createdAt)}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => download(f)}
                  disabled={downloadingId === f.id}
                  title="دانلود"
                >
                  {downloadingId === f.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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

const fmtSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toFixed(1)} مگابایت`;
};
