import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const ASSIGNMENT_STRATEGIES = [
  'FIXED_USER',
  'POSITION',
  'TASK_STARTER',
  'TASK_STARTER_MANAGER',
] as const;

export class ProcessAssignmentDto {
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

  @ApiPropertyOptional({
    description: 'User assigned to this task (strategy FIXED_USER). Mutually exclusive with positionId.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Position assigned to this task — any holder can complete. Mutually exclusive with assigneeId.',
  })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({
    description:
      'Self-service mode (only with positionId). If true, holder must CLAIM before completing. Default false.',
    default: false,
  })
  @IsOptional()
  selfService?: boolean;

  @ApiPropertyOptional({ description: 'Form bound to this task' })
  @IsOptional()
  @IsUUID()
  formId?: string;
}

export class ProcessAssignmentBulkDto {
  @ApiProperty({ type: [ProcessAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessAssignmentDto)
  assignments: ProcessAssignmentDto[];
}
