'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, History, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { processesApi } from '@/lib/api';

/**
 * Immutable version history dialog.
 * - Every save that changes the BPMN XML created a version row (backend side)
 * - Restore appends a NEW version from an old one — history is never rewritten
 * - In-flight instances keep running on their own XML snapshot
 */
interface Props {
  open: boolean;
  processId: string;
  processName: string;
  currentVersion: number;
  onClose: () => void;
  // Called after a successful restore with the updated process (new current bpmnXml/version)
  onRestored: (proc: any) => void;
}

export function ProcessVersionsDialog({
  open,
  processId,
  processName,
  currentVersion,
  onClose,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVer, setPreviewVer] = useState<number | null>(null);
  const [previewXml, setPreviewXml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmVer, setConfirmVer] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    try {
      setVersions(await processesApi.getVersions(processId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    if (open) {
      setVersions([]);
      setPreviewVer(null);
      setPreviewXml('');
      setConfirmVer(null);
      setNote('');
      setError('');
      load();
    }
  }, [open, load]);

  const togglePreview = async (version: number) => {
    if (previewVer === version) {
      setPreviewVer(null);
      setPreviewXml('');
      return;
    }
    setPreviewLoading(true);
    try {
      const v = await processesApi.getVersion(processId, version);
      setPreviewXml(v.bpmnXml);
      setPreviewVer(version);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const restore = async (version: number) => {
    setRestoring(true);
    setError('');
    try {
      const proc = await processesApi.restoreVersion(processId, version, note.trim() || undefined);
      setConfirmVer(null);
      setNote('');
      onRestored(proc);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRestoring(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('fa-IR');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            تاریخچه نسخه‌ها — {processName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-1 leading-relaxed">
          هر ذخیره‌ای که نمودار را تغییر دهد یک نسخهٔ جدید ثبت می‌کند؛ نمونه‌های در حال اجرا روی نسخهٔ خودشان
          ادامه می‌دهند و نمونه‌های جدید با آخرین نسخه شروع می‌شوند. بازگردانی، نسخهٔ جدیدی از روی نسخهٔ قدیمی
          می‌سازد و تاریخچه دست‌نخورده باقی می‌ماند.
        </p>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 p-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              در حال بارگذاری...
            </div>
          )}
          {!loading && versions.length === 0 && (
            <p className="text-sm text-gray-400 text-center p-4">نسخه‌ای ثبت نشده است</p>
          )}
          {versions.map((v) => (
            <div key={v.id} className="border rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={v.isCurrent ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}>
                    نسخه {v.version}
                  </Badge>
                  {v.isCurrent && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">فعلی</Badge>
                  )}
                  <span className="text-xs text-gray-500">{fmtDate(v.createdAt)}</span>
                  {v.createdBy?.name && (
                    <span className="text-xs text-gray-400">· {v.createdBy.name}</span>
                  )}
                  <span className="text-[11px] text-gray-300">{(v.xmlSize / 1024).toFixed(1)} KB</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => togglePreview(v.version)}
                    disabled={previewLoading}
                  >
                    {previewVer === v.version ? (
                      <EyeOff className="w-3.5 h-3.5 ml-1" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 ml-1" />
                    )}
                    {previewVer === v.version ? 'بستن XML' : 'مشاهده XML'}
                  </Button>
                  {!v.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setConfirmVer(confirmVer === v.version ? null : v.version);
                        setNote('');
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 ml-1" />
                      بازگردانی
                    </Button>
                  )}
                </div>
              </div>

              {v.note && <p className="text-xs text-gray-600 mt-2">یادداشت: {v.note}</p>}

              {confirmVer === v.version && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md space-y-2">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    نسخه {v.version} به‌عنوان نسخهٔ جدید (نسخه {currentVersion + 1}) ذخیره می‌شود؛ نمودار فعلی
                    جایگزین می‌شود و هیچ نسخه‌ای از تاریخچه حذف نمی‌شود.
                  </p>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="یادداشت (اختیاری) — مثلاً: بازگردانی به دلیل خطای مسیریابی"
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => restore(v.version)}
                      disabled={restoring}
                    >
                      {restoring ? (
                        <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 ml-1" />
                      )}
                      تایید بازگردانی
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmVer(null)}>
                      انصراف
                    </Button>
                  </div>
                </div>
              )}

              {previewVer === v.version && (
                <pre
                  dir="ltr"
                  className="mt-2 max-h-56 overflow-auto text-[11px] leading-relaxed bg-gray-900 text-gray-100 rounded-md p-3 font-mono whitespace-pre-wrap break-all"
                >
                  {previewXml}
                </pre>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
