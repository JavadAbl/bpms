import { Injectable } from '@nestjs/common';
import type { DashboardReplyDto } from '../dto/response/dashboard.dto.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { ProcessInstanceRepository } from '../repositories/process-instance.repository.js';
import { ProcessRepository } from '../repositories/process.repository.js';
import { UserPositionRepository } from '../repositories/user-position.repository.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Aggregated, read-only KPI data for the landing dashboard.
 *
 * Scoping mirrors the existing list endpoints exactly:
 *  - ADMIN  → global numbers (all tasks / all instances / all processes)
 *  - USER   → own-scope numbers:
 *      tasks      : assigneeId = me OR (positionId ∈ myPositions AND unclaimed)   (= /tasks/mine)
 *      instances  : startedById = me OR tasks.some.assigneeId = me                (= /process-instances/mine)
 *      processes  : ACTIVE processes the user may START                            (= start-process dialog)
 *                  (empty starter set = everyone; otherwise members only — the
 *                   exact gate ProcessInstanceService.processInstanceStart() enforces)
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly taskRep: TaskRepository,
    private readonly processInstanceRep: ProcessInstanceRepository,
    private readonly processRep: ProcessRepository,
    private readonly userPositionRep: UserPositionRepository,
  ) {}

  async dashboardGet(userId: string, role: string): Promise<DashboardReplyDto> {
    const isAdmin = role === 'ADMIN';

    // ---------------------------------------------------------------------
    // Scopes (mirrors taskGetMine / processInstanceGetMine)
    // ---------------------------------------------------------------------
    let taskWhere: Record<string, unknown> = {};
    let instanceWhere: Record<string, unknown> = {};
    // Non-admins only count ACTIVE processes they are allowed to start:
    // no starter restriction, or they are on the starter list. ADMIN sees
    // the global count (and always bypasses the starter gate at start()).
    let processWhere: Record<string, unknown> = { status: 'ACTIVE' };

    if (!isAdmin) {
      const userPositions = await this.userPositionRep.findMany({
        where: { userId },
        select: { positionId: true },
      });
      const positionIds = userPositions.items.map((up) => up.positionId);

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

      processWhere = {
        status: 'ACTIVE',
        OR: [{ starters: { none: {} } }, { starters: { some: { userId } } }],
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
      this.taskRep.count({ where: { AND: [taskWhere, { status: 'PENDING' }] } as any }),

      this.processInstanceRep.count({
        where: { AND: [instanceWhere, { status: 'RUNNING' }] } as any,
      }),

      this.processRep.count({ where: processWhere as any }),

      // Only completedAt needed — bucketed per-day below
      this.processInstanceRep.findMany({
        where: {
          AND: [instanceWhere, { status: 'COMPLETED' }, { completedAt: { gte: since } }],
        } as any,
        select: { completedAt: true },
      }),

      this.processInstanceRep.processInstanceGroupByStatus(instanceWhere),

      this.taskRep.findMany({
        where: taskWhere as any,
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

      this.processInstanceRep.findMany({
        where: instanceWhere as any,
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

      const count = completedRecent.items.filter(
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
      recentTasks: recentTasks.items as unknown as Record<string, unknown>[],
      recentInstances: recentInstances.items as unknown as Record<string, unknown>[],
    };
  }
}
