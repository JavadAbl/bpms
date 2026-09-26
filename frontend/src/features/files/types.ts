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
