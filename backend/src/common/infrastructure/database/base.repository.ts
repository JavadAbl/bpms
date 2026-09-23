import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaProvider } from './prisma.provider.js';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

export class Repository<TModel extends keyof PrismaClient> {
  constructor(
    private readonly model: TModel,
    private readonly prismaProvider: PrismaProvider,
  ) {}

  private get entityName(): string {
    return String(this.model);
  }

  get prismaClient() {
    return this.prismaProvider;
  }

  // --- READ ---

  async findMany<TArgs extends Prisma.Args<(typeof this.prismaProvider)[TModel], 'findMany'>>(
    args?: TArgs,
  ): Promise<{
    items: Prisma.Result<PrismaClient[TModel], TArgs, 'findMany'>;
    totalCount: number;
  }> /* : Promise<GetManyReply<Prisma.Result<(typeof this.prismaProvider)[TModel], TArgs, 'findMany'>>> */ {
    const [items, totalCount] = await Promise.all([
      (this.prismaProvider[this.model] as any).findMany(args),
      (this.prismaProvider[this.model] as any).count({ where: args?.where }),
    ]);

    return { totalCount, items };
  }


  async findUnique<TArgs extends Prisma.Args<PrismaClient[TModel], 'findUnique'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'findUnique'> | null> {
    return await (this.prismaProvider[this.model] as any).findUnique(args);
  }

  async findFirst<TArgs extends Prisma.Args<PrismaClient[TModel], 'findFirst'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'findFirst'> | null> {
    return await (this.prismaProvider[this.model] as any).findFirst(args);
  }

  async findBy<TArgs extends Prisma.Args<PrismaClient[TModel], 'findFirst'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'findFirst'> | null> {
    return await this.findFirst(args);
  }

  async findAndCheckExistsBy<TArgs extends Prisma.Args<PrismaClient[TModel], 'findFirst'>>(
    args: TArgs,
    fieldName: string | null,
    value: any,
    customMessage?: string,
  ): Promise<NonNullable<Prisma.Result<PrismaClient[TModel], TArgs, 'findFirst'>>> {
    const entity = await (this.prismaProvider[this.model] as any).findFirst(args);
    if (!entity) {
      throw new NotFoundException(
        customMessage ? customMessage : `${this.entityName} ${fieldName} with value ${value} not found`,
      );
    }
    return entity;
  }

  async checkDuplicateBy<TArgs extends Prisma.Args<PrismaClient[TModel], 'findFirst'>>(
    args: TArgs,
    fieldName: string | null,
    value: any,
    customMessage?: string,
  ): Promise<void> {
    const entity = await (this.prismaProvider[this.model] as any).findFirst(args);
    if (entity)
      throw new ConflictException(
        customMessage ? customMessage : `${this.entityName} ${fieldName} with value ${value} already exists`,
      );
  }

  // --- WRITE ---

  async create<TArgs extends Prisma.Args<PrismaClient[TModel], 'create'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'create'>> {
    return await (this.prismaProvider[this.model] as any).create(args);
  }

  async update<TArgs extends Prisma.Args<PrismaClient[TModel], 'update'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'update'>> {
    return await (this.prismaProvider[this.model] as any).update(args);
  }

  async updateMany<TArgs extends Prisma.Args<PrismaClient[TModel], 'updateMany'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'updateMany'>> {
    return await (this.prismaProvider[this.model] as any).updateMany(args);
  }

  async upsert<TArgs extends Prisma.Args<PrismaClient[TModel], 'upsert'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'upsert'>> {
    return await (this.prismaProvider[this.model] as any).upsert(args);
  }

  // 'delete' is a reserved keyword in JS/TS, so we use 'remove' or 'deleteOne'
  async remove<TArgs extends Prisma.Args<PrismaClient[TModel], 'delete'>>(
    args: TArgs,
  ): Promise<Prisma.Result<PrismaClient[TModel], TArgs, 'delete'>> {
    return await (this.prismaProvider[this.model] as any).delete(args);
  }

  async count<TArgs extends Prisma.Args<PrismaClient[TModel], 'count'>>(args?: TArgs): Promise<number> {
    return await (this.prismaProvider[this.model] as any).count(args);
  }
}
