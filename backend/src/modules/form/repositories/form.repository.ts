import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class FormRepository extends Repository<'form'> {
  constructor(prismaProvider: PrismaProvider) {
    super('form', prismaProvider);
  }
}
