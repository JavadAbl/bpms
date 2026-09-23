import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const REPORT_FILTER_TYPES = ['STATUS', 'DATE_RANGE', 'VARIABLE'] as const;

export const REPORT_VARIABLE_OPS = ['eq', 'neq', 'contains'] as const;

export class ReportFilterDto {
  @ApiPropertyOptional({ enum: REPORT_FILTER_TYPES })
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
