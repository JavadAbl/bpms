'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { InstancesView } from '@/components/views/instances-view';

export default function InstancesPage() {
  const router = useRouter();
  return (
    <Suspense fallback={null}>
      <InstancesView
        onViewInstance={(id) => router.push(`/instances/${id}`)}
      />
    </Suspense>
  );
}
