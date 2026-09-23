import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportColumnDto } from './report-column.dto.js';
import { ReportFilterDto } from './report-filter.dto.js';

/**
 * Preview body = a full (unsaved) report config. Runs the exact same
 * execution path as a saved report so the builder's «پیش‌نمایش» can never
 * disagree with the real thing.
 */
export class ReportPreviewDto {
  @ApiProperty({ example: 'uuid-of-process' })
  @IsUUID()
  processId: string;

  @ApiProperty({ type: [ReportColumnDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportColumnDto)
  columns: ReportColumnDto[];

  @ApiPropertyOptional({ type: [ReportFilterDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];
}
