import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Column sources:
 *  - INSTANCE → fixed ProcessInstance fields (status, startedBy, …)
 *  - VARIABLE → a process variable resolved from the merged form
 *    submissions of the instance (prefill-chain semantics)
 */
export const REPORT_COLUMN_SOURCES = ['INSTANCE', 'VARIABLE'] as const;

export class ReportColumnDto {
  @ApiProperty({
    example: 'field:status',
    description:
      'Stable column key — unique within a report. Convention: "field:<fieldKey>" for INSTANCE columns, "var:<variableName>" for VARIABLE columns.',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ enum: REPORT_COLUMN_SOURCES })
  @IsIn(REPORT_COLUMN_SOURCES)
  source: string;

  @ApiProperty({
    example: 'status',
    description:
      'INSTANCE: one of status/startedBy/startedAt/completedAt/currentStep/durationDays/taskCount/completedTaskCount. VARIABLE: the variable name.',
  })
  @IsString()
  @IsNotEmpty()
  fieldKey: string;

  @ApiPropertyOptional({
    example: 'نوع مرخصی',
    description: 'Optional custom column header label. Defaults to the catalog label.',
  })
  @IsOptional()
  @IsString()
  label?: string;
}

export const REPORT_FILTER_TYPES = ['STATUS', 'DATE_RANGE', 'VARIABLE'] as const;

export const REPORT_VARIABLE_OPS = ['eq', 'neq', 'contains'] as const;

export class ReportFilterDto {
  @ApiProperty({ enum: REPORT_FILTER_TYPES })
  @IsIn(REPORT_FILTER_TYPES)
  type: string;

  /** STATUS filter — allowed instance statuses. Empty/omitted = all. */
  @ApiPropertyOptional({
    type: [String],
    example: ['COMPLETED', 'RUNNING'],
    description: 'STATUS filter: instance statuses to keep. Empty = all statuses.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];

  /** DATE_RANGE filter — inclusive bounds on startedAt (ISO date or datetime). */
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  to?: string;

  /** VARIABLE filter — name + operator + string value. */
  @ApiPropertyOptional({ example: 'leaveType' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: REPORT_VARIABLE_OPS })
  @IsOptional()
  @IsIn(REPORT_VARIABLE_OPS)
  op?: string;

  @ApiPropertyOptional({
    example: 'Annual',
    description: 'Comparison value (string). Numbers/booleans are string-compared.',
  })
  @IsOptional()
  @IsString()
  value?: string;
}

export class CreateReportDto {
  @ApiProperty({ example: 'گزارش مرخصی‌ها' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'فهرست تمامی درخواست‌های مرخصی با نوع و تصمیم' })
  @IsOptional()
  @IsString()
  description?: string;

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

/** PATCH — every field optional; omitted fields keep their stored value. */
export class UpdateReportDto {
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

/**
 * Preview body = a full (unsaved) report config. Runs the exact same
 * execution path as a saved report so the builder's «پیش‌نمایش» can never
 * disagree with the real thing.
 */
export class PreviewReportDto {
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
