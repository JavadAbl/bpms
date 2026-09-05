'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { TaskDetailView } from '@/components/views/task-detail-view';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { t } from '@/lib/i18n';

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t.myTasks, href: '/tasks' },
          { label: t.taskDetail },
        ]}
      />
      <TaskDetailView taskId={id} onBack={() => router.push('/tasks')} />
    </>
  );
}
