import { ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { DepartmentDto } from '../dto/response/department.dto.js';
import { DepartmentCreateDto } from '../dto/request/department-create.dto.js';
import { DepartmentUpdateDto } from '../dto/request/department-update.dto.js';
import { DepartmentRepository } from '../repositories/department.repository.js';

@Injectable()
export class DepartmentService {
  constructor(private readonly departmentRep: DepartmentRepository) {}

  /** Shared include: positions with their holders. */
  private readonly positionsInclude = {
    positions: {
      include: {
        userPositions: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
      orderBy: { name: 'asc' as const },
    },
  };

  async departmentGetMany(query: GetManyQueryType<'Department'>): Promise<GetManyReply<DepartmentDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name'] });
    predicate.orderBy = predicate.orderBy ?? { name: 'asc' };
    const { items, totalCount } = await this.departmentRep.findMany({
      ...predicate,
      include: this.positionsInclude,
    });
    return { items: items.map((item) => plainToInstance(DepartmentDto, item)), totalCount };
  }

  async departmentGetById(id: string): Promise<DepartmentDto> {
    const department = await this.departmentRep.findAndCheckExistsBy(
      { where: { id }, include: this.positionsInclude },
      'id',
      id,
    );
    return plainToInstance(DepartmentDto, department);
  }

  async departmentCreate(payload: DepartmentCreateDto): Promise<string> {
    const { name } = payload;
    await this.departmentRep.checkDuplicateBy(
      { where: { name } },
      'name',
      name,
      'Department name already exists',
    );

    const department = await this.departmentRep.create({
      data: { name: payload.name, description: payload.description },
      include: { positions: true },
    });
    return department.id;
  }

  async departmentUpdate(id: string, payload: DepartmentUpdateDto): Promise<void> {
    const existing = await this.departmentRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    if (payload.name) {
      const duplicate = await this.departmentRep.findUnique({ where: { name: payload.name } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Department name already in use');
      }
    }
    await this.departmentRep.update({
      where: { id },
      data: { name: payload.name ?? existing.name, description: payload.description },
    });
  }

  async departmentDelete(id: string): Promise<void> {
    await this.departmentRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    await this.departmentRep.remove({ where: { id } });
  }
}
