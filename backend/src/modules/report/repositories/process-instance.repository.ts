import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessInstanceRepository extends Repository<'processInstance'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processInstance', prismaProvider);
  }
}
