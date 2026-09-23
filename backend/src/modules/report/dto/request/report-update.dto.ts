import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportColumnDto } from './report-column.dto.js';
import { ReportFilterDto } from './report-filter.dto.js';

/** PATCH — every field optional; omitted fields keep their stored value. */
export class ReportUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  processId?: string;

  @ApiPropertyOptional({ type: [ReportColumnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportColumnDto)
  columns?: ReportColumnDto[];

  @ApiPropertyOptional({ type: [ReportFilterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];
}
