import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class UserPositionRepository extends Repository<'userPosition'> {
  constructor(prismaProvider: PrismaProvider) {
    super('userPosition', prismaProvider);
  }
}
