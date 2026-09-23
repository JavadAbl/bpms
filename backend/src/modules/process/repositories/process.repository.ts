import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessRepository extends Repository<'process'> {
  constructor(prismaProvider: PrismaProvider) {
    super('process', prismaProvider);
  }

  /**
   * Restore an old version: its XML becomes the CURRENT one by appending a NEW
   * version row (current.version + 1) — history stays immutable. Runs in one
   * transaction.
   */
  async processRestoreVersion(opts: {
    processId: string;
    nextVersion: number;
    bpmnXml: string;
    createdById: string;
    note?: string;
    startersInclude: object;
  }) {
    return this.prismaClient.$transaction(async (tx) => {
      await tx.processVersion.create({
        data: {
          processId: opts.processId,
          version: opts.nextVersion,
          bpmnXml: opts.bpmnXml,
          createdById: opts.createdById,
          note: opts.note || null,
        },
      });
      return tx.process.update({
        where: { id: opts.processId },
        data: { bpmnXml: opts.bpmnXml, version: opts.nextVersion },
        include: opts.startersInclude as never,
      });
    });
  }
}
