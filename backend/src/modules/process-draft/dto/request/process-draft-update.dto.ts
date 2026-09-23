import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class ProcessDraftUpdateDto {
  @ApiProperty({
    description: 'Form field values to persist on the draft',
    example: { leaveType: 'Sick', days: 2 },
  })
  @IsObject()
  data: Record<string, unknown>;
}
