import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessInstanceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  processId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Process summary' })
  process?: { id: string; name: string; version?: number };

  @ApiProperty({ enum: ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'] })
  status: string;

  @ApiProperty()
  startedById: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  startedBy?: { id: string; email: string; name: string };

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  lastError?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Task timeline (included in list/detail views)',
  })
  tasks?: Record<string, unknown>[];
}
