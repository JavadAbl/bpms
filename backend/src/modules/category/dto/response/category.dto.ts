import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryUsageDto {
  @ApiProperty({ description: 'How many forms reference this category from a select field' })
  formCount: number;

  @ApiProperty({ type: [String] })
  formNames: string[];
}

export class CategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'leave_types' })
  key: string;

  @ApiProperty({ example: 'انواع مرخصی' })
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object', additionalProperties: true } })
  items?: { id: string; value: string; label: string; sortOrder: number }[];

  @ApiPropertyOptional({ type: CategoryUsageDto })
  usage?: CategoryUsageDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
