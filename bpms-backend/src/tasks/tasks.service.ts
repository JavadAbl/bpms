import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BpmnEngineService } from '../bpmn/bpmn.engine';
import { CompleteTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private bpmn: BpmnEngineService,
  ) {}

  /**
   * Create a waiting Task row when the BPMN engine reaches a userTask.
   * Called from ProcessInstancesService when the engine emits a `wait` event.
   *
   * If a task with the same executionId already exists (happens when the
   * engine is resumed after a server restart), the existing row is returned
   * unchanged — this makes the method idempotent and safe to call during
   * recovery.
   */
  async createWaitingTask(opts: {
    instanceId: string;
    activityId: string;     // BPMN element id (e.g. "ApproveRequest")
    executionId: string;    // bpmn-engine runtime execution id (persisted)
    name: string;           // Human-friendly task name
    description?: string;
    assigneeId?: string | null;
    positionId?: string | null;
    selfService?: boolean;
    formId?: string | null;
  }) {
    // Check if this task already exists (resume case)
    const existing = await this.prisma.task.findFirst({
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

    const task = await this.prisma.task.create({
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
  async findByExecutionId(instanceId: string, executionId: string) {
    return this.prisma.task.findFirst({
      where: { processInstanceId: instanceId, executionId },
    });
  }

  /**
   * Get the latest form submission for a task (used during recovery to
   * re-signal the engine if a task was completed but the engine didn't
   * transition before the crash).
   */
  async getLatestSubmission(taskId: string) {
    const sub = await this.prisma.formSubmission.findFirst({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!sub) return null;
    return {
      ...sub,
      data: JSON.parse(sub.data),
    };
  }

  async findAll() {
    return this.prisma.task.findMany({
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        position: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
        form: { select: { id: true, name: true } },
        processInstance: {
          select: { id: true, status: true, process: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * All tasks visible to the current user:
   *  - Tasks directly assigned to the user (assigneeId = userId), including
   *    position-based tasks the user has CLAIMED
   *  - Tasks assigned to a position the user holds AND not yet claimed by
   *    anyone else (assigneeId IS NULL)
   *
   * Once a position-based task is claimed by another user, it disappears from
   * this user's queue (assigneeId is no longer null).
   */
  async findMine(userId: string) {
    // Get all position IDs the user holds
    const userPositions = await this.prisma.userPosition.findMany({
      where: { userId },
      select: { positionId: true },
    });
    const positionIds = userPositions.map((up) => up.positionId);

    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          // Directly assigned to me (includes position tasks I've claimed)
          { assigneeId: userId },
          // Position-based and NOT yet claimed by anyone
          ...(positionIds.length > 0
            ? [{ positionId: { in: positionIds }, assigneeId: null }]
            : []),
        ],
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        position: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true } },
          },
        },
        form: { select: { id: true, name: true, fields: true } },
        processInstance: {
          select: {
            id: true,
            status: true,
            process: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    // Serialize form.fields from JSON string to object for client convenience
    return tasks.map((t) => ({
      ...t,
      form: t.form
        ? { ...t.form, fields: typeof t.form.fields === 'string' ? JSON.parse(t.form.fields) : t.form.fields }
        : null,
    }));
  }

  /**
   * All tasks belonging to a specific process instance.
   */
  async findByInstance(instanceId: string) {
    return this.prisma.task.findMany({
      where: { processInstanceId: instanceId },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        position: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
        form: { select: { id: true, name: true, fields: true } },
        submissions: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        position: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true } },
          },
        },
        form: { select: { id: true, name: true, fields: true } },
        processInstance: {
          select: {
            id: true,
            status: true,
            process: { select: { id: true, name: true } },
          },
        },
        submissions: true,
      },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return {
      ...task,
      form: task.form
        ? {
            ...task.form,
            fields:
              typeof task.form.fields === 'string'
                ? JSON.parse(task.form.fields)
                : task.form.fields,
          }
        : null,
    };
  }

  /**
   * Complete a task: store the form submission, signal the engine, mark the
   * task as COMPLETED. The engine will then fire the next `wait` event for
   * the following userTask (or `end`).
   *
   * Authorization:
   *  - If task.assigneeId is set → only that user can complete
   *  - If task.positionId is set and assigneeId is null:
   *    - If selfService = true  → REJECT (must claim first via POST /claim)
   *    - If selfService = false → any holder can complete (assigneeId set on complete)
   *  - If neither is set → any authenticated user can complete (open task)
   *
   * Order of operations (crash-safe):
   *  1. Persist form submission (so we can re-signal on recovery)
   *  2. Mark task as COMPLETED in DB (set assigneeId if completed via position)
   *  3. Signal the BPMN engine (uses executionId from DB, not in-memory Map)
   *  4. Engine state is persisted by the listener's `wait`/`end` handler
   */
  async complete(id: string, dto: CompleteTaskDto, userId: string) {
    const task = await this.findOne(id);

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    // Authorization check
    if (task.assigneeId) {
      // Directly assigned to a specific user (or claimed by them)
      if (task.assigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }
    } else if (task.positionId) {
      // Position-based, not yet claimed
      // Check if the user holds the position
      const holdsPosition = await this.prisma.userPosition.findUnique({
        where: {
          userId_positionId: { userId, positionId: task.positionId },
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
      await this.prisma.task.update({
        where: { id },
        data: { assigneeId: userId },
      });
    }
    // If neither assigneeId nor positionId is set, anyone can complete (open task)

    // 1. Persist form submission FIRST (needed for crash recovery)
    if (dto.data && Object.keys(dto.data).length > 0) {
      await this.prisma.formSubmission.create({
        data: {
          taskId: id,
          formId: dto.formId || task.formId || null,
          data: JSON.stringify(dto.data),
          submittedById: userId,
        },
      });
    }

    // 2. Mark task as completed
    await this.prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // 3. Signal the BPMN engine — executionId is now persisted on the Task row
    if (!task.executionId) {
      throw new Error(
        `Task ${id} has no executionId — cannot signal the engine. ` +
          `This should not happen for tasks created after the persistence feature was added.`,
      );
    }

    // Map submitted field keys to process variable names before signaling engine
    let engineData = dto.data || {};
    if (task.form && dto.data && Object.keys(dto.data).length > 0) {
      const fields =
        typeof task.form.fields === 'string'
          ? JSON.parse(task.form.fields)
          : task.form.fields;
      engineData = {};
      for (const field of fields || []) {
        const key = field.name;
        const varName = field.variable || field.name;
        if (key in dto.data) {
          engineData[varName] = dto.data[key];
        }
      }
    }

    await this.bpmn.signalTask(task.processInstanceId, task.executionId, engineData);

    // Give the engine a moment to fire the next `wait` event (creating the next task)
    // or `end` event (marking the instance COMPLETED). This ensures the response
    // to the client reflects the latest state.
    await this.waitForEngineAdvance(task.processInstanceId, id);

    return this.findOne(id);
  }

  /**
   * Poll for up to 2 seconds until either:
   *  - A new task appears on the instance (the engine advanced to the next userTask), or
   *  - The instance status changes from RUNNING (completed/failed/terminated)
   */
  private async waitForEngineAdvance(instanceId: string, completedTaskId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const inst = await this.prisma.processInstance.findUnique({
        where: { id: instanceId },
        select: { status: true },
      });
      if (!inst || inst.status !== 'RUNNING') return; // instance ended
      const newTask = await this.prisma.task.findFirst({
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

  async markRemainingCancelled(instanceId: string) {
    await this.prisma.task.updateMany({
      where: { processInstanceId: instanceId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Claim a position-based task for the current user.
   * After claiming, the task disappears from other holders' queues and only
   * the claimer can complete it.
   *
   * Rules:
   *  - Task must be PENDING
   *  - Task must have a positionId (position-based)
   *  - Task must not already be claimed (assigneeId must be null)
   *  - User must hold the task's position
   */
  async claim(id: string, userId: string) {
    const task = await this.findOne(id);

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    if (!task.positionId) {
      throw new ForbiddenException(
        'Only position-based tasks can be claimed. This task is directly assigned.',
      );
    }

    if (task.assigneeId) {
      throw new ForbiddenException(
        task.assigneeId === userId
          ? 'You have already claimed this task'
          : 'This task has already been claimed by another user',
      );
    }

    // Verify the user holds the position
    const holdsPosition = await this.prisma.userPosition.findUnique({
      where: {
        userId_positionId: { userId, positionId: task.positionId },
      },
    });
    if (!holdsPosition) {
      throw new ForbiddenException(
        'You do not hold the position required to claim this task',
      );
    }

    await this.prisma.task.update({
      where: { id },
      data: { assigneeId: userId },
    });

    this.logger.log(`Task ${id} claimed by user ${userId}`);
    return this.findOne(id);
  }

  /**
   * Release a claimed task back to the position pool.
   * After release, the task reappears in all position holders' queues.
   *
   * Rules:
   *  - Task must be PENDING
   *  - Task must have a positionId (was originally position-based)
   *  - Task must be claimed by the current user (assigneeId = userId)
   */
  async release(id: string, userId: string) {
    const task = await this.findOne(id);

    if (task.status !== 'PENDING') {
      throw new ForbiddenException(`Task is already ${task.status}`);
    }

    if (!task.positionId) {
      throw new ForbiddenException(
        'Only position-based tasks can be released. This task is directly assigned.',
      );
    }

    if (task.assigneeId !== userId) {
      throw new ForbiddenException(
        'You can only release tasks that you have claimed',
      );
    }

    await this.prisma.task.update({
      where: { id },
      data: { assigneeId: null },
    });

    this.logger.log(`Task ${id} released back to position pool by user ${userId}`);
    return this.findOne(id);
  }
}
