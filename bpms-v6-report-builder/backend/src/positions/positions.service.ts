import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePositionDto, UpdatePositionDto, AssignUsersDto } from './dto/position.dto';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.position.findMany({
      include: {
        department: { select: { id: true, name: true } },
        userPositions: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByDepartment(departmentId: string) {
    return this.prisma.position.findMany({
      where: { departmentId },
      include: {
        userPositions: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const pos = await this.prisma.position.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        userPositions: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!pos) throw new NotFoundException(`Position ${id} not found`);
    return pos;
  }

  async create(departmentId: string, dto: CreatePositionDto) {
    // Verify department exists
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException(`Department ${departmentId} not found`);

    // Check uniqueness within department
    const existing = await this.prisma.position.findUnique({
      where: { departmentId_name: { departmentId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Position "${dto.name}" already exists in this department`);

    return this.prisma.position.create({
      data: {
        name: dto.name,
        description: dto.description,
        departmentId,
      },
      include: { department: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdatePositionDto) {
    await this.findOne(id);
    return this.prisma.position.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { department: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.position.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Assign users to a position (adds to existing assignments).
   * Returns the updated position with all holders.
   */
  async assignUsers(positionId: string, dto: AssignUsersDto) {
    await this.findOne(positionId);

    // Verify all users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds } },
      select: { id: true },
    });
    if (users.length !== dto.userIds.length) {
      const found = users.map((u) => u.id);
      const missing = dto.userIds.filter((id) => !found.includes(id));
      throw new NotFoundException(`Users not found: ${missing.join(', ')}`);
    }

    // Create UserPosition records (skip duplicates via unique constraint)
    await this.prisma.$transaction(
      dto.userIds.map((userId) =>
        this.prisma.userPosition.upsert({
          where: { userId_positionId: { userId, positionId } },
          update: {},
          create: { userId, positionId },
        }),
      ),
    );

    return this.findOne(positionId);
  }

  /**
   * Remove a user from a position.
   */
  async removeUser(positionId: string, userId: string) {
    await this.findOne(positionId);
    await this.prisma.userPosition.deleteMany({
      where: { positionId, userId },
    });
    return this.findOne(positionId);
  }

  /**
   * Get all positions held by a user (used by TasksService to find position-based tasks).
   */
  async getPositionIdsForUser(userId: string): Promise<string[]> {
    const userPositions = await this.prisma.userPosition.findMany({
      where: { userId },
      select: { positionId: true },
    });
    return userPositions.map((up) => up.positionId);
  }
}
