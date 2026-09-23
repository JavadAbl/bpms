import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Position nested inside a department response. */
export class DepartmentPositionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  userPositions: {
    user: { id: string; email: string; name: string };
  }[];
}

export class DepartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: [DepartmentPositionDto] })
  positions?: DepartmentPositionDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
