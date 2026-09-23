import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { DepartmentCreateDto } from './department-create.dto.js';

export class DepartmentUpdateDto extends PartialType(DepartmentCreateDto) {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  description?: string;
}
