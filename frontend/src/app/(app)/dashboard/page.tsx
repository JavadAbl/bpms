'use client';

import { useRouter } from 'next/navigation';
import { DashboardView } from '@/components/views/dashboard-view';

/**
 * Dashboard landing (UI redesign Phase 3) — thin wrapper delegating to
 * DashboardView with URL navigation callbacks.
 */
export default function DashboardPage() {
  const router = useRouter();
  return (
    <DashboardView
      onViewTask={(id) => router.push(`/tasks/${id}`)}
      onViewInstance={(id) => router.push(`/instances/${id}`)}
    />
  );
}
