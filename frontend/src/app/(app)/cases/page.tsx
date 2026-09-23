'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { CasesView } from '@/components/views/cases-view';

/**
 * پرونده‌ها — the single case list (merged instances report + participated
 * history). Every case the user participates in (started by them / has any
 * task in it); admins see ALL cases. Replaces the old /instances route.
 */
export default function CasesPage() {
  const router = useRouter();
  return (
    <Suspense fallback={null}>
      <CasesView onViewInstance={(id) => router.push(`/cases/${id}`)} />
    </Suspense>
  );
}
