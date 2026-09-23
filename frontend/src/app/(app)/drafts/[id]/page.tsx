'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { DraftDetailView } from '@/components/views/draft-detail-view';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { t } from '@/lib/i18n';

export default function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t.drafts, href: '/drafts' },
          { label: t.draftDetail },
        ]}
      />
      <DraftDetailView draftId={id} onBack={() => router.push('/drafts')} />
    </>
  );
}
