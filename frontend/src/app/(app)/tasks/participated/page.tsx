'use client';

import { useRouter } from 'next/navigation';
import { ParticipatedTasksView } from '@/components/views/participated-tasks-view';

/**
 * سوابق کارتابل — participated tasks (v4).
 *
 * Route note: this static segment takes precedence over the dynamic
 * /tasks/[id] route, so "participated" is never mistaken for a task id.
 * Rows deep-link to the read-only task detail with ?from=participated so
 * the breadcrumb/back button returns here instead of the pending inbox.
 */
export default function ParticipatedTasksPage() {
  const router = useRouter();
  return (
    <ParticipatedTasksView
      onViewTask={(id) => router.push(`/tasks/${id}?from=participated`)}
    />
  );
}
