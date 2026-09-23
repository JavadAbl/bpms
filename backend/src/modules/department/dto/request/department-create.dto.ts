import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DepartmentCreateDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Software engineering department' })
  @IsOptional()
  @IsString()
  description?: string;
}
