import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { CATEGORY_KEY_PATTERN, CategoryItemDto } from './category-create.dto.js';

export class CategoryUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_KEY_PATTERN, {
    message: 'key must start with a letter and contain only letters, digits and underscore',
  })
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** When provided, replaces the whole item list (order = array order). */
  @ApiPropertyOptional({ type: [CategoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryItemDto)
  items?: CategoryItemDto[];
}
