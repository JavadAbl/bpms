import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessVersionRepository extends Repository<'processVersion'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processVersion', prismaProvider);
  }
}
