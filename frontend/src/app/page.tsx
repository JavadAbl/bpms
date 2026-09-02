'use client';

import { AuthProvider, useAuth } from '@/lib/auth';
import { LoginView } from '@/components/views/login-view';
import { AppShell } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <AppShell />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
