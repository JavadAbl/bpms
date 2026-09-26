'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { TaskDetailView } from '@/features/tasks/components/task-detail-view';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { t } from '@/lib/i18n';

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const backHref = '/tasks';
  const backLabel = t.myTasks;

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
