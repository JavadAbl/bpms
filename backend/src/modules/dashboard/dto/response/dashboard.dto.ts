import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardDayCountDto {
  @ApiProperty({ example: '2026-09-10' })
  date: string;

  @ApiProperty()
  count: number;
}

export class DashboardReplyDto {
  @ApiProperty({ description: 'Pending tasks in the caller scope' })
  myPendingTasks: number;

  @ApiProperty({ description: 'Running instances in the caller scope' })
  runningInstances: number;

  @ApiProperty({ description: 'ACTIVE processes (startable for non-admins)' })
  activeProcesses: number;

  @ApiProperty({ type: [DashboardDayCountDto], description: 'Completed instances per day (7 days)' })
  completedLast7Days: DashboardDayCountDto[];

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Instance counts by status' })
  instancesByStatus: Record<string, number>;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  recentTasks: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  recentInstances: Record<string, unknown>[];
}
