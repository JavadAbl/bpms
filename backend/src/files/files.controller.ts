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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { createUploadStorage, FilesService, MAX_FILE_SIZE } from './files.service';
import { Response } from 'express';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload one file (multipart field "file") — returns meta {id, name, size, mimeType} to store in the form value',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: createUploadStorage(), limits: { fileSize: MAX_FILE_SIZE } }))
  upload(@UploadedFile() file: any, @Req() req: any) {
    return this.files.save(file, req.user.id);
  }

  @Get('by-instance/:instanceId')
  @ApiOperation({ summary: 'List all attachments of a process instance (with uploader info)' })
  findByInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.files.findByInstance(instanceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a previously uploaded file (authenticated)' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { row, path } = await this.files.resolveForDownload(id);
    // res.download sets RFC 5987 Content-Disposition — safe for Persian names
    res.download(path, row.originalName);
  }
}
