import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
