import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FormFieldDto } from '#modules/form/dto/request/form-field.dto.js';

export interface TaskAssigneeDto {
  id: string;
  email: string;
  name: string;
}

export interface TaskPositionDto {
  id: string;
  name: string;
  department?: { id: string; name: string };
}

export interface TaskFormDto {
  id: string;
  name: string;
  fields?: FormFieldDto[];
}

export interface TaskProcessInstanceDto {
  id: string;
  status: string;
  process?: { id: string; name: string };
}

export class TaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  processInstanceId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Direct assignee id (null until claimed for position pools)' })
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  assignee?: TaskAssigneeDto | null;

  @ApiPropertyOptional({ description: 'Position pool id (if position-assigned)' })
  positionId?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  position?: TaskPositionDto | null;

  @ApiPropertyOptional({ type: Boolean, description: 'Must be claimed before completing' })
  selfService?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  form?: TaskFormDto | null;

  @ApiProperty({ enum: ['PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED'] })
  status: string;

  @ApiPropertyOptional()
  activityId?: string;

  @ApiPropertyOptional({ description: 'bpmn-engine runtime execution id' })
  executionId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  processInstance?: TaskProcessInstanceDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Merged variables from all form submissions of the instance (prefill chain)',
  })
  instanceVariables?: Record<string, unknown>;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  submissions?: {
    id: string;
    data: string;
    submittedAt: Date;
  }[];

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;
}

/** Options for creating a waiting task when the engine reaches a userTask. */
export interface TaskCreateWaitingOptions {
  instanceId: string;
  /** BPMN element id (e.g. "ApproveRequest") */
  activityId: string;
  /** bpmn-engine runtime execution id (persisted) */
  executionId: string;
  /** Human-friendly task name */
  name: string;
  description?: string;
  assigneeId?: string | null;
  positionId?: string | null;
  selfService?: boolean;
  formId?: string | null;
}
