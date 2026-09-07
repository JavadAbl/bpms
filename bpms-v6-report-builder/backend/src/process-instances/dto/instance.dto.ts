import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class StartInstanceDto {
  @ApiProperty({ description: 'Process definition id to start' })
  @IsUUID()
  processId: string;

  @ApiPropertyOptional({
    description: 'Optional input variables passed to the engine environment',
    example: { initiator: 'john@bpms.local', priority: 'high' },
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, any>;
}

export class InstanceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  processId: string;

  @ApiProperty({ enum: ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'] })
  status: string;

  @ApiProperty()
  startedById: string;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  lastError?: string;
}
