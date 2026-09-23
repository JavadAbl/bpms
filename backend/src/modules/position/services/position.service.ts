import { ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { PositionDto } from '../dto/response/position.dto.js';
import { PositionCreateDto } from '../dto/request/position-create.dto.js';
import { PositionUpdateDto } from '../dto/request/position-update.dto.js';
import { PositionAssignUsersDto } from '../dto/request/position-assign-users.dto.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { UserPositionRepository } from '../repositories/user-position.repository.js';

@Injectable()
export class PositionService {
  constructor(
    private readonly positionRep: PositionRepository,
    private readonly userPositionRep: UserPositionRepository,
  ) {}

  private readonly detailInclude = {
    department: { select: { id: true, name: true } },
    userPositions: {
      include: { user: { select: { id: true, email: true, name: true } } },
    },
  };

  async positionGetMany(query: GetManyQueryType<'Position'>): Promise<GetManyReply<PositionDto>> {
    const predicate = buildFindManyArgs(query, { searchableFields: ['name'] });
    predicate.orderBy = predicate.orderBy ?? { name: 'asc' };
    const { items, totalCount } = await this.positionRep.findMany({
      ...predicate,
      include: this.detailInclude,
    });
    return { items: items.map((item) => plainToInstance(PositionDto, item)), totalCount };
  }

  async positionGetByDepartment(departmentId: string): Promise<PositionDto[]> {
    const positions = await this.positionRep.findMany({
      where: { departmentId },
      include: this.detailInclude,
      orderBy: { name: 'asc' },
    });
    return positions.items.map((item) => plainToInstance(PositionDto, item));
  }

  async positionGetById(id: string): Promise<PositionDto> {
    const position = await this.positionRep.findAndCheckExistsBy(
      { where: { id }, include: this.detailInclude },
      'id',
      id,
    );
    return plainToInstance(PositionDto, position);
  }

  async positionCreate(departmentId: string, payload: PositionCreateDto): Promise<string> {
    // Verify department exists
    await this.positionRep.positionCheckDepartmentExists(departmentId);

    // Check uniqueness within department
    const existing = await this.positionRep.findUnique({
      where: { departmentId_name: { departmentId, name: payload.name } },
    });
    if (existing) {
      throw new ConflictException(`Position "${payload.name}" already exists in this department`);
    }

    const position = await this.positionRep.create({
      data: {
        name: payload.name,
        description: payload.description,
        departmentId,
      },
      include: { department: { select: { id: true, name: true } } },
    });
    return position.id;
  }

  async positionUpdate(id: string, payload: PositionUpdateDto): Promise<void> {
    const existing = await this.positionRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    await this.positionRep.update({
      where: { id },
      data: { name: payload.name ?? existing.name, description: payload.description },
    });
  }

  async positionDelete(id: string): Promise<void> {
    await this.positionRep.findAndCheckExistsBy({ where: { id } }, 'id', id);
    await this.positionRep.remove({ where: { id } });
  }

  /**
   * Assign users to a position (adds to existing assignments).
   */
  async positionAssignUsers(positionId: string, payload: PositionAssignUsersDto): Promise<PositionDto> {
    await this.positionGetById(positionId);

    // Verify all users exist
    await this.positionRep.positionCheckUsersExist(payload.userIds);

    await this.userPositionRep.userPositionAssignUsers(payload.userIds, positionId);

    return this.positionGetById(positionId);
  }

  /** Remove a user from a position. */
  async positionRemoveUser(positionId: string, userId: string): Promise<PositionDto> {
    await this.positionGetById(positionId);
    await this.userPositionRep.userPositionRemoveUser(positionId, userId);
    return this.positionGetById(positionId);
  }
}
