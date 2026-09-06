import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BpmnEngineService, EngineCallbacks, WaitingTaskInfo } from '../bpmn/bpmn.engine';
import { TasksService } from '../tasks/tasks.service';
import { StartInstanceDto } from './dto/instance.dto';

@Injectable()
export class ProcessInstancesService implements OnModuleInit {
  private readonly logger = new Logger(ProcessInstancesService.name);

  constructor(
    private prisma: PrismaService,
    private bpmn: BpmnEngineService,
    private tasks: TasksService,
  ) {}

  /**
   * On server startup, recover all RUNNING instances from their saved
   * engine state. This is what makes the system survive restarts.
   */
  async onModuleInit() {
    await this.recoverRunningInstances();
  }

  private async recoverRunningInstances() {
    const running = await this.prisma.processInstance.findMany({
      where: { status: 'RUNNING' },
      include: {
        process: { include: { assignments: true } },
      },
    });

    if (running.length === 0) {
      this.logger.log('No running instances to recover.');
      return;
    }

    this.logger.log(`Recovering ${running.length} running instance(s)...`);

    for (const inst of running) {
      if (!inst.engineState) {
        // Instance was created before persistence was added, or state was never saved
        this.logger.warn(
          `Instance ${inst.id} has no engineState — marking as FAILED (cannot recover)`,
        );
        await this.prisma.processInstance.update({
          where: { id: inst.id },
          data: {
            status: 'FAILED',
            lastError: 'No engine state to recover from (pre-persistence instance or state lost)',
            completedAt: new Date(),
          },
        });
        await this.tasks.markRemainingCancelled(inst.id);
        continue;
      }

      try {
        const state = JSON.parse(inst.engineState);
        const callbacks = this.createCallbacks(inst.id, inst.process.assignments, inst.startedById);
        await this.bpmn.resumeInstance({
          instanceId: inst.id,
          bpmnXml: inst.bpmnXmlSnapshot,
          engineState: state,
          callbacks,
        });
        this.logger.log(`Recovered instance ${inst.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to recover instance ${inst.id}: ${err.message}`);
        await this.prisma.processInstance.update({
          where: { id: inst.id },
          data: {
            status: 'FAILED',
            lastError: `Recovery failed: ${err.message}`,
            completedAt: new Date(),
          },
        });
        await this.tasks.markRemainingCancelled(inst.id);
      }
    }
  }

  /**
   * Build the EngineCallbacks for a given instance. Shared between start()
   * and resumeInstance() so the behavior is identical.
   *
   * The onUserTask callback includes crash-recovery logic: if the engine
   * emits `wait` for a task that is already COMPLETED in the DB (meaning
   * the user completed it but the engine didn't transition before the crash),
   * we re-signal the engine with the stored form submission data.
   */
  private createCallbacks(instanceId: string, assignments: any[], startedById: string): EngineCallbacks {
    return {
      onUserTask: async (info: WaitingTaskInfo) => {
        const existing = await this.tasks.findByExecutionId(instanceId, info.executionId);

        if (existing) {
          if (existing.status === 'COMPLETED') {
            // Crash-recovery: task was completed but engine didn't transition.
            // Re-signal with the stored form submission data.
            const submission = await this.tasks.getLatestSubmission(existing.id);
            if (submission) {
              this.logger.log(
                `Re-signaling completed task ${existing.id} (execution=${info.executionId}) ` +
                  `to advance engine after restart`,
              );
              // Use setImmediate to avoid blocking the wait handler
              setImmediate(() => {
                this.bpmn
                  .signalTask(instanceId, info.executionId, submission.data)
                  .catch((err) =>
                    this.logger.error(`Re-signal failed for ${existing.id}: ${err.message}`),
                  );
              });
            } else {
              this.logger.error(
                `Task ${existing.id} is COMPLETED but no submission found — cannot re-signal. ` +
                  `Instance ${instanceId} may be stuck.`,
              );
            }
            return;
          }
          // Task is PENDING — already in DB, just registered in memory by the listener
          this.logger.log(
            `Task ${existing.id} already PENDING (execution=${info.executionId}) — no action needed`,
          );
          return;
        }

        // New task — create in DB. Resolve the declarative assignment strategy
        // (FIXED_USER / POSITION / TASK_STARTER / TASK_STARTER_MANAGER) to
        // concrete task fields at creation time — the high-level, no-code
        // alternative to ProcessMaker-style triggers.
        const assignment = assignments.find((a) => a.taskName === info.name);
        const resolved = await this.resolveAssignment(assignment, startedById, instanceId);
        await this.tasks.createWaitingTask({
          instanceId,
          activityId: info.activityId,
          executionId: info.executionId,
          name: info.name,
          description: info.description,
          assigneeId: resolved.assigneeId,
          positionId: resolved.positionId,
          selfService: resolved.selfService,
          formId: assignment?.formId || null,
        });
      },

      onEnd: async () => {
        await this.prisma.processInstance.update({
          where: { id: instanceId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            engineState: null, // clear state — no longer needed
          },
        });
        await this.tasks.markRemainingCancelled(instanceId);
      },

      onError: async (err: Error) => {
        await this.prisma.processInstance.update({
          where: { id: instanceId },
          data: {
            status: 'FAILED',
            lastError: err.message,
            completedAt: new Date(),
          },
        });
      },

      onStateChange: async (state: any) => {
        await this.prisma.processInstance.update({
          where: { id: instanceId },
          data: { engineState: JSON.stringify(state) },
        });
      },
    };
  }

  /**
   * Resolve a TaskAssignment's declarative strategy to concrete task fields.
   *
   * Strategies (starter-based ones are TASK-scoped, not process-scoped —
   * the designer picks WHICH earlier task's performer the routing follows,
   * so different branches can each follow their own performer's manager):
   *   FIXED_USER           → stored assigneeId (static, designer picked a user)
   *   POSITION             → positionId pool (any holder can complete/claim)
   *   TASK_STARTER         → the user who completed sourceTaskName in this
   *                          instance (falls back to the instance starter when
   *                          the reference task never ran — e.g. skipped branch)
   *   TASK_STARTER_MANAGER → the manager of that performer: performer →
   *                          UserPosition → Position → Department → the
   *                          department's isManager position → its holder(s).
   *                          Falls back to the first ADMIN so the flow never
   *                          dead-ends.
   *   INITIATOR / INITIATOR_MANAGER → legacy process-starter aliases kept for
   *                          in-flight rows created before the task-scoped
   *                          refactor; they resolve from the instance starter.
   */
  private async resolveAssignment(
    assignment: any,
    startedById: string,
    instanceId: string,
  ): Promise<{ assigneeId: string | null; positionId: string | null; selfService: boolean }> {
    const strategy: string =
      assignment?.strategy ||
      (assignment?.assigneeId ? 'FIXED_USER' : assignment?.positionId ? 'POSITION' : 'FIXED_USER');

    switch (strategy) {
      case 'TASK_STARTER': {
        const performer = await this.findTaskPerformer(instanceId, assignment?.sourceTaskName);
        if (performer) {
          this.logger.log(
            `Assignment TASK_STARTER resolved: performer of "${assignment.sourceTaskName}" → ${performer.id} (${performer.name})`,
          );
          return { assigneeId: performer.id, positionId: null, selfService: false };
        }
        // Reference task never completed in this instance (skipped branch,
        // not reached yet, or no recorded performer) — fall back to the
        // instance starter so the flow never dead-ends.
        this.logger.warn(
          `Assignment TASK_STARTER: no performer for "${assignment?.sourceTaskName}" in instance ${instanceId} — ` +
            `falling back to instance starter ${startedById}`,
        );
        return { assigneeId: startedById, positionId: null, selfService: false };
      }

      case 'TASK_STARTER_MANAGER': {
        const performer = await this.findTaskPerformer(instanceId, assignment?.sourceTaskName);
        const referenceUser = performer?.id ?? startedById;
        const manager = await this.findUserManager(referenceUser);
        if (manager) {
          this.logger.log(
            `Assignment TASK_STARTER_MANAGER resolved: performer of "${assignment.sourceTaskName}" ` +
              `${referenceUser}${performer ? '' : ' (source task missing — instance starter)'} → manager ${manager.id} (${manager.name})`,
          );
          return { assigneeId: manager.id, positionId: null, selfService: false };
        }
        // Fallback: route to the first ADMIN so the flow never dead-ends
        const admin = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
        });
        this.logger.warn(
          `Assignment TASK_STARTER_MANAGER: no manager found for user ${referenceUser} — ` +
            `falling back to admin ${admin?.id ?? '(none exists)'}`,
        );
        return { assigneeId: admin?.id ?? null, positionId: null, selfService: false };
      }

      // Legacy process-level aliases (kept for rows created before the
      // task-scoped refactor) — resolve from the instance starter.
      case 'INITIATOR':
        return { assigneeId: startedById, positionId: null, selfService: false };

      case 'INITIATOR_MANAGER': {
        const manager = await this.findUserManager(startedById);
        if (manager) {
          return { assigneeId: manager.id, positionId: null, selfService: false };
        }
        const admin = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
        });
        return { assigneeId: admin?.id ?? null, positionId: null, selfService: false };
      }

      case 'POSITION':
        return {
          assigneeId: null,
          positionId: assignment?.positionId || null,
          selfService: assignment?.selfService ?? false,
        };

      case 'FIXED_USER':
      default:
        return {
          assigneeId: assignment?.assigneeId || null,
          positionId: null,
          selfService: false,
        };
    }
  }

  /**
   * Find the user who completed (or is assigned to complete) the task named
   * `taskName` within the given instance. Resolution order:
   *   1. the submitter of the task's latest form submission (ground truth —
   *      covers position-pool tasks completed without a claim)
   *   2. the task's assigneeId (fixed tasks; also the INTENDED performer for
   *      still-pending tasks in parallel branches)
   * Returns null when the task doesn't exist or has no performer yet.
   */
  private async findTaskPerformer(instanceId: string, taskName?: string | null) {
    if (!taskName) return null;
    const task = await this.prisma.task.findFirst({
      where: { processInstanceId: instanceId, name: taskName },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return null;

    if (task.status === 'COMPLETED') {
      const submission = await this.prisma.formSubmission.findFirst({
        where: { taskId: task.id },
        orderBy: { submittedAt: 'desc' },
        select: { submittedById: true },
      });
      if (submission) {
        const user = await this.prisma.user.findUnique({ where: { id: submission.submittedById } });
        if (user) return user;
      }
    }
    if (!task.assigneeId) return null;
    return this.prisma.user.findUnique({ where: { id: task.assigneeId } });
  }

  /**
   * Find the manager of the given user: user → their position(s) → department(s)
   * → the department's isManager position → the user(s) holding it.
   * Prefers a manager other than the user themself (avoids self-approval when
   * an alternative manager exists). Returns null when nothing matches.
   */
  private async findUserManager(userId: string) {
    const userPositions = await this.prisma.userPosition.findMany({
      where: { userId },
      include: { position: true },
    });
    const departmentIds = [
      ...new Set(userPositions.map((up) => up.position.departmentId)),
    ];
    if (departmentIds.length === 0) return null;

    const managerPositions = await this.prisma.position.findMany({
      where: { departmentId: { in: departmentIds }, isManager: true },
    });
    if (managerPositions.length === 0) return null;

    const managerLinks = await this.prisma.userPosition.findMany({
      where: { positionId: { in: managerPositions.map((p) => p.id) } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    if (managerLinks.length === 0) return null;

    const otherThanSelf = managerLinks.find((l) => l.userId !== userId);
    return (otherThanSelf ?? managerLinks[0]).user;
  }

  async findAll() {
    return this.prisma.processInstance.findMany({
      include: {
        process: { select: { id: true, name: true, version: true } },
        startedBy: { select: { id: true, email: true, name: true } },
        // Task timeline powers the report's "current step" / progress columns
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(id: string, user?: { id: string; role?: string }) {
    const inst = await this.prisma.processInstance.findUnique({
      where: { id },
      include: {
        process: { select: { id: true, name: true, version: true, bpmnXml: true } },
        startedBy: { select: { id: true, email: true, name: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, email: true, name: true } },
            position: {
              select: {
                id: true,
                name: true,
                department: { select: { id: true, name: true } },
              },
            },
            form: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!inst) throw new NotFoundException(`Instance ${id} not found`);
    if (user) await this.assertParticipant(inst, user);
    return inst;
  }

  /**
   * Same privacy model as the کارتابل: an instance (and the tasks inside it)
   * is visible to the caller only when they participate in it:
   *  - ADMIN, or
   *  - the user who started the instance, or
   *  - a user with a task assigned to them on the instance, or
   *  - a holder of a position whose pool task on this instance is unclaimed.
   */
  private async assertParticipant(
    inst: { id: string; startedById: string | null },
    user: { id: string; role?: string },
  ): Promise<void> {
    if (user.role === 'ADMIN') return;
    if (inst.startedById === user.id) return;
    const userPositions = await this.prisma.userPosition.findMany({
      where: { userId: user.id },
      select: { positionId: true },
    });
    const positionIds = userPositions.map((up) => up.positionId);
    const participant = await this.prisma.task.findFirst({
      where: {
        processInstanceId: inst.id,
        OR: [
          { assigneeId: user.id },
          ...(positionIds.length > 0
            ? [{ assigneeId: null, positionId: { in: positionIds } }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!participant) {
      throw new ForbiddenException(
        'You can only view process instances you participate in',
      );
    }
  }

  async findByUser(userId: string) {
    return this.prisma.processInstance.findMany({
      where: {
        OR: [{ startedById: userId }, { tasks: { some: { assigneeId: userId } } }],
      },
      include: {
        process: { select: { id: true, name: true } },
        startedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async start(dto: StartInstanceDto, userId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: dto.processId },
      include: { assignments: true },
    });
    if (!process) throw new NotFoundException(`Process ${dto.processId} not found`);
    if (process.status !== 'ACTIVE') {
      throw new BadRequestException(`Process must be ACTIVE to start. Current: ${process.status}`);
    }

    // Create instance record
    const instance = await this.prisma.processInstance.create({
      data: {
        processId: process.id,
        startedById: userId,
        status: 'RUNNING',
        bpmnXmlSnapshot: process.bpmnXml,
      },
    });

    const callbacks = this.createCallbacks(instance.id, process.assignments, userId);

    // Kick off the BPMN engine
    try {
      await this.bpmn.startInstance({
        instanceId: instance.id,
        bpmnXml: process.bpmnXml,
        callbacks,
      });
      // Give the engine a moment to fire the first `wait` event and create the initial task.
      // The wait handler is async (it creates the Task row), and engine.execute() returns
      // before the handler completes. A short poll ensures findOne returns the task.
      await this.waitForFirstTask(instance.id);
    } catch (err: any) {
      await this.prisma.processInstance.update({
        where: { id: instance.id },
        data: { status: 'FAILED', lastError: err.message, completedAt: new Date() },
      });
      throw err;
    }

    return this.findOne(instance.id, { id: userId });
  }

  /**
   * Poll for up to 2 seconds until at least one Task row exists for the instance.
   * This handles the race between engine.execute() returning and the async
   * `wait` event handler creating the Task row.
   */
  private async waitForFirstTask(instanceId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const count = await this.prisma.task.count({ where: { processInstanceId: instanceId } });
      if (count > 0) return;
      // Also check if the instance already completed (e.g. no user tasks at all)
      const inst = await this.prisma.processInstance.findUnique({
        where: { id: instanceId },
        select: { status: true },
      });
      if (inst && inst.status !== 'RUNNING') return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.logger.warn(`No task created for instance ${instanceId} after 2s — process may have no user tasks`);
  }

  async terminate(id: string, user?: { id: string; role?: string }) {
    const inst = await this.findOne(id, user);
    if (user && user.role !== 'ADMIN' && inst.startedById !== user.id) {
      throw new ForbiddenException(
        'Only the user who started this instance or an admin can terminate it',
      );
    }
    if (inst.status !== 'RUNNING') {
      throw new BadRequestException(`Instance is not RUNNING (status=${inst.status})`);
    }
    await this.bpmn.terminateInstance(id);
    await this.prisma.processInstance.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        completedAt: new Date(),
        engineState: null, // clear state
      },
    });
    await this.tasks.markRemainingCancelled(id);
    return this.findOne(id, user);
  }
}
