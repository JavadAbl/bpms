import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProcessAssignmentDto } from '../request/process-assignment-bulk.dto.js';
import { ProcessStatus } from '#common/infrastructure/database/generated/prisma/client.js';

export class ProcessUserTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  documentation?: string;
}

export class ProcessStarterDto {
  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  user?: { id: string; name: string; email: string; role: string };
}

export class ProcessDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  bpmnXml: string;

  @ApiProperty()
  version: number;

  @ApiProperty({ enum: ProcessStatus })
  status: ProcessStatus;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [ProcessUserTaskDto] })
  userTasks?: ProcessUserTaskDto[];

  @ApiPropertyOptional({ type: [ProcessAssignmentDto] })
  assignments?: ProcessAssignmentDto[];

  @ApiPropertyOptional({ type: [ProcessStarterDto] })
  starters?: ProcessStarterDto[];
}

export class ProcessVersionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  createdBy?: { id: string; name: string; email: string };

  @ApiProperty({ description: 'XML payload size in bytes' })
  xmlSize: number;

  @ApiProperty()
  isCurrent: boolean;
}

export class ProcessVersionXmlDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  bpmnXml: string;
}

export class ProcessVariableReplyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiProperty()
  type: string;
}
