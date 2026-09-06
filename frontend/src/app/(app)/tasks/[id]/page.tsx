'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { TaskDetailView } from '@/components/views/task-detail-view';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { t } from '@/lib/i18n';

export default function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = use(params);
  const sp = use(
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  );
  const router = useRouter();

  // Deep-links from the سوابق کارتابل (participated) view carry
  // ?from=participated so the breadcrumb/back button returns there
  // instead of the pending inbox.
  const fromParticipated = sp?.from === 'participated';
  const backHref = fromParticipated ? '/tasks/participated' : '/tasks';
  const backLabel = fromParticipated ? t.participatedTasks : t.myTasks;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: backLabel, href: backHref },
          { label: t.taskDetail },
        ]}
      />
      <TaskDetailView taskId={id} onBack={() => router.push(backHref)} />
    </>
  );
}
