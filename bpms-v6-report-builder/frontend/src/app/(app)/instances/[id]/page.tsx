'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { InstanceDetailView } from '@/components/views/instance-detail-view';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { t } from '@/lib/i18n';

export default function InstanceDetailPage({
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
          { label: t.instances, href: '/instances' },
          { label: t.instanceDetail },
        ]}
      />
      <InstanceDetailView
        instanceId={id}
        onBack={() => router.push('/instances')}
      />
    </>
  );
}
