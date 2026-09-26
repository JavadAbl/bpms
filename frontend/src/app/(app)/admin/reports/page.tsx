'use client';

import { useRouter } from 'next/navigation';
import { ReportsView } from '@/features/reports/components/reports-view';

export default function AdminReportsPage() {
  const router = useRouter();
  return (
    <ReportsView
      onViewInstance={(id) => router.push(`/cases/${id}`)}
      onBuild={(reportId) => router.push(reportId ? `/admin/reports/build/${reportId}` : '/admin/reports/build')}
    />
  );
}
