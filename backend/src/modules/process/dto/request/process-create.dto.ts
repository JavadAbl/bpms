import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProcessCreateDto {
  @ApiProperty({ example: 'Leave Approval' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Standard employee leave approval workflow' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '<?xml version="1.0" encoding="UTF-8"?>...<bpmn:process>...</bpmn:process>',
    description: 'BPMN 2.0 XML source for the process',
  })
  @IsString()
  bpmnXml: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Optional starter restriction (the START event assignment): only these users ' +
      '(plus admins) may start instances. Empty/omitted = every user may start.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  starterIds?: string[];
}
