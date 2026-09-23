import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class ProcessInstanceStartDto {
  @ApiProperty({ description: 'Process definition id to start' })
  @IsUUID()
  processId: string;

  @ApiPropertyOptional({
    description: 'Optional input variables passed to the engine environment',
    example: { initiator: 'john@bpms.local', priority: 'high' },
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
