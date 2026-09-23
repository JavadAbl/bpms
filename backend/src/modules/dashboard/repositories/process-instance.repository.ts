import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessInstanceRepository extends Repository<'processInstance'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processInstance', prismaProvider);
  }

  /** Group instances by status with counts (dashboard aggregate). */
  async processInstanceGroupByStatus(where: Record<string, unknown>) {
    return this.prismaClient.processInstance.groupBy({
      by: ['status'],
      where: where as never,
      _count: { _all: true },
    });
  }
}
