import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class ProcessRepository extends Repository<'process'> {
  constructor(prismaProvider: PrismaProvider) {
    super('process', prismaProvider);
  }
}
