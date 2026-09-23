import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormFieldDto } from './form-field.dto.js';

export class FormCreateDto {
  @ApiProperty({ example: 'Leave Request Form' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Form used by employees to submit a leave request' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Process ID this form belongs to' })
  @IsUUID()
  processId: string;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];
}
