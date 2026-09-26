'use client';

import { useRouter } from 'next/navigation';
import { DraftsView } from '@/features/instances/components/drafts-view';

export default function DraftsPage() {
  const router = useRouter();
  return <DraftsView onViewDraft={(id) => router.push(`/drafts/${id}`)} />;
}
