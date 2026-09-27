'use client';

import { ReactNode } from 'react';
import { RoleGate } from '@/features/auth';

/**
 * ADMIN-only area guard (everything under /admin).
 *
 * The role logic lives in RoleGate — widening this area to more roles later
 * is a one-line change (e.g. roles={['ADMIN', 'AUDITOR']}), no copied
 * if-blocks per route.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGate roles={['ADMIN']}>{children}</RoleGate>;
}
