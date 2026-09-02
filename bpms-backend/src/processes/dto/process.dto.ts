import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProcessStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateProcessDto {
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
}

export class UpdateProcessDto {
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

  @ApiPropertyOptional({ enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;
}

export class TaskAssignmentDto {
  @ApiProperty({ example: 'Approve Request', description: 'Name of the userTask in BPMN XML' })
  @IsString()
  taskName: string;

  @ApiPropertyOptional({ description: 'User assigned to this task. Mutually exclusive with positionId.' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Position assigned to this task — any holder can complete. Mutually exclusive with assigneeId.' })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({
    description: 'Self-service mode (only with positionId). If true, holder must CLAIM before completing. Default false.',
    default: false,
  })
  @IsOptional()
  selfService?: boolean;

  @ApiPropertyOptional({ description: 'Form bound to this task' })
  @IsOptional()
  @IsUUID()
  formId?: string;
}

export class BulkTaskAssignmentDto {
  @ApiProperty({ type: [TaskAssignmentDto] })
  @ValidateNested({ each: true })
  @Type(() => TaskAssignmentDto)
  assignments: TaskAssignmentDto[];
}

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

export class BulkProcessVariablesDto {
  @ApiProperty({ type: [ProcessVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessVariableDto)
  variables: ProcessVariableDto[];
}

export class UserTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  documentation?: string;
}

export class ProcessResponseDto {
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

  @ApiPropertyOptional({ type: [UserTaskDto] })
  userTasks?: UserTaskDto[];

  @ApiPropertyOptional({ type: [TaskAssignmentDto] })
  assignments?: TaskAssignmentDto[];
}
