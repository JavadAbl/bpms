import { apiFetch } from './client';

/** Aggregated KPIs — ADMIN global / USER own scope (backend decides). */
export interface DashboardData {
  myPendingTasks: number;
  runningInstances: number;
  activeProcesses: number;
  completedLast7Days: { date: string; count: number }[];
  instancesByStatus: Record<string, number>;
  recentTasks: any[];
  recentInstances: any[];
}

export const dashboardApi = {
  get: () => apiFetch<DashboardData>('/dashboard'),
};
