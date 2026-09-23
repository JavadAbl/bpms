import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { BpmnEngineServiceContract, type EngineCallbacks, type WaitingTaskInfo } from '#modules/bpmn/contracts/bpmn-engine.contract.js';
import { TaskServiceContract } from '#modules/task/contracts/task-service.contract.js';
import type { TaskAssignment } from '#common/infrastructure/database/generated/prisma/client.js';
import { ProcessInstanceDto } from '../dto/response/process-instance.dto.js';
import { ProcessInstanceStartDto } from '../dto/request/process-instance-start.dto.js';
import { ProcessInstanceRepository } from '../repositories/process-instance.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { FormSubmissionRepository } from '../repositories/form-submission.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { UserPositionRepository } from '../repositories/user-position.repository.js';
import { PositionRepository } from '../repositories/position.repository.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ProcessInstanceService implements OnModuleInit {
  private readonly logger = new Logger(ProcessInstanceService.name);

  constructor(
    private readonly processInstanceRep: ProcessInstanceRepository,
    private readonly taskRep: TaskRepository,
    private readonly formSubmissionRep: FormSubmissionRepository,
    private readonly userRep: UserRepository,
    private readonly userPositionRep: UserPositionRepository,
    private readonly positionRep: PositionRepository,
    private readonly bpmn: BpmnEngineServiceContract,
    private readonly taskService: TaskServiceContract,
  ) {}

  /**
   * On server startup, recover all RUNNING instances from their saved
   * engine state. This is what makes the system survive restarts.
   */
  async onModuleInit() {
    await this.recoverRunningInstances();
  }

  private async recoverRunningInstances(): Promise<void> {
    const running = await this.processInstanceRep.findMany({
      where: { status: 'RUNNING' },
      include: {
        process: { include: { assignments: true } },
      },
    });

    if (running.items.length === 0) {
      this.logger.log('No running instances to recover.');
      return;
    }

    this.logger.log(`Recovering ${running.items.length} running instance(s)...`);

    for (const inst of running.items) {
      if (!inst.engineState) {
        // Instance was created before persistence was added, or state was never saved
        this.logger.warn(
          `Instance ${inst.id} has no engineState — marking as FAILED (cannot recover)`,
        );
        await this.processInstanceRep.update({
          where: { id: inst.id },
          data: {
            status: 'FAILED',
            lastError: 'No engine state to recover from (pre-persistence instance or state lost)',
            completedAt: new Date(),
          },
        });
        await this.taskService.taskMarkRemainingCancelled(inst.id);
        continue;
      }

      try {
        const state = JSON.parse(inst.engineState);
        const callbacks = this.createCallbacks(inst.id, inst.process.assignments, inst.startedById);
        await this.bpmn.bpmnResumeInstance({
          instanceId: inst.id,
          bpmnXml: inst.bpmnXmlSnapshot,
          engineState: state,
          callbacks,
        });
        this.logger.log(`Recovered instance ${inst.id}`);
      } catch (err: unknown) {
        this.logger.error(`Failed to recover instance ${inst.id}: ${(err as Error).message}`);
        await this.processInstanceRep.update({
          where: { id: inst.id },
          data: {
            status: 'FAILED',
            lastError: `Recovery failed: ${(err as Error).message}`,
            completedAt: new Date(),
          },
        });
        await this.taskService.taskMarkRemainingCancelled(inst.id);
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
  private createCallbacks(
    instanceId: string,
    assignments: TaskAssignment[],
    startedById: string,
  ): EngineCallbacks {
    return {
      onUserTask: async (info: WaitingTaskInfo) => {
        const existing = await this.taskService.taskFindByExecutionId(instanceId, info.executionId);

        if (existing) {
          if (existing.status === 'COMPLETED') {
            // Crash-recovery: task was completed but engine didn't transition.
            // Re-signal with the stored form submission data.
            const submission = await this.taskService.taskGetLatestSubmission(existing.id);
            if (submission) {
              this.logger.log(
                `Re-signaling completed task ${existing.id} (execution=${info.executionId}) ` +
                  `to advance engine after restart`,
              );
              // Use setImmediate to avoid blocking the wait handler
              setImmediate(() => {
                this.bpmn
                  .bpmnSignalTask(instanceId, info.executionId, submission.data)
                  .catch((err: unknown) =>
                    this.logger.error(`Re-signal failed for ${existing.id}: ${(err as Error).message}`),
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
        await this.taskService.taskCreateWaiting({
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
        await this.processInstanceRep.update({
          where: { id: instanceId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            engineState: null, // clear state — no longer needed
          },
        });
        await this.taskService.taskMarkRemainingCancelled(instanceId);
      },

      onError: async (err: Error) => {
        await this.processInstanceRep.update({
          where: { id: instanceId },
          data: {
            status: 'FAILED',
            lastError: err.message,
            completedAt: new Date(),
          },
        });
      },

      onStateChange: async (state: unknown) => {
        await this.processInstanceRep.update({
          where: { id: instanceId },
          data: { engineState: JSON.stringify(state) },
        });
      },
    };
  }

  /**
   * Resolve a TaskAssignment's declarative strategy to concrete task fields.
   */
  private async resolveAssignment(
    assignment: TaskAssignment | undefined,
    startedById: string,
    instanceId: string,
  ): Promise<{ assigneeId: string | null; positionId: string | null; selfService: boolean }> {
    const strategy: string =
      assignment?.strategy ||
      (assignment?.assigneeId
        ? 'FIXED_USER'
        : assignment?.positionId
          ? 'POSITION'
          : 'FIXED_USER');

    switch (strategy) {
      case 'TASK_STARTER': {
        const performer = await this.findTaskPerformer(instanceId, assignment?.sourceTaskName);
        if (performer) {
          this.logger.log(
            `Assignment TASK_STARTER resolved: performer of "${assignment?.sourceTaskName}" → ${performer.id} (${performer.name})`,
          );
          return { assigneeId: performer.id, positionId: null, selfService: false };
        }
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
            `Assignment TASK_STARTER_MANAGER resolved: performer of "${assignment?.sourceTaskName}" ` +
              `${referenceUser}${performer ? '' : ' (source task missing — instance starter)'} → manager ${manager.id} (${manager.name})`,
          );
          return { assigneeId: manager.id, positionId: null, selfService: false };
        }
        // Fallback: route to the first ADMIN so the flow never dead-ends
        const admin = await this.userRep.findFirst({
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
        const admin = await this.userRep.findFirst({
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
   * `taskName` within the given instance.
   */
  private async findTaskPerformer(instanceId: string, taskName?: string | null) {
    if (!taskName) return null;
    const task = await this.taskRep.findFirst({
      where: { processInstanceId: instanceId, name: taskName },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return null;

    if (task.status === 'COMPLETED') {
      const submission = await this.formSubmissionRep.findFirst({
        where: { taskId: task.id },
        orderBy: { submittedAt: 'desc' },
        select: { submittedById: true },
      });
      if (submission) {
        const user = await this.userRep.findUnique({ where: { id: submission.submittedById } });
        if (user) return user;
      }
    }
    if (!task.assigneeId) return null;
    return this.userRep.findUnique({ where: { id: task.assigneeId } });
  }

  /**
   * Find the manager of the given user: user → their position(s) → department(s)
   * → the department's isManager position → the user(s) holding it.
   */
  private async findUserManager(userId: string) {
    const userPositions = await this.userPositionRep.findMany({
      where: { userId },
      include: { position: true },
    });
    const departmentIds = [
      ...new Set(userPositions.items.map((up) => up.position.departmentId)),
    ];
    if (departmentIds.length === 0) return null;

    const managerPositions = await this.positionRep.findMany({
      where: { departmentId: { in: departmentIds }, isManager: true },
    });
    if (managerPositions.items.length === 0) return null;

    const managerLinks = await this.userPositionRep.findMany({
      where: { positionId: { in: managerPositions.items.map((p) => p.id) } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    if (managerLinks.items.length === 0) return null;

    const otherThanSelf = managerLinks.items.find((l) => l.userId !== userId);
    return (otherThanSelf ?? managerLinks.items[0])!.user;
  }

  async processInstanceGetMany(query: GetManyQueryType<'ProcessInstance'>): Promise<GetManyReply<ProcessInstanceDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: [] });
    predicate.orderBy = predicate.orderBy ?? { startedAt: 'desc' };
    const { items, totalCount } = await this.processInstanceRep.findMany({
      ...predicate,
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
    });
    return { items: items as unknown as ProcessInstanceDto[], totalCount };
  }

  /**
   * The user-facing case list (موارد من): every case the user PARTICIPATES
   * in — started by them OR holding a task they own / can still claim.
   * Same privacy model as کارتابل + assertParticipant:
   *   - startedBy me
   *   - OR a task assigned/claimed by me (assigneeId = me)
   *   - OR an UNCLAIMED position-pool task for a position I hold
   * After another holder CLAIMS a self-service position task, peers no
   * longer see that case here (it leaves their candidate pool).
   * Admins see ALL cases.
   */
  async caseGetMany(
    user: { id: string; role?: string },
    query: GetManyQueryType<'ProcessInstance'>,
  ): Promise<GetManyReply<ProcessInstanceDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: [] });
    predicate.orderBy = predicate.orderBy ?? { startedAt: 'desc' };

    if (user.role !== 'ADMIN') {
      const userPositions = await this.userPositionRep.findMany({
        where: { userId: user.id },
        select: { positionId: true },
      });
      const positionIds = userPositions.items.map((up) => up.positionId);
      predicate.where = {
        ...predicate.where,
        OR: [
          { startedById: user.id },
          // Task claimed by / assigned to me
          { tasks: { some: { assigneeId: user.id } } },
          // Unclaimed position-pool task I can still pick up
          ...(positionIds.length > 0
            ? [
                {
                  tasks: {
                    some: { assigneeId: null, positionId: { in: positionIds } },
                  },
                },
              ]
            : []),
        ],
      } as typeof predicate.where;
    }

    const { items, totalCount } = await this.processInstanceRep.findMany({
      ...predicate,
      include: {
        process: { select: { id: true, name: true, version: true } },
        startedBy: { select: { id: true, email: true, name: true } },
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
    });
    return { items: items as unknown as ProcessInstanceDto[], totalCount };
  }

  async processInstanceGetById(id: string, user?: { id: string; role?: string }): Promise<ProcessInstanceDto> {
    const inst = await this.processInstanceRep.findUnique({
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
    return inst as unknown as ProcessInstanceDto;
  }

  /**
   * Same privacy model as the کارتابل: an instance (and the tasks inside it)
   * is visible to the caller only when they participate in it.
   */
  private async assertParticipant(
    inst: { id: string; startedById: string | null },
    user: { id: string; role?: string },
  ): Promise<void> {
    if (user.role === 'ADMIN') return;
    if (inst.startedById === user.id) return;
    const userPositions = await this.userPositionRep.findMany({
      where: { userId: user.id },
      select: { positionId: true },
    });
    const positionIds = userPositions.items.map((up) => up.positionId);
    const participant = await this.taskRep.findFirst({
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
      throw new ForbiddenException('You can only view process instances you participate in');
    }
  }

  async processInstanceGetMine(
    userId: string,
    query: GetManyQueryType<'ProcessInstance'>,
  ): Promise<GetManyReply<ProcessInstanceDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: [] });
    predicate.orderBy = predicate.orderBy ?? { startedAt: 'desc' };
    predicate.where = {
      ...predicate.where,
      OR: [{ startedById: userId }, { tasks: { some: { assigneeId: userId } } }],
    } as typeof predicate.where;
    const { items, totalCount } = await this.processInstanceRep.findMany({
      ...predicate,
      include: {
        process: { select: { id: true, name: true } },
        startedBy: { select: { id: true, email: true, name: true } },
      },
    });
    return { items: items as unknown as ProcessInstanceDto[], totalCount };
  }

  async processInstanceStart(
    dto: ProcessInstanceStartDto,
    user: { id: string; role?: string },
  ): Promise<ProcessInstanceDto> {
    const process = await this.processInstanceRep.prismaClient.process.findUnique({
      where: { id: dto.processId },
      include: {
        assignments: true,
        starters: { select: { userId: true } },
      },
    });
    if (!process) throw new NotFoundException(`Process ${dto.processId} not found`);
    if (process.status !== 'ACTIVE') {
      throw new BadRequestException(`Process must be ACTIVE to start. Current: ${process.status}`);
    }

    // START event assignment — declarative starter restriction. An empty
    // starter set means every user may start; a non-empty set restricts
    // starting to its members (ADMIN always may, so flows never dead-end).
    if (
      process.starters.length > 0 &&
      user.role !== 'ADMIN' &&
      !process.starters.some((s) => s.userId === user.id)
    ) {
      this.logger.warn(
        `User ${user.id} is not allowed to start process ${process.id} (starter restriction: ${process.starters.length} users)`,
      );
      throw new ForbiddenException(
        'شما مجاز به شروع این فرآیند نیستید — شروع آن به کاربران مشخصی محدود شده است',
      );
    }

    // Create instance record
    const instance = await this.processInstanceRep.create({
      data: {
        processId: process.id,
        startedById: user.id,
        status: 'RUNNING',
        bpmnXmlSnapshot: process.bpmnXml,
      },
    });

    const callbacks = this.createCallbacks(instance.id, process.assignments, user.id);

    // Kick off the BPMN engine
    try {
      await this.bpmn.bpmnStartInstance({
        instanceId: instance.id,
        bpmnXml: process.bpmnXml,
        callbacks,
      });
      // Give the engine a moment to fire the first `wait` event and create the initial task.
      await this.waitForFirstTask(instance.id);
    } catch (err: unknown) {
      await this.processInstanceRep.update({
        where: { id: instance.id },
        data: { status: 'FAILED', lastError: (err as Error).message, completedAt: new Date() },
      });
      throw err;
    }

    return this.processInstanceGetById(instance.id, { id: user.id, role: user.role });
  }

  /**
   * Poll for up to 2 seconds until at least one Task row exists for the instance.
   */
  private async waitForFirstTask(instanceId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const count = await this.taskRep.count({ where: { processInstanceId: instanceId } });
      if (count > 0) return;
      // Also check if the instance already completed (e.g. no user tasks at all)
      const inst = await this.processInstanceRep.findUnique({
        where: { id: instanceId },
        select: { status: true },
      });
      if (inst && inst.status !== 'RUNNING') return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.logger.warn(`No task created for instance ${instanceId} after 2s — process may have no user tasks`);
  }

  async processInstanceTerminate(
    id: string,
    user?: { id: string; role?: string },
  ): Promise<ProcessInstanceDto> {
    const inst = await this.processInstanceGetById(id, user);
    if (user && user.role !== 'ADMIN' && inst.startedById !== user.id) {
      throw new ForbiddenException(
        'Only the user who started this instance or an admin can terminate it',
      );
    }
    if (inst.status !== 'RUNNING') {
      throw new BadRequestException(`Instance is not RUNNING (status=${inst.status})`);
    }
    await this.bpmn.bpmnTerminateInstance(id);
    await this.processInstanceRep.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        completedAt: new Date(),
        engineState: null, // clear state
      },
    });
    await this.taskService.taskMarkRemainingCancelled(id);
    return this.processInstanceGetById(id, user);
  }
}
