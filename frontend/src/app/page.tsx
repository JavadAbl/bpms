import { redirect } from 'next/navigation';

/**
 * Root entry — UI redesign Phase 2 moved all views to URL routes.
 * The authenticated landing page is /dashboard (see src/app/(app)/).
 */
export default function Home() {
  redirect('/dashboard');
}
