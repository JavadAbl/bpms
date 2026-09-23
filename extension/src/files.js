/**
 * files.js — the BPMS file-attachment API (v1.7).
 * ------------------------------------------------
 * Backend contract (NestJS FileController, "files" tag):
 *
 *   POST /api/files                 multipart/form-data, field name "file"
 *                                   → 200 FileMetaDto {id, name, size, mimeType}
 *                                   The meta array is what the form stores in
 *                                   its submission JSON for «file» fields; the
 *                                   backend stamps taskId/instanceId onto the
 *                                   referenced rows when the task completes.
 *   GET  /api/files/by-instance/:id → 200 FileDto[] — every attachment of a
 *                                   process instance, with uploader info
 *                                   (plain array, envelope unwrapped by the
 *                                   backend). 404 unknown instance.
 *   GET  /api/files/:id             → the file bytes (authenticated download;
 *                                   RFC 5987 Content-Disposition keeps
 *                                   Persian names intact).
 *
 * All calls go through authedFetch() (sessionStorage JWT as Bearer). The
 * upload deliberately does NOT set Content-Type — the browser must generate
 * the multipart boundary itself.
 */

import { API } from './config.js';
import { authedFetch, ApiError } from './api.js';

/* ============================== Upload ==================================== */

/**
 * Uploads one File and resolves to its FileMetaDto {id, name, size, mimeType}.
 * Call it once per selected file while the submit is pending; collect the
 * metas into an array — that array is the field value for form «file» fields.
 */
export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await authedFetch(API.filesPath, {
    method: 'POST',
    body: fd, // no Content-Type — browser sets multipart/form-data + boundary
  });

  if (res.status === 401) {
    throw new ApiError('http', 401);
  }
  if (!res.ok) {
    // 413 PayloadTooLarge (server-side MAX_FILE_SIZE) or other failure.
    throw new ApiError('http', res.status);
  }

  let meta;
  try {
    meta = await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
  if (!meta || typeof meta.id !== 'string') {
    throw new ApiError('badresponse', res.status);
  }
  return meta;
}

/* ============================== Listing =================================== */

/**
 * GET /api/files/by-instance/:instanceId — every attachment stamped onto the
 * instance (uploader info included). Plain array; empty when none.
 */
export async function fetchInstanceAttachments(instanceId) {
  const res = await authedFetch(
    API.filesPath + '/by-instance/' + encodeURIComponent(String(instanceId)),
    { headers: { Accept: 'application/json' } }
  );
  if (res.status === 401) {
    throw new ApiError('http', 401);
  }
  if (!res.ok) {
    throw new ApiError('http', res.status);
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApiError('badresponse', res.status);
  }
  if (!Array.isArray(data)) {
    throw new ApiError('badresponse', res.status);
  }
  return data;
}

/* ============================== Download ================================== */

/**
 * Downloads a previously uploaded file (GET /api/files/:id) with the JWT
 * attached, then hands the blob to the browser as a normal file download.
 * Persian filenames survive via the blob + a.download name we pass in.
 */
export async function downloadAttachment(fileId, fileName) {
  const res = await authedFetch(
    API.filesPath + '/' + encodeURIComponent(String(fileId))
  );
  if (res.status === 401) {
    throw new ApiError('http', 401);
  }
  if (!res.ok) {
    throw new ApiError('http', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
