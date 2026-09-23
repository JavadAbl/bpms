import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PositionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Department summary when included' })
  department?: { id: string; name: string };

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  userPositions?: {
    user: { id: string; email: string; name: string };
  }[];

  @ApiPropertyOptional({ type: Boolean, description: 'Marks the department-head position' })
  isManager?: boolean;

  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
