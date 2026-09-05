import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Aggregated, read-only KPI data for the landing dashboard.
 *
 * Scoping mirrors the existing list endpoints exactly:
 *  - ADMIN  → global numbers (all tasks / all instances)
 *  - USER   → own-scope numbers:
 *      tasks      : assigneeId = me OR (positionId ∈ myPositions AND unclaimed)   (= /tasks/mine)
 *      instances  : startedById = me OR tasks.some.assigneeId = me                (= /process-instances/mine)
 *      processes  : ACTIVE count is global (any user can start any active process)
 *
 * No schema changes — pure aggregation over existing tables.
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getFor(userId: string, role: string) {
    const isAdmin = role === 'ADMIN';

    // ---------------------------------------------------------------------
    // Scopes (mirrors tasks.findMine / instances.findByUser)
    // ---------------------------------------------------------------------
    let taskWhere: any = {};
    let instanceWhere: any = {};

    if (!isAdmin) {
      const userPositions = await this.prisma.userPosition.findMany({
        where: { userId },
        select: { positionId: true },
      });
      const positionIds = userPositions.map((up) => up.positionId);

      taskWhere = {
        OR: [
          { assigneeId: userId },
          ...(positionIds.length > 0
            ? [{ positionId: { in: positionIds }, assigneeId: null }]
            : []),
        ],
      };

      instanceWhere = {
        OR: [{ startedById: userId }, { tasks: { some: { assigneeId: userId } } }],
      };
    }

    // Start of "6 days ago" → 7 calendar days including today
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    // ---------------------------------------------------------------------
    // Aggregates (single round-trip batch)
    // ---------------------------------------------------------------------
    const [
      myPendingTasks,
      runningInstances,
      activeProcesses,
      completedRecent,
      statusGroups,
      recentTasks,
      recentInstances,
    ] = await Promise.all([
      this.prisma.task.count({ where: { AND: [taskWhere, { status: 'PENDING' }] } }),

      this.prisma.processInstance.count({
        where: { AND: [instanceWhere, { status: 'RUNNING' }] },
      }),

      this.prisma.process.count({ where: { status: 'ACTIVE' } }),

      // Only completedAt needed — bucketed per-day below
      this.prisma.processInstance.findMany({
        where: { AND: [instanceWhere, { status: 'COMPLETED' }, { completedAt: { gte: since } }] },
        select: { completedAt: true },
      }),

      this.prisma.processInstance.groupBy({
        by: ['status'],
        where: instanceWhere,
        _count: { _all: true },
      }),

      this.prisma.task.findMany({
        where: taskWhere,
        include: {
          assignee: { select: { id: true, email: true, name: true } },
          position: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          processInstance: {
            select: { id: true, status: true, process: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      this.prisma.processInstance.findMany({
        where: instanceWhere,
        include: {
          process: { select: { id: true, name: true } },
          startedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);

    // ---------------------------------------------------------------------
    // 7-day completed series (oldest → newest, zero-filled)
    // ---------------------------------------------------------------------
    const completedLast7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      const count = completedRecent.filter(
        (c) => c.completedAt && c.completedAt >= dayStart && c.completedAt < dayEnd,
      ).length;

      completedLast7Days.push({ date: dayStart.toISOString().slice(0, 10), count });
    }

    // ---------------------------------------------------------------------
    // Instances by status (all four enum values always present)
    // ---------------------------------------------------------------------
    const instancesByStatus: Record<string, number> = {
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      TERMINATED: 0,
    };
    for (const g of statusGroups) {
      instancesByStatus[g.status] = g._count._all;
    }

    return {
      myPendingTasks,
      runningInstances,
      activeProcesses,
      completedLast7Days,
      instancesByStatus,
      recentTasks,
      recentInstances,
    };
  }
}
