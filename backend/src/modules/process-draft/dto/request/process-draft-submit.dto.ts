import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class ProcessDraftSubmitDto {
  @ApiPropertyOptional({
    description: 'Final form values (merged over saved draft data before start)',
    example: { leaveType: 'Sick', days: 2 },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
