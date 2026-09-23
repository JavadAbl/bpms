import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { BpmnEngineServiceContract } from '#modules/bpmn/contracts/bpmn-engine.contract.js';
import { FilesServiceContract } from '#modules/file/contracts/file-service.contract.js';
import type { Task, TaskStatus } from '#common/infrastructure/database/generated/prisma/client.js';
import { TaskDto, TaskCreateWaitingOptions } from '../dto/response/task.dto.js';
import { TaskCompleteDto } from '../dto/request/task-complete.dto.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { FormSubmissionRepository } from '../repositories/form-submission.repository.js';
import { UserPositionRepository } from '../repositories/user-position.repository.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  /** Shared include for the کارتابل-style list/detail views. */
  private readonly listInclude = {
    assignee: { select: { id: true, email: true, name: true } },
    position: {
      select: { id: true, name: true, department: { select: { id: true, name: true } } },
    },
    form: { select: { id: true, name: true } },
    processInstance: {
      select: { id: true, status: true, process: { select: { id: true, name: true } } },
    },
  };

  private readonly detailInclude = {
    ...this.listInclude,
    form: { select: { id: true, name: true, fields: true } },
    submissions: true as const,
  };

  constructor(
    private readonly taskRep: TaskRepository,
    private readonly formSubmissionRep: FormSubmissionRepository,
    private readonly userPositionRep: UserPositionRepository,
    private readonly bpmn: BpmnEngineServiceContract,
    private readonly files: FilesServiceContract,
  ) {}

  /**
   * Create a waiting Task row when the BPMN engine reaches a userTask.
   * Called from ProcessInstanceService when the engine emits a `wait` event.
   *
   * If a task with the same executionId already exists (happens when the
   * engine is resumed after a server restart), the existing row is returned
   * unchanged — this makes the method idempotent and safe to call during
   * recovery.
   */
  async taskCreateWaiting(opts: TaskCreateWaitingOptions): Promise<Task> {
    // Check if this task already exists (resume case)
    const existing = await this.taskRep.findFirst({
      where: {
        processInstanceId: opts.instanceId,
        executionId: opts.executionId,
      },
    });
    if (existing) {
      this.logger.log(
        `Task ${existing.id} "${opts.name}" already exists for execution ${opts.executionId} (resume) — skipping create`,
      );
      return existing;
    }

    const task = await this.taskRep.create({
      data: {
        processInstanceId: opts.instanceId,
        name: opts.name,
        description: opts.description,
        assigneeId: opts.assigneeId || null,
        positionId: opts.positionId || null,
        selfService: opts.selfService ?? false,
        formId: opts.formId || null,
        status: 'PENDING',
        activityId: opts.activityId,
        executionId: opts.executionId,
      },
    });
    this.logger.log(
      `Created waiting task ${task.id} "${opts.name}" on instance ${opts.instanceId}` +
        (opts.positionId ? ` (position=${opts.positionId}${opts.selfService ? ', self-service' : ''})` : ''),
    );
    return task;
  }

  /**
   * Find a task by its executionId (used during recovery to check if a
   * task was already completed before the server restarted).
   */
  async taskFindByExecutionId(instanceId: string, executionId: string): Promise<Task | null> {
    return this.taskRep.findFirst({
      where: { processInstanceId: instanceId, executionId },
    });
  }

  /**
   * Get the latest form submission for a task (used during recovery to
   * re-signal the engine if a task was completed but the engine didn't
   * transition before the crash).
   */
  async taskGetLatestSubmission(taskId: string): Promise<{ data: Record<string, unknown> } | null> {
    const sub = await this.formSubmissionRep.findFirst({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!sub) return null;
    return {
      ...sub,
      data: JSON.parse(sub.data) as Record<string, unknown>,
    };
  }

  /**
   * [ADMIN] All waiting (PENDING) tasks across all instances.
   * کارتابل semantics: only *received* tasks are listed — passed/completed
   * tasks live in the instance timeline, not in anyone's inbox.
   */
  async taskGetMany(query: GetManyQueryType<'Task'>): Promise<GetManyReply<TaskDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'description'] });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'desc' };
    predicate.where = { ...predicate.where, status: 'PENDING' } as typeof predicate.where;
    const { items, totalCount } = await this.taskRep.findMany({
      ...predicate,
      include: this.listInclude,
    });
    return { items: items.map((task) => this.serialize(task)), totalCount };
  }

  /**
   * All tasks visible to the current user:
   *  - Tasks directly assigned to the user (assigneeId = userId), including
   *    position-based tasks the user has CLAIMED
   *  - Tasks assigned to a position the user holds AND not yet claimed by
   *    anyone else (assigneeId IS NULL)
   */
  async taskGetMine(userId: string, query: GetManyQueryType<'Task'>): Promise<GetManyReply<TaskDto>> {
    // Get all position IDs the user holds
    const userPositions = await this.userPositionRep.findMany({
      where: { userId },
      select: { positionId: true },
    });
    const positionIds = userPositions.items.map((up) => up.positionId);

    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'description'] });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'asc' };
    predicate.where = {
      ...predicate.where,
      status: 'PENDING',
      OR: [
        // Directly assigned to me (includes position tasks I've claimed)
        { assigneeId: userId },
        // Position-based and NOT yet claimed by anyone
        ...(positionIds.length > 0 ? [{ positionId: { in: positionIds }, assigneeId: null }] : []),
      ],
    } as typeof predicate.where;

    const { items, totalCount } = await this.taskRep.findMany({
      ...predicate,
      include: {
        ...this.listInclude,
        form: { select: { id: true, name: true, fields: true } },
      },
    });
    // Serialize form.fields from JSON string to object for client convenience
    return { items: items.map((task) => this.serialize(task)), totalCount };
  }

  /**
   * Tasks the user has PARTICIPATED in — the history counterpart of the
   * کارتابل: tasks that were once RECEIVED by the user and have since passed
   * out of the flow without being completed by them (CANCELLED when the
   * instance ended/terminated). Tasks the user completed and sent forward
   * are visible through the case list (/process-instances/cases) instead.
   */
  async taskGetParticipated(userId: string, query: GetManyQueryType<'Task'>): Promise<GetManyReply<TaskDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name', 'description'] });
    predicate.orderBy = predicate.orderBy ?? [{ completedAt: 'desc' }, { createdAt: 'desc' }];
    predicate.where = {
      ...predicate.where,
      assigneeId: userId,
      status: { in: ['CANCELLED', 'SKIPPED'] },
    } as typeof predicate.where;

    const { items, totalCount } = await this.taskRep.findMany({
      ...predicate,
      include: this.listInclude,
    });
    return { items: items.map((task) => this.serialize(task)), totalCount };
  }

  /**
   * Merged process-instance data: all form submissions of ALL tasks in the
   * instance (chronological), keyed by engine variable name.
   *
   * This is what later tasks' forms use to pre-fill read-only display fields
   * with data entered in previous tasks (e.g. the approver sees the leave
   * type/dates the employee submitted).
   */
  private async getInstanceVariables(instanceId: string): Promise<Record<string, unknown>> {
    const instanceTasks = await this.taskRep.findMany({
      where: { processInstanceId: instanceId },
      include: {
        form: { select: { fields: true } },
        submissions: { orderBy: { submittedAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const vars: Record<string, unknown> = {};
    for (const t of instanceTasks.items) {
      let fields: any[] = [];
      if (t.form?.fields) {
        try {
          fields = typeof t.form.fields === 'string' ? JSON.parse(t.form.fields) : t.form.fields;
        } catch {
          fields = [];
        }
      }
      const keyToVar = new Map<string, string>();
      for (const f of fields || []) {
        if (f?.name) keyToVar.set(f.name, f.variable || f.name);
      }
      for (const sub of t.submissions) {
        let data: Record<string, unknown>;
        try {
          data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data;
        } catch {
          continue;
        }
        for (const [key, value] of Object.entries(data || {})) {
          const varName = keyToVar.get(key) || key;
          if (value === undefined) continue;
          vars[varName] = value;
          if (varName !== key) vars[key] = value;
        }
      }
    }
    return vars;
  }

  async taskGetById(id: string, user?: { id: string; role?: string }): Promise<TaskDto> {
    const task = await this.taskRep.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (user) await this.assertVisible(task, user);
    const instanceVariables = await this.getInstanceVariables(task.processInstanceId);
    return this.serialize({ ...task, instanceVariables });
  }

  /**
   * کارتابل privacy: each user must only be able to view their own tasks.
   */
  private async assertVisible(
    task: { assigneeId: string | null; positionId: string | null },
    user: { id: string; role?: string },
  ): Promise<void> {
    if (user.role === 'ADMIN') return;
    if (task.assigneeId) {
      if (task.assigneeId === user.id) return;
      throw new ForbiddenException('You can only view your own tasks');
    }
    if (!task.positionId) return; // fully open task — no owner to hide it from
    const holdsPosition = await this.userPositionRep.findUnique({
      where: {
        userId_positionId: { userId: user.id, positionId: task.positionId },
      },
      select: { id: true },
    });
    if (!holdsPosition) {
      throw new ForbiddenException('You can only view your own tasks');
    }
  }

  /**
   * Complete a task: store the form submission, signal the engine, mark the
   * task as COMPLETED. The engine will then fire the next `wait` event for
   * the following userTask (or `end`).
   */
  async taskComplete(
    id: string,
    dto: TaskCompleteDto,
    userId: string,
    role?: string,
  ): Promise<TaskDto> {
    const task = await this.taskGetById(id, { id: userId, role });

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    // Authorization check
    if (task.assignee && task.assignee.id) {
      // Directly assigned to a specific user (or claimed by them)
      if (task.assignee.id !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }
    } else if (task.position && task.position.id) {
      // Position-based, not yet claimed
      const holdsPosition = await this.userPositionRep.findUnique({
        where: {
          userId_positionId: { userId, positionId: task.position.id },
        },
      });
      if (!holdsPosition) {
        throw new ForbiddenException(
          'You do not hold the position required to complete this task',
        );
      }
      // Enforce self-service: must claim before completing
      if (task.selfService) {
        throw new ForbiddenException(
          'This is a self-service task — you must claim it first (POST /api/tasks/:id/claim)',
        );
      }
      // Record who actually completed the task (since assigneeId was null)
      await this.taskRep.update({ where: { id }, data: { assigneeId: userId } });
    } else {
      // Open task (neither assignee nor position): any authenticated user
      // may complete it. Record who actually did.
      await this.taskRep.update({ where: { id }, data: { assigneeId: userId } });
    }

    // 1. Persist form submission FIRST (needed for crash recovery)
    if (dto.data && Object.keys(dto.data).length > 0) {
      await this.formSubmissionRep.create({
        data: {
          taskId: id,
          formId: dto.formId || task.form?.id || null,
          data: JSON.stringify(dto.data),
          submittedById: userId,
        },
      });
      // File "file" fields submit arrays of {id, name, ...} metas — stamp the
      // owning task/instance onto the uploaded rows so later steps (and the
      // instance view) can enumerate the attachments of this step.
      const stamped = await this.files.fileStampFromSubmissionData(
        dto.data,
        id,
        task.processInstanceId,
      );
      if (stamped > 0) {
        this.logger.log(`Stamped ${stamped} file attachment(s) onto task ${id}`);
      }
    }

    // 2. Mark task as completed
    await this.taskRep.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // 3. Signal the BPMN engine — executionId is persisted on the Task row
    if (!task.executionId) {
      throw new Error(
        `Task ${id} has no executionId — cannot signal the engine. ` +
          `This should not happen for tasks created after the persistence feature was added.`,
      );
    }

    // Map submitted field keys to process variable names before signaling engine
    let engineData: Record<string, unknown> = dto.data || {};
    if (task.form && dto.data && Object.keys(dto.data).length > 0) {
      const rawForm = task.form as unknown as { fields: unknown };
      const fields =
        typeof rawForm.fields === 'string' ? (JSON.parse(rawForm.fields) as unknown) : rawForm.fields;
      engineData = {};
      for (const field of (fields as { name: string; variable?: string }[]) || []) {
        const key = field.name;
        const varName = field.variable || field.name;
        if (key in (dto.data as Record<string, unknown>)) {
          engineData[varName] = (dto.data as Record<string, unknown>)[key];
        }
      }
    }

    await this.bpmn.bpmnSignalTask(task.processInstanceId, task.executionId, engineData);

    // Give the engine a moment to fire the next `wait` event (creating the next task)
    // or `end` event (marking the instance COMPLETED).
    await this.waitForEngineAdvance(task.processInstanceId, id);

    return this.taskGetById(id, { id: userId, role });
  }

  /**
   * Poll for up to 2 seconds until either:
   *  - A new task appears on the instance (the engine advanced to the next userTask), or
   *  - The instance status changes from RUNNING (completed/failed/terminated)
   */
  private async waitForEngineAdvance(instanceId: string, completedTaskId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const inst = await this.taskRep.prismaClient.processInstance.findUnique({
        where: { id: instanceId },
        select: { status: true },
      });
      if (!inst || inst.status !== 'RUNNING') return; // instance ended
      const newTask = await this.taskRep.findFirst({
        where: {
          processInstanceId: instanceId,
          status: 'PENDING',
          id: { not: completedTaskId },
        },
        select: { id: true },
      });
      if (newTask) return; // next task is ready
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.logger.warn(`Engine did not advance after completing task ${completedTaskId} within 2s`);
  }

  async taskMarkRemainingCancelled(instanceId: string): Promise<void> {
    await this.taskRep.updateMany({
      where: { processInstanceId: instanceId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /** Earliest PENDING task for an instance (used by draft submit). */
  async taskFindFirstPending(instanceId: string): Promise<Task | null> {
    return this.taskRep.findFirst({
      where: { processInstanceId: instanceId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Claim a position-based task for the current user.
   */
  async taskClaim(id: string, userId: string): Promise<TaskDto> {
    const task = await this.taskGetById(id, { id: userId });

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    if (!task.position?.id) {
      throw new ForbiddenException(
        'Only position-based tasks can be claimed. This task is directly assigned.',
      );
    }

    if (task.assignee?.id) {
      throw new ForbiddenException(
        task.assignee.id === userId
          ? 'You have already claimed this task'
          : 'This task has already been claimed by another user',
      );
    }

    // Verify the user holds the position
    const holdsPosition = await this.userPositionRep.findUnique({
      where: {
        userId_positionId: { userId, positionId: task.position.id },
      },
    });
    if (!holdsPosition) {
      throw new ForbiddenException('You do not hold the position required to claim this task');
    }

    await this.taskRep.update({
      where: { id },
      data: { assigneeId: userId },
    });

    this.logger.log(`Task ${id} claimed by user ${userId}`);
    return this.taskGetById(id, { id: userId });
  }

  /**
   * Release a claimed task back to the position pool.
   */
  async taskRelease(id: string, userId: string): Promise<TaskDto> {
    const task = await this.taskGetById(id, { id: userId });

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    if (!task.position?.id) {
      throw new ForbiddenException(
        'Only position-based tasks can be released. This task is directly assigned.',
      );
    }

    if (task.assignee?.id !== userId) {
      throw new ForbiddenException('You can only release tasks that you have claimed');
    }

    await this.taskRep.update({
      where: { id },
      data: { assigneeId: null },
    });

    this.logger.log(`Task ${id} released back to position pool by user ${userId}`);
    return this.taskGetById(id, { id: userId });
  }

  private serialize(task: Task & Record<string, any>): TaskDto {
    return {
      id: task.id,
      processInstanceId: task.processInstanceId,
      name: task.name,
      description: task.description ?? undefined,
      // IDs are required by the UI for claim/complete gating — nested
      // assignee/position alone is not enough (undefined id looked like an
      // open task and showed «تکمیل» without claim).
      assigneeId: task.assigneeId ?? task.assignee?.id ?? null,
      assignee: task.assignee ?? null,
      positionId: task.positionId ?? task.position?.id ?? null,
      position: task.position ?? null,
      selfService: task.selfService,
      form: task.form
        ? {
            ...task.form,
            fields:
              typeof (task.form as { fields?: unknown }).fields === 'string'
                ? JSON.parse((task.form as { fields: string }).fields)
                : (task.form as { fields?: unknown }).fields,
          }
        : null,
      processInstance: task.processInstance,
      instanceVariables: task.instanceVariables,
      submissions: task.submissions,
      status: task.status as string,
      activityId: task.activityId ?? undefined,
      executionId: task.executionId ?? undefined,
      createdAt: task.createdAt,
      completedAt: task.completedAt ?? undefined,
    };
  }
}
