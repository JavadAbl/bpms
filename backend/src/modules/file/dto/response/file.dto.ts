import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileMetaDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'report.pdf' })
  name: string;

  @ApiProperty({ example: 102400 })
  size: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;
}

export class FileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiPropertyOptional({ description: 'Stamped when the owning task completes' })
  taskId?: string | null;

  @ApiPropertyOptional()
  instanceId?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  submittedBy?: { id: string; name: string; email: string } | null;

  @ApiProperty()
  createdAt: Date;
}
