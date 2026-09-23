import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ProcessDraftCreateDto {
  @ApiProperty({ description: 'Process definition id to draft-start' })
  @IsUUID()
  processId: string;
}
