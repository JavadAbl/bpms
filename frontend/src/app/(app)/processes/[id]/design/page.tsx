'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGate } from '@/features/auth';
import { ProcessDesignerView } from '@/features/processes/components/process-designer-view';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

/**
 * Fullscreen BPMN designer (no shell chrome).
 * `/processes/new/design` opens the designer in "create new process" mode.
 * ADMIN-only guard (UI redesign Phase 7): the designer's parallel loads hit
 * admin-only endpoints, so non-admin users get an inline access-denied state
 * instead of a broken designer. Role logic lives in RoleGate.
 */
export default function ProcessDesignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <RoleGate
      roles={['ADMIN']}
      fallback={<DesignerNoAccess onBack={() => router.push('/dashboard')} />}
    >
      <ProcessDesignerView
        processId={id === 'new' ? undefined : id}
        onBack={() => router.push('/processes')}
      />
    </RoleGate>
  );
}

/** Branded fullscreen "no access" card for the designer route. */
function DesignerNoAccess({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm rounded-[28px] border border-border/60 bg-card p-8 text-center shadow-elev-2">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="text-lg font-bold">دسترسی نامعتبر</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          شما به طراحی فرآیند دسترسی ندارید
        </p>
        <Button variant="secondary" className="mt-6" onClick={onBack}>
          بازگشت به داشبورد
        </Button>
      </div>
    </div>
  );
}
