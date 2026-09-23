import { Injectable } from '@nestjs/common';
import { FileService } from '../services/file.service.js';
import { FilesServiceContract } from '../contracts/file-service.contract.js';

/** Contract implementation consumed by other modules (task). */
@Injectable()
export class FileProvider implements FilesServiceContract {
  constructor(private readonly fileService: FileService) {}

  fileStampFromSubmissionData(
    data: Record<string, unknown>,
    taskId: string,
    instanceId: string,
  ): Promise<number> {
    return this.fileService.fileStampFromSubmissionData(data, taskId, instanceId);
  }
}
