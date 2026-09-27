'use client';

import { PublicOnly } from '@/features/auth';
import { LoginView } from '@/features/auth/components/login-view';

/**
 * Public login route. PublicOnly bounces already-authenticated visitors to
 * the dashboard; the login form itself lives in the auth slice.
 */
export default function LoginPage() {
  return (
    <PublicOnly>
      <LoginView />
    </PublicOnly>
  );
}
