import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class CompleteTaskDto {
  @ApiPropertyOptional({
    description: 'Form data submitted by the user (key/value pairs)',
    example: { decision: 'Approve', comment: 'Looks good' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Optional form id this submission relates to' })
  @IsOptional()
  @IsUUID()
  formId?: string;
}
