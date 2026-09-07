import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FormFieldOptionDto {
  @ApiProperty({ example: 'Approve' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'approve', required: false })
  @IsOptional()
  @IsString()
  value?: string;
}

export class FormFieldDto {
  @ApiProperty({ example: 'reason' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Reason' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'text', description: 'text | textarea | number | date | select | checkbox | radio' })
  @IsString()
  type: string;

  @ApiProperty({ default: false })
  @IsOptional()
  required?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Options for select/radio fields' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ description: 'Global category id — reusable option list for select fields' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Process variable name — used in gateway conditions' })
  @IsOptional()
  @IsString()
  variable?: string;

  @ApiPropertyOptional({ description: 'Placeholder hint shown inside the empty input' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Default value pre-filled for the user' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({
    description:
      'Read-only field: rendered disabled at runtime and pre-filled from process instance variables (data filled in previous tasks)',
  })
  @IsOptional()
  readOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'File fields only: allow multiple attachments. Value stored in submissions is always an array of {id, name, size, mimeType} metas.',
  })
  @IsOptional()
  @IsBoolean()
  multiple?: boolean;
}

export class CreateFormDto {
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

export class UpdateFormDto extends CreateFormDto {}

export class FormResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [FormFieldDto] })
  fields: FormFieldDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
