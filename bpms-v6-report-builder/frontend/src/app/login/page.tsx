'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoginView } from '@/components/views/login-view';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Public login route. Already-authenticated visitors are bounced to the
 * dashboard; a successful login updates the global auth context which
 * triggers the same redirect.
 */
export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  return <LoginView />;
}
