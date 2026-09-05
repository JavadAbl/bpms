'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';

/**
 * App-wide client providers that must live above every route
 * (UI redesign Phase 2 — auth state now survives route changes).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
