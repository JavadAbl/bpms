'use client';

import { useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/shell/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Authenticated area (UI redesign Phase 2).
 * Guards every (app) route: unauthenticated visitors are redirected to
 * /login. The BPMN designer route renders fullscreen without the shell.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Fullscreen designer — no app bar / sidebar
  const isDesignerFullscreen = /^\/processes\/[^/]+\/design$/.test(pathname);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  if (isDesignerFullscreen) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
