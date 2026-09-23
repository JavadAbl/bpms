import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { PositionCreateDto } from './position-create.dto.js';

export class PositionUpdateDto extends PartialType(PositionCreateDto) {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  description?: string;
}
