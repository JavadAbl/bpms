'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * ADMIN-only area guard (UI redesign Phase 2).
 * Non-admins get the same inline "no access" state as before.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null; // parent (app) layout shows the splash

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>شما به این بخش دسترسی ندارید</p>
      </div>
    );
  }

  return <>{children}</>;
}
