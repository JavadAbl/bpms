import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessVariableDto {
  @ApiProperty({ example: 'leaveType' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'نوع مرخصی' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'text', default: 'text' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class ProcessVariableBulkDto {
  @ApiProperty({ type: [ProcessVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessVariableDto)
  variables: ProcessVariableDto[];
}
