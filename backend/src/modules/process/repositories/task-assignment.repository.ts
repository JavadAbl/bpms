import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class TaskAssignmentRepository extends Repository<'taskAssignment'> {
  constructor(prismaProvider: PrismaProvider) {
    super('taskAssignment', prismaProvider);
  }

  /** Replace ALL task assignments for a process in one transaction. */
  async taskAssignmentReplaceAll(
    processId: string,
    assignments: {
      taskName: string;
      strategy?: string;
      sourceTaskName?: string | null;
      assigneeId?: string | null;
      positionId?: string | null;
      selfService?: boolean;
      formId?: string | null;
    }[],
  ): Promise<void> {
    await this.prismaClient.$transaction([
      this.prismaClient.taskAssignment.deleteMany({ where: { processId } }),
      ...assignments.map((a) =>
        this.prismaClient.taskAssignment.create({
          data: {
            processId,
            taskName: a.taskName,
            strategy: a.strategy || 'FIXED_USER',
            sourceTaskName: a.sourceTaskName || null,
            assigneeId: a.assigneeId || null,
            positionId: a.positionId || null,
            selfService: a.selfService ?? false,
            formId: a.formId || null,
          },
        }),
      ),
    ]);
  }
}
