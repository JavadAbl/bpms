import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessDraftFormDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  fields?: Record<string, unknown>[];
}

export class ProcessDraftDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  processId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  process?: { id: string; name: string; version?: number };

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  firstTaskName: string;

  @ApiPropertyOptional()
  formId?: string | null;

  @ApiPropertyOptional({ type: ProcessDraftFormDto })
  form?: ProcessDraftFormDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Parsed form field values',
  })
  formData: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
