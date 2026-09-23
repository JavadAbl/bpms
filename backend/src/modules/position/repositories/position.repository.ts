import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class PositionRepository extends Repository<'position'> {
  constructor(prismaProvider: PrismaProvider) {
    super('position', prismaProvider);
  }

  /** Verify the department a position belongs to exists (cross-model read). */
  async positionCheckDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.prismaClient.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException(`Department ${departmentId} not found`);
  }

  /** Verify all given user ids exist; throws with the missing ids otherwise. */
  async positionCheckUsersExist(userIds: string[]): Promise<void> {
    const users = await this.prismaClient.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      const found = users.map((user) => user.id);
      const missing = userIds.filter((id) => !found.includes(id));
      throw new NotFoundException(`Users not found: ${missing.join(', ')}`);
    }
  }
}
