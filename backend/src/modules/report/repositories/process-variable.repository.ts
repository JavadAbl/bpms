import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessVariableRepository extends Repository<'processVariable'> {
  constructor(prismaProvider: PrismaProvider) {
    super('processVariable', prismaProvider);
  }
}
