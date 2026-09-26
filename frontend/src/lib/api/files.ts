import { API_BASE, getToken } from './client';

/**
 * Files — form file-field uploads.
 * Meta shape stored in form values / submissions: { id, name, size, mimeType }
 */

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

/** Row returned by GET /files/by-instance/:instanceId (file_attachments + uploader). */
export interface InstanceAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  taskId: string | null;
  instanceId: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string; email: string } | null;
}

export const filesApi = {
  /** Upload one file (multipart). Returns the meta to store in the form value. */
  upload: async (file: File): Promise<FileMeta> => {
    const fd = new FormData();
    fd.append('file', file);
    const t = getToken();
    const res = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        // No Content-Type — the browser sets the multipart boundary itself
      },
      body: fd,
    });
    if (!res.ok) {
      let msg = `upload failed (${res.status})`;
      try {
        const body = await res.json();
        msg = body.message || body.error || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },

  /** Download a previously uploaded file as a Blob (caller names the file). */
  download: async (id: string): Promise<Blob> => {
    const t = getToken();
    const res = await fetch(`${API_BASE}/files/${id}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`دانلود فایل ناموفق بود (${res.status})`);
    return res.blob();
  },

  /** List every attachment stamped onto a process instance (uploader info included). */
  byInstance: async (instanceId: string): Promise<InstanceAttachment[]> => {
    const t = getToken();
    const res = await fetch(`${API_BASE}/files/by-instance/${instanceId}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`دریافت پیوست‌ها ناموفق بود (${res.status})`);
    return res.json();
  },
};
