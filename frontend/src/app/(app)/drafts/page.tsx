'use client';

import { useRouter } from 'next/navigation';
import { DraftsView } from '@/components/views/drafts-view';

export default function DraftsPage() {
  const router = useRouter();
  return <DraftsView onViewDraft={(id) => router.push(`/drafts/${id}`)} />;
}
