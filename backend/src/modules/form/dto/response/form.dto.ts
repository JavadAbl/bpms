import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormFieldDto } from '../request/form-field.dto.js';

export class FormDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  processId: string;

  @ApiProperty({ type: [FormFieldDto] })
  fields: FormFieldDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
