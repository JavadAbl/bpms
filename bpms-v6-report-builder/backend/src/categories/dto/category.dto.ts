import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

/** Machine key used by form fields to reference the category. */
export const CATEGORY_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export class CategoryItemDto {
  @ApiProperty({ example: 'Sick', description: 'Value persisted in form data / process variables' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ example: 'مرخصی استعلاجی', description: 'Label displayed to end users' })
  @IsString()
  @IsNotEmpty()
  label: string;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'leave_types', description: 'Unique machine key (identifier chars only)' })
  @IsString()
  @Matches(CATEGORY_KEY_PATTERN, {
    message: 'key must start with a letter and contain only letters, digits and underscore',
  })
  key: string;

  @ApiProperty({ example: 'انواع مرخصی' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'لیست انواع مرخصی برای فرم‌ها' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CategoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryItemDto)
  items?: CategoryItemDto[];
}

export class UpdateCategoryDto {
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
