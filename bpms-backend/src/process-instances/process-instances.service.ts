import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
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
        const callbacks = this.createCallbacks(inst.id, inst.process.assignments);
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
  private createCallbacks(instanceId: string, assignments: any[]): EngineCallbacks {
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

        // New task — create in DB
        const assignment = assignments.find((a) => a.taskName === info.name);
        await this.tasks.createWaitingTask({
          instanceId,
          activityId: info.activityId,
          executionId: info.executionId,
          name: info.name,
          description: info.description,
          assigneeId: assignment?.assigneeId || null,
          positionId: assignment?.positionId || null,
          selfService: assignment?.selfService ?? false,
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

  async findAll() {
    return this.prisma.processInstance.findMany({
      include: {
        process: { select: { id: true, name: true, version: true } },
        startedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findOne(id: string) {
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
    return inst;
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

    const callbacks = this.createCallbacks(instance.id, process.assignments);

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

    return this.findOne(instance.id);
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

  async terminate(id: string) {
    const inst = await this.findOne(id);
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
    return this.findOne(id);
  }
}
