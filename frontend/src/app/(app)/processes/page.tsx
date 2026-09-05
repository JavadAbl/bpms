'use client';

import { useRouter } from 'next/navigation';
import { ProcessesView } from '@/components/views/processes-view';

export default function ProcessesPage() {
  const router = useRouter();
  return (
    <ProcessesView
      onOpenDesigner={(processId) =>
        router.push(
          processId ? `/processes/${processId}/design` : '/processes/new/design'
        )
      }
    />
  );
}
