'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, ShieldAlert } from 'lucide-react';
import { useReportDetail } from '@/features/reports';
import { ReportBuilder } from '@/features/reports/components/report-builder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/lib/i18n';

/**
 * Report builder — edit mode (/admin/reports/build/[id]).
 * Loads the saved definition, then hands it to the builder. ADMIN-only
 * (guarded by the /admin layout).
 */
export default function ReportBuilderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: report, isPending, error } = useReportDetail(id);

  if (isPending) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-5xl">
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <span className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </span>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {t.noReports}
              </p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'گزارش مورد نظر یافت نشد'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/admin/reports')}>
              {t.back}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ReportBuilder report={report} onBack={() => router.push('/admin/reports')} />;
}
