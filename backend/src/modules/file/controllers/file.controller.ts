import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '#common/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '#common/types/auth.types.js';
import { FileService, createUploadStorage, MAX_FILE_SIZE, type ExpressMulterFile } from '../services/file.service.js';
import { FileMetaDto } from '../dto/response/file.dto.js';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload one file (multipart field "file") — returns meta {id, name, size, mimeType} to store in the form value',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Stored file metadata', type: FileMetaDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createUploadStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  fileUpload(@UploadedFile() file: ExpressMulterFile | undefined, @Req() req: AuthedRequest): Promise<FileMetaDto> {
    return this.fileService.fileSave(file, req.user.id);
  }

  @Get('by-instance/:instanceId')
  @ApiOperation({ summary: 'List all attachments of a process instance (with uploader info)' })
  fileGetByInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.fileService.fileGetByInstance(instanceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a previously uploaded file (authenticated)' })
  async fileDownload(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { row, path } = await this.fileService.fileResolveForDownload(id);
    // res.download sets RFC 5987 Content-Disposition — safe for Persian names
    res.download(path, row.originalName);
  }
}
