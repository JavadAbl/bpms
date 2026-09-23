import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportColumnDto } from './report-column.dto.js';
import { ReportFilterDto } from './report-filter.dto.js';

export class ReportCreateDto {
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
