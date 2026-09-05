'use client';

import { useRouter } from 'next/navigation';
import { TasksView } from '@/components/views/tasks-view';

export default function TasksPage() {
  const router = useRouter();
  return <TasksView onViewTask={(id) => router.push(`/tasks/${id}`)} />;
}
