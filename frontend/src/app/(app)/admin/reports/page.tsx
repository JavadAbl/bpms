'use client';

import { useRouter } from 'next/navigation';
import { ReportsView } from '@/components/views/reports-view';

export default function AdminReportsPage() {
  const router = useRouter();
  return (
    <ReportsView onViewInstance={(id) => router.push(`/instances/${id}`)} />
  );
}
