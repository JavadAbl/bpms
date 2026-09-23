import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportColumnDto } from '../request/report-column.dto.js';
import { ReportFilterDto } from '../request/report-filter.dto.js';

export class ReportDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  processId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  process?: { id: string; name: string; status: string };

  @ApiProperty({ type: [ReportColumnDto] })
  columns: ReportColumnDto[];

  @ApiProperty({ type: [ReportFilterDto] })
  filters: ReportFilterDto[];

  @ApiProperty({ description: 'Column count helper' })
  columnCount: number;

  @ApiProperty({ description: 'Filter count helper' })
  filterCount: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  createdBy?: { id: string; name: string; email: string };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export interface CatalogVariable {
  name: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}

export interface ReportResultColumn {
  key: string;
  source: string;
  fieldKey: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}

export class ReportFieldCatalogDto {
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  instanceFields: { key: string; label: string; type: string }[];

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  variables: CatalogVariable[];
}

export class ReportExecutionDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  report?: { id: string; name: string; description?: string; createdAt: Date; updatedAt: Date } | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  process: { id: string; name: string };

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  columns: ReportResultColumn[];

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  rows: Record<string, unknown>[];

  @ApiProperty()
  total: number;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Row counts by instance status' })
  byStatus: Record<string, number>;

  @ApiProperty()
  generatedAt: Date;
}
