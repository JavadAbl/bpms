'use client';

import { useRouter } from 'next/navigation';
import { ReportBuilder } from '@/features/reports/components/report-builder';

/**
 * Report builder — create mode (/admin/reports/build).
 * ADMIN-only (guarded by the /admin layout).
 */
export default function ReportBuilderCreatePage() {
  const router = useRouter();
  return <ReportBuilder onBack={() => router.push('/admin/reports')} />;
}
