'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { filesApi, FileMeta } from '@/lib/api';

/** Meta shape stored in form values / submissions for file fields. */
export type FileFieldValue = FileMeta[];

interface Props {
  value?: FileFieldValue;
  onChange: (value: FileFieldValue) => void;
  /** Allow more than one file (from field.multiple). Default false. */
  multiple?: boolean;
  /** Locked = readOnly field or preview mode: shows files (download only), no picker. */
  disabled?: boolean;
  /** Preview mode: never hits the API, shows the static UI only. */
  previewMode?: boolean;
  /** Marks attachments coming from previous tasks (info line). */
  fromPreviousTask?: boolean;
}

const fmtSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toFixed(1)} مگابایت`;
};

/**
 * File upload field for BPMS forms.
 * - Files upload immediately on pick (POST /api/files multipart) and the form
 *   value keeps lightweight metas {id, name, size, mimeType}
 * - Submitting the task stamps task/instance onto the files server-side
 * - Later tasks render the same field readOnly → download-only attachment list
 */
export function FileUploadField({
  value,
  onChange,
  multiple = false,
  disabled = false,
  previewMode = false,
  fromPreviousTask = false,
}: Props) {
  const files: FileFieldValue = Array.isArray(value) ? value : [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handlePick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError('');
    const room = multiple ? Infinity : 1;
    const list = Array.from(picked).slice(0, Math.max(0, room - files.length));
    if (list.length === 0) {
      setError(multiple ? 'ظرفیت تکمیل است' : 'فقط یک فایل مجاز است');
      return;
    }
    setUploading(true);
    try {
      const metas: FileMeta[] = [];
      for (const f of list) {
        if (previewMode) {
          // Preview: fake meta so the UI renders, never persisted
          metas.push({ id: `preview-${Date.now()}-${Math.random()}`, name: f.name, size: f.size, mimeType: f.type });
        } else {
          metas.push(await filesApi.upload(f));
        }
      }
      onChange(multiple ? [...files, ...metas] : metas.slice(-1));
    } catch (e: any) {
      setError(e?.message || 'بارگذاری فایل ناموفق بود');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const download = async (meta: FileMeta) => {
    if (previewMode) return;
    setDownloadingId(meta.id);
    setError('');
    try {
      const blob = await filesApi.download(meta.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'دانلود فایل ناموفق بود');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {!disabled && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || (!multiple && files.length > 0)}
          className="w-full border border-dashed border-gray-300 rounded-md py-3 px-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              در حال بارگذاری...
            </>
          ) : (
            <>
              <Paperclip className="w-4 h-4" />
              {multiple ? 'انتخاب فایل (می‌توانید چند فایل پیوست کنید)' : 'انتخاب فایل'}
              <span className="text-[10px] text-gray-400">(حداکثر ۱۰ مگابایت)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        onChange={(e) => handlePick(e.target.files)}
      />

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 bg-gray-50 text-sm"
            >
              <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate flex-1" title={f.name}>
                {f.name}
              </span>
              <span className="text-[10px] text-gray-400 shrink-0">{fmtSize(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-gray-500 hover:text-emerald-700"
                onClick={() => download(f)}
                title="دانلود"
              >
                {downloadingId === f.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </Button>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-gray-400 hover:text-red-600"
                  onClick={() => removeFile(f.id)}
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {disabled && files.length === 0 && (
        <p className="text-xs text-gray-400">پیوستی ثبت نشده است</p>
      )}
      {fromPreviousTask && files.length > 0 && (
        <p className="text-[11px] text-gray-400">پیوست‌های ثبت‌شده در وظیفه‌های قبلی</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
