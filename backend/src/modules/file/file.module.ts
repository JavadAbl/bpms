import { Module } from '@nestjs/common';
import { FileController } from './controllers/file.controller.js';
import { FileService } from './services/file.service.js';
import { FileAttachmentRepository } from './repositories/file-attachment.repository.js';
import { FilesServiceContract } from './contracts/file-service.contract.js';
import { FileProvider } from './providers/file.service.provider.js';

@Module({
  imports: [],
  controllers: [FileController],
  providers: [
    FileService,
    FileAttachmentRepository,
    { provide: FilesServiceContract, useClass: FileProvider },
  ],
  exports: [FilesServiceContract],
})
export class FileModule {}
