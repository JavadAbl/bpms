import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class CategoryRepository extends Repository<'category'> {
  constructor(prismaProvider: PrismaProvider) {
    super('category', prismaProvider);
  }
}
