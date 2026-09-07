import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';

/** 10 MB per file — generous for documents, small enough to keep disk sane. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Absolute uploads dir — cwd is the backend root (nest start / node dist). */
export const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

/**
 * Multer disk-storage factory shared by the interceptor and the service:
 * uuid disk names + sanitized extension, UTF-8-recovered original name.
 */
export function createUploadStorage() {
  return diskStorage({
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

export interface StoredFileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * File storage for form "file" fields.
 * Bytes live on disk under <backend>/uploads/<uuid>.<ext>; metadata (original
 * UTF-8 name, mime, size, uploader, later stamped taskId/instanceId) lives in
 * the file_attachments table. The frontend stores the returned meta array in
 * the form submission JSON — later tasks resolve metas to download links.
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  public readonly uploadsDir = UPLOADS_DIR;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
    }
  }

  async save(file: any, userId: string): Promise<StoredFileMeta> {
    if (!file) {
      throw new NotFoundException('No file provided (field name must be "file")');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit`,
      );
    }
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const row = await this.prisma.fileAttachment.create({
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
  async resolveForDownload(id: string) {
    const row = await this.prisma.fileAttachment.findUnique({ where: { id } });
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
  async stampFromSubmissionData(
    data: Record<string, any>,
    taskId: string,
    instanceId: string,
  ) {
    const ids = new Set<string>();
    for (const value of Object.values(data || {})) {
      const candidates = Array.isArray(value) ? value : [value];
      for (const item of candidates) {
        if (item && typeof item === 'object' && typeof (item as any).id === 'string') {
          ids.add((item as any).id);
        }
      }
    }
    if (ids.size === 0) return 0;
    const result = await this.prisma.fileAttachment.updateMany({
      where: { id: { in: [...ids] } },
      data: { taskId, instanceId },
    });
    return result.count;
  }

  /** List attachments of an instance (for instance views / audits). */
  async findByInstance(instanceId: string) {
    return this.prisma.fileAttachment.findMany({
      where: { instanceId },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
