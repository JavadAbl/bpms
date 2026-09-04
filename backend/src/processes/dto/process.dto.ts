import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, ValidateNested, IsArray } from 'class-validator';
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

export class RestoreVersionDto {
  @ApiPropertyOptional({ description: 'Optional changelog note for the newly created version' })
  @IsOptional()
  @IsString()
  note?: string;
}

export const ASSIGNMENT_STRATEGIES = [
  'FIXED_USER',
  'POSITION',
  'TASK_STARTER',
  'TASK_STARTER_MANAGER',
] as const;

export class TaskAssignmentDto {
  @ApiProperty({ example: 'Approve Request', description: 'Name of the userTask in BPMN XML' })
  @IsString()
  taskName: string;

  @ApiPropertyOptional({
    description:
      'Declarative assignment strategy (the no-code alternative to triggers). ' +
      'FIXED_USER: assign to assigneeId. POSITION: pool of positionId holders. ' +
      'TASK_STARTER: the user who completed sourceTaskName. TASK_STARTER_MANAGER: the manager ' +
      '(isManager position) of that performer department — resolved at task creation. ' +
      'Starter-based strategies are TASK-scoped: sourceTaskName selects which earlier task the routing follows.',
    enum: ASSIGNMENT_STRATEGIES,
    default: 'FIXED_USER',
  })
  @IsOptional()
  @IsIn(ASSIGNMENT_STRATEGIES)
  strategy?: string;

  @ApiPropertyOptional({
    description:
      'Reference task for TASK_STARTER / TASK_STARTER_MANAGER — the BPMN userTask name ' +
      'whose performer (completer) the assignment is resolved from. Required for those strategies.',
  })
  @IsOptional()
  @IsString()
  sourceTaskName?: string;

  @ApiPropertyOptional({ description: 'User assigned to this task (strategy FIXED_USER). Mutually exclusive with positionId.' })
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
