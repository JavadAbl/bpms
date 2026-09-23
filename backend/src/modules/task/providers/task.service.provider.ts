import { Injectable } from '@nestjs/common';
import { TaskService } from '../services/task.service.js';
import { TaskServiceContract } from '../contracts/task-service.contract.js';
import type { TaskCreateWaitingOptions, TaskDto } from '../dto/response/task.dto.js';
import type { TaskCompleteDto } from '../dto/request/task-complete.dto.js';
import type { Task } from '#common/infrastructure/database/generated/prisma/client.js';

/** Contract implementation consumed by other modules (process-instance, process-draft). */
@Injectable()
export class TaskProvider implements TaskServiceContract {
  constructor(private readonly taskService: TaskService) {}

  taskCreateWaiting(opts: TaskCreateWaitingOptions): Promise<Task> {
    return this.taskService.taskCreateWaiting(opts);
  }

  taskFindByExecutionId(instanceId: string, executionId: string): Promise<Task | null> {
    return this.taskService.taskFindByExecutionId(instanceId, executionId);
  }

  taskGetLatestSubmission(taskId: string): Promise<{ data: Record<string, unknown> } | null> {
    return this.taskService.taskGetLatestSubmission(taskId);
  }

  taskMarkRemainingCancelled(instanceId: string): Promise<void> {
    return this.taskService.taskMarkRemainingCancelled(instanceId);
  }

  taskComplete(
    id: string,
    dto: TaskCompleteDto,
    userId: string,
    role?: string,
  ): Promise<TaskDto> {
    return this.taskService.taskComplete(id, dto, userId, role);
  }

  taskFindFirstPending(instanceId: string): Promise<Task | null> {
    return this.taskService.taskFindFirstPending(instanceId);
  }
}
