'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth-provider';
import { Skeleton } from '@/components/ui/skeleton';
import type { Role } from '../types';

/**
 * Role-based authorization primitives for the UI.
 *
 * These are UX gates ONLY — they hide/redirect, they don't secure. The real
 * enforcement is the backend's RolesGuard (403). Keep every role check in
 * the app flowing through these helpers so widening access later is a
 * one-line change (e.g. roles={['ADMIN', 'AUDITOR']}).
 */

/**
 * Logic-level role check — the single source of truth for "can this user
 * act?". Deny by default: an empty roles array lets NOBODY through.
 */
export function useCan(roles: readonly Role[]): boolean {
  const { user } = useAuth();
  return !!user && roles.includes(user.role);
}

/** Declarative sibling of useCan for JSX gating. */
export function Can({
  roles,
  children,
  fallback = null,
}: {
  roles: readonly Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useCan(roles);
  return can ? <>{children}</> : <>{fallback}</>;
}

/** Standard "no access" panel (Persian, matches the app's language). */
function NoAccessPanel({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-96 text-muted-foreground">
      <p>{message ?? 'شما به این بخش دسترسی ندارید'}</p>
    </div>
  );
}

/**
 * Route-level role gate for layouts and pages. Renders children only when
 * the signed-in user holds one of `roles`; otherwise shows the standard
 * no-access panel — or a custom `fallback` for fullscreen/branded states.
 *
 * While auth is still loading it renders nothing: the parent (app) layout
 * owns the splash screen, so no double spinners.
 */
export function RoleGate({
  roles,
  children,
  fallback,
  message,
}: {
  roles: readonly Role[];
  children: ReactNode;
  /** Custom no-access UI (e.g. the fullscreen designer card). */
  fallback?: ReactNode;
  /** Override the standard panel's text. */
  message?: string;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || !roles.includes(user.role)) {
    return <>{fallback ?? <NoAccessPanel message={message} />}</>;
  }
  return <>{children}</>;
}

/**
 * Wraps public-only pages (e.g. /login): already-authenticated visitors are
 * redirected to `redirect` (dashboard by default) instead of seeing the auth
 * form again. Shows the app-wide splash while the session check runs.
 */
export function PublicOnly({
  children,
  redirect = '/dashboard',
}: {
  children: ReactNode;
  redirect?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(redirect);
  }, [loading, user, router, redirect]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
