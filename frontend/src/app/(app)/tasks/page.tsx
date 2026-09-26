'use client';

import { useRouter } from 'next/navigation';
import { TasksView } from '@/features/tasks/components/tasks-view';

export default function TasksPage() {
  const router = useRouter();
  return <TasksView onViewTask={(id) => router.push(`/tasks/${id}`)} />;
}
