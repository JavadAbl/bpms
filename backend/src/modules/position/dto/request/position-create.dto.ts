import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PositionCreateDto {
  @ApiProperty({ example: 'Engineering Manager' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Manages the engineering team' })
  @IsOptional()
  @IsString()
  description?: string;
}
