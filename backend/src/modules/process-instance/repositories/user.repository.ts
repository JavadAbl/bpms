import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class UserRepository extends Repository<'user'> {
  constructor(prismaProvider: PrismaProvider) {
    super('user', prismaProvider);
  }
}
