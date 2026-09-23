import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ProcessRestoreVersionDto {
  @ApiPropertyOptional({ description: 'Optional changelog note for the newly created version' })
  @IsOptional()
  @IsString()
  note?: string;
}
