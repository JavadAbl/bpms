import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { existsSync, mkdirSync, createReadStream } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import type { FileAttachment } from '#common/infrastructure/database/generated/prisma/client.js';
import { FileMetaDto } from '../dto/response/file.dto.js';
import { FileAttachmentRepository } from '../repositories/file-attachment.repository.js';

/** 10 MB per file — generous for documents, small enough to keep disk sane. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Absolute uploads dir — cwd is the backend root (nest start / node dist). */
export const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

/**
 * Multer disk-storage factory shared by the interceptor and the service:
 * uuid disk names + sanitized extension, UTF-8-recovered original name.
 */
export function createUploadStorage(): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      // Multer reports non-ASCII names latin1-decoded — recover the real UTF-8
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = extname(originalName)
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 10);
      cb(null, `${randomUUID()}${ext || '.bin'}`);
    },
  });
}

/**
 * File storage for form "file" fields.
 * Bytes live on disk under <backend>/uploads/<uuid>.<ext>; metadata (original
 * UTF-8 name, mime, size, uploader, later stamped taskId/instanceId) lives in
 * the file_attachments table. The frontend stores the returned meta array in
 * the form submission JSON — later tasks resolve metas to download links.
 */
@Injectable()
export class FileService implements OnModuleInit {
  private readonly logger = new Logger(FileService.name);
  public readonly uploadsDir = UPLOADS_DIR;

  constructor(private readonly fileRep: FileAttachmentRepository) {}

  onModuleInit() {
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
    }
  }

  async fileSave(file: ExpressMulterFile | undefined, userId: string): Promise<FileMetaDto> {
    if (!file) {
      throw new NotFoundException('No file provided (field name must be "file")');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit`,
      );
    }
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const row = await this.fileRep.create({
      data: {
        originalName,
        storedName: file.filename,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        submittedById: userId,
      },
    });
    return { id: row.id, name: row.originalName, size: row.size, mimeType: row.mimeType };
  }

  /** Resolve metadata + read stream for download; 404 when unknown/missing. */
  async fileResolveForDownload(id: string): Promise<{
    row: FileAttachment;
    path: string;
    stream: ReturnType<typeof createReadStream>;
  }> {
    const row = await this.fileRep.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`File ${id} not found`);
    const path = join(this.uploadsDir, row.storedName);
    if (!existsSync(path)) {
      throw new NotFoundException(`File ${id} exists in DB but is missing on disk`);
    }
    return { row, path, stream: createReadStream(path) };
  }

  /**
   * Stamp taskId/instanceId onto every file referenced by a completed task's
   * submission data (values are arrays/objects of {id, name, ...} metas).
   */
  async fileStampFromSubmissionData(
    data: Record<string, unknown>,
    taskId: string,
    instanceId: string,
  ): Promise<number> {
    const ids = new Set<string>();
    for (const value of Object.values(data || {})) {
      const candidates = Array.isArray(value) ? value : [value];
      for (const item of candidates) {
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
          ids.add((item as { id: string }).id);
        }
      }
    }
    if (ids.size === 0) return 0;
    const result = await this.fileRep.updateMany({
      where: { id: { in: [...ids] } },
      data: { taskId, instanceId },
    });
    return result.count;
  }

  /**
   * List attachments of an instance (for instance views / audits).
   * Plain array — scoped sub-resource list (like positions/by-department);
   * the frontend renders it directly, so the repository envelope is unwrapped.
   */
  async fileGetByInstance(instanceId: string) {
    const { items } = await this.fileRep.findMany({
      where: { instanceId },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return items;
  }
}

/** Local shape of a multer file (avoids importing @types/multer at runtime). */
export interface ExpressMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}
