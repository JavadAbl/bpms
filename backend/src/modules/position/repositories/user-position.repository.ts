import { Injectable } from '@nestjs/common';
import { Repository } from '#common/infrastructure/database/base.repository.js';
import { PrismaProvider } from '#common/infrastructure/database/prisma.provider.js';

@Injectable()
export class UserPositionRepository extends Repository<'userPosition'> {
  constructor(prismaProvider: PrismaProvider) {
    super('userPosition', prismaProvider);
  }

  /** Assign users to a position (upsert — skips already-assigned users atomically). */
  async userPositionAssignUsers(userIds: string[], positionId: string): Promise<void> {
    await this.prismaClient.$transaction(
      userIds.map((userId) =>
        this.prismaClient.userPosition.upsert({
          where: { userId_positionId: { userId, positionId } },
          update: {},
          create: { userId, positionId },
        }),
      ),
    );
  }

  /** Remove a user from a position. */
  async userPositionRemoveUser(positionId: string, userId: string): Promise<void> {
    await this.prismaClient.userPosition.deleteMany({ where: { positionId, userId } });
  }
}
