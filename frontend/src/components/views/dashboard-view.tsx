'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  Play,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { dashboardApi, type DashboardData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { formatPersianDate, formatPersianDateOnly } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/loaders';
import { cn } from '@/lib/utils';

/**
 * KPI dashboard landing view (UI redesign Phase 3).
 * Role-aware: ADMIN gets global aggregates, USER gets own-scope numbers —
 * the backend endpoint decides; this view only renders.
 */

// ---------------------------------------------------------------------------
// Theme-aware MD3 token colors for recharts (needs concrete color strings)
// ---------------------------------------------------------------------------
function useTokenColors() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string) => cs.getPropertyValue(name).trim();
      setColors({
        primary: get('--primary') || '#3b5bdb',
        success: get('--success') || '#2e7d32',
        destructive: get('--destructive') || '#ba1a1a',
        muted: get('--muted-foreground') || '#5f5f6b',
        border: get('--border') || '#d9d9e3',
        foreground: get('--foreground') || '#1b1b1f',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);

  return colors;
}

// ---------------------------------------------------------------------------
// Count-up animation (rAF, ease-out cubic)
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = target;
    prev.current = target;
    if (from === to) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// KPI stat card
// ---------------------------------------------------------------------------
function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tint: string;
  href: string;
}) {
  const animated = useCountUp(value);
  return (
    <Link href={href} className="block h-full">
      <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
        <CardContent className="p-5 flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              tint,
            )}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-3xl font-bold tabular-nums leading-none">
              {animated.toLocaleString('fa-IR')}
            </div>
            <div className="text-sm text-muted-foreground mt-1.5 truncate">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status → donut slice metadata (order matters for legend)
// ---------------------------------------------------------------------------
const statusSlices = [
  { key: 'RUNNING', label: t.RUNNING, token: 'primary' as const },
  { key: 'COMPLETED', label: t.COMPLETED, token: 'success' as const },
  { key: 'FAILED', label: t.FAILED, token: 'destructive' as const },
  { key: 'TERMINATED', label: t.TERMINATED, token: 'muted' as const },
];

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function DashboardView({
  onViewTask,
  onViewInstance,
}: {
  onViewTask: (id: string) => void;
  onViewInstance: (id: string) => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const colors = useTokenColors();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await dashboardApi.get();
      setData(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed7dTotal =
    data?.completedLast7Days?.reduce((sum, d) => sum + d.count, 0) ?? 0;

  const donutData = (data ? statusSlices : []).map((s) => ({
    ...s,
    value: data?.instancesByStatus?.[s.key] ?? 0,
    fill: colors ? colors[s.token] : '#888',
  }));
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const barData = (data?.completedLast7Days ?? []).map((d) => ({
    ...d,
    weekday: new Date(d.date + 'T00:00:00').toLocaleDateString('fa-IR', {
      weekday: 'short',
    }),
  }));

  return (
    <div className="space-y-6">
      {/* Welcome header ------------------------------------------------- */}
      <Card className="overflow-hidden">
        <CardContent className="p-8 flex items-center gap-5 relative">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-elev-2">
            <LayoutDashboard className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold">
              {t.welcome}، {user?.name}!
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? t.quickActionsHint : t.quickActionsHint}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={load}
            disabled={loading}
            aria-label={t.refresh}
            title={t.refresh}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </CardContent>
      </Card>

      {/* KPI cards ------------------------------------------------------ */}
      <div className="md-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !data ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              icon={ClipboardList}
              label={t.kpiPendingTasks}
              value={data.myPendingTasks}
              tint="bg-primary-container text-on-primary-container"
              href="/tasks"
            />
            <KpiCard
              icon={Activity}
              label={t.kpiRunningInstances}
              value={data.runningInstances}
              tint="bg-warning/15 text-warning"
              href="/instances"
            />
            <KpiCard
              icon={Workflow}
              label={t.kpiActiveProcesses}
              value={data.activeProcesses}
              tint="bg-secondary text-secondary-foreground"
              href="/processes"
            />
            <KpiCard
              icon={CheckCircle2}
              label={t.kpiCompleted7d}
              value={completed7dTotal}
              tint="bg-success/15 text-success"
              href="/instances"
            />
          </>
        )}
      </div>

      {/* Charts --------------------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* 7-day completed trend */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <h3 className="font-semibold">{t.chartCompletedTrend}</h3>
              <span className="text-xs text-muted-foreground">{t.chartCompletedTrendHint}</span>
            </div>
            {loading || !colors ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : (
              <div dir="ltr" className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke={colors.border}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="weekday"
                      tickLine={false}
                      axisLine={{ stroke: colors.border }}
                      tick={{ fontSize: 11, fill: colors.muted }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: colors.muted }}
                    />
                    <ReTooltip
                      cursor={{ fill: colors.primary, opacity: 0.08 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const raw = payload[0]?.payload as { date: string; count: number };
                        return (
                          <div
                            dir="rtl"
                            className="rounded-lg bg-card shadow-elev-2 border border-border/70 px-3 py-2 text-sm"
                          >
                            <div className="font-medium">
                              {formatPersianDateOnly(raw.date + 'T00:00:00')}
                            </div>
                            <div className="text-muted-foreground text-xs mt-0.5">
                              {label}: {raw.count.toLocaleString('fa-IR')}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={colors.primary}
                      radius={[6, 6, 0, 0]}
                      barSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instances by status donut */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">{t.chartInstancesByStatus}</h3>
            {loading || !colors ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : donutTotal === 0 ? (
              <EmptyState title={t.noInstances} />
            ) : (
              <div className="relative h-[240px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0] as any;
                        return (
                          <div
                            dir="rtl"
                            className="rounded-lg bg-card shadow-elev-2 border border-border/70 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{p?.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              : {Number(p?.value ?? 0).toLocaleString('fa-IR')}
                            </span>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={donutData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {donutData
                        .filter((d) => d.value > 0)
                        .map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* center total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold tabular-nums">
                    {donutTotal.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">{t.total}</span>
                </div>
              </div>
            )}
            {/* legend (always visible — zero rows shown muted) */}
            {!loading && data && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
                {donutData.map((s) => (
                  <div
                    key={s.key}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      s.value === 0 && 'opacity-50',
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.fill }}
                    />
                    <span className="truncate">{s.label}</span>
                    <span className="ms-auto tabular-nums font-medium">
                      {s.value.toLocaleString('fa-IR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent lists ---------------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Recent tasks */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold">{t.recentTasks}</h3>
              <Link
                href="/tasks"
                className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
              >
                {t.viewAll}
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !data || data.recentTasks.length === 0 ? (
              <EmptyState title={t.noRecentTasks} icon={<ClipboardList className="w-8 h-8 opacity-40" />} />
            ) : (
              <ul className="md-stagger divide-y divide-border/60">
                {data.recentTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onViewTask(task.id)}
                      className="state-layer w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-start"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{task.name}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {task.processInstance?.process?.name ?? '—'}
                          {task.assignee ? ` · ${task.assignee.name}` : ''}
                          {' · '}
                          {formatPersianDate(task.createdAt)}
                        </div>
                      </div>
                      <StatusBadge status={task.status} className="shrink-0" />
                      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent instances */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold">{t.recentInstances}</h3>
              <Link
                href="/instances"
                className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
              >
                {t.viewAll}
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !data || data.recentInstances.length === 0 ? (
              <EmptyState
                title={t.noRecentInstances}
                icon={<GitBranch className="w-8 h-8 opacity-40" />}
              />
            ) : (
              <ul className="md-stagger divide-y divide-border/60">
                {data.recentInstances.map((inst) => (
                  <li key={inst.id}>
                    <button
                      type="button"
                      onClick={() => onViewInstance(inst.id)}
                      className="state-layer w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg text-start"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {inst.process?.name ?? '—'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {inst.startedBy?.name ?? '—'}
                          {' · '}
                          {formatPersianDate(inst.startedAt)}
                        </div>
                      </div>
                      <StatusBadge status={inst.status} className="shrink-0" />
                      <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions (carried over from Phase 2 placeholder) ------------- */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t.quickActions}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/tasks">
            <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary-container text-on-primary-container">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <span className="font-medium flex-1 min-w-0 truncate">{t.myTasks}</span>
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/instances?start=1">
            <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-success/15 text-success">
                  <Play className="w-5 h-5" />
                </div>
                <span className="font-medium flex-1 min-w-0 truncate">{t.startInstance}</span>
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/instances">
            <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-warning/15 text-warning">
                  <GitBranch className="w-5 h-5" />
                </div>
                <span className="font-medium flex-1 min-w-0 truncate">{t.instances}</span>
                <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
          {isAdmin ? (
            <Link href="/processes/new/design">
              <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-secondary-foreground">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <span className="font-medium flex-1 min-w-0 truncate">{t.newProcess}</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Link href="/processes">
              <Card className="state-layer h-full transition-shadow hover:shadow-elev-2">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-secondary-foreground">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <span className="font-medium flex-1 min-w-0 truncate">{t.processes}</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>

      {/* Error banner (below everything so KPIs stay visible) ------------- */}
      {error && !loading && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center gap-3">
            <EmptyState title={t.dashboardLoadError} />
            <Button variant="secondary" size="sm" onClick={load} className="shrink-0">
              <RefreshCw className="w-4 h-4" />
              {t.refresh}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
