import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessVariableRepository extends Repository<'processVariable'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processVariable', prismaProvider);
  }

  /** Replace the whole variable list for a process in one transaction. */
  async processVariableReplaceAll(
    processId: string,
    variables: { name: string; label?: string; type?: string }[],
  ): Promise<void> {
    await this.prismaClient.$transaction([
      this.prismaClient.processVariable.deleteMany({ where: { processId } }),
      ...variables.map((v) =>
        this.prismaClient.processVariable.create({
          data: {
            processId,
            name: v.name,
            label: v.label || null,
            type: v.type || 'text',
          },
        }),
      ),
    ]);
  }
}
