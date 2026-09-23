import type { Task } from '#common/infrastructure/database/generated/prisma/client.js';
import type { TaskCreateWaitingOptions } from '../dto/response/task.dto.js';
import type { TaskDto } from '../dto/response/task.dto.js';
import type { TaskCompleteDto } from '../dto/request/task-complete.dto.js';

/**
 * Cross-module API of the task domain.
 * Consumed by the process-instance module (engine lifecycle orchestration)
 * and the process-draft module (submit → complete first task).
 */
export abstract class TaskServiceContract {
  /**
   * Create a waiting Task row when the BPMN engine reaches a userTask.
   * Idempotent: if a task with the same executionId already exists (resume
   * case), the existing row is returned unchanged.
   */
  abstract taskCreateWaiting(opts: TaskCreateWaitingOptions): Promise<Task>;

  /** Find a task by its executionId (recovery crash-check). */
  abstract taskFindByExecutionId(instanceId: string, executionId: string): Promise<Task | null>;

  /** Latest form submission of a task (parsed data) — recovery re-signal. */
  abstract taskGetLatestSubmission(
    taskId: string,
  ): Promise<{ data: Record<string, unknown> } | null>;

  /** Mark all remaining PENDING tasks of an instance as CANCELLED. */
  abstract taskMarkRemainingCancelled(instanceId: string): Promise<void>;

  /** Complete a PENDING task (form submit + engine signal). */
  abstract taskComplete(
    id: string,
    dto: TaskCompleteDto,
    userId: string,
    role?: string,
  ): Promise<TaskDto>;

  /** First PENDING task of an instance (by createdAt), or null. */
  abstract taskFindFirstPending(instanceId: string): Promise<Task | null>;
}
