import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePositionDto {
  @ApiProperty({ example: 'Engineering Manager' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Manages the engineering team' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignUsersDto {
  @ApiProperty({ type: [String], description: 'User IDs to assign to this position' })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class PositionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
