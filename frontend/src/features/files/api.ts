import { http } from '@/lib/api/client';
import type { FileMeta, InstanceAttachment } from './types';

export const filesApi = {
  /** Upload one file (multipart). Returns the meta to store in the form value. */
  upload: async (file: File): Promise<FileMeta> => {
    const fd = new FormData();
    fd.append('file', file);
    // No Content-Type — axios lets the browser set the multipart boundary.
    const res = await http.post<FileMeta>('/files', fd);
    return res.data;
  },

  /** Download a previously uploaded file as a Blob (caller names the file). */
  download: async (id: string): Promise<Blob> => {
    try {
      const res = await http.get<Blob>(`/files/${id}`, { responseType: 'blob' });
      return res.data;
    } catch (e) {
      throw new Error(`دانلود فایل ناموفق بود (${(e as { status?: number }).status ?? ''})`);
    }
  },

  /** List every attachment stamped onto a process instance (uploader info included). */
  byInstance: async (instanceId: string): Promise<InstanceAttachment[]> => {
    const res = await http.get<InstanceAttachment[]>(`/files/by-instance/${instanceId}`);
    return res.data;
  },
};
