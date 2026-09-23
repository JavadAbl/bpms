import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ProcessStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
}

export class ProcessUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bpmnXml?: string;

  @ApiPropertyOptional({
    description:
      'Optional changelog note stored on the new version row when bpmnXml changes. ' +
      'Ignored when the XML is identical to the current one (no version created).',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;
}
