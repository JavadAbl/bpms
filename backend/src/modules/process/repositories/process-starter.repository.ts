import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessStarterRepository extends Repository<'processStarter'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processStarter', prismaProvider);
  }

  /** Replace the whole starter set for a process in one transaction. */
  async processStarterReplaceAll(processId: string, userIds: string[]): Promise<void> {
    await this.prismaClient.$transaction([
      this.prismaClient.processStarter.deleteMany({ where: { processId } }),
      ...userIds.map((userId) =>
        this.prismaClient.processStarter.create({
          data: { processId, userId },
        }),
      ),
    ]);
  }
}
