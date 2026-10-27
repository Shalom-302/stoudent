'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-provider';

/**
 * Client-side gate for the student area.
 *
 * The access token lives in localStorage, so the server cannot know whether a
 * request is authenticated at render time - the real protection is the API
 * itself, which rejects every unauthenticated call. This guard only spares the
 * student a flash of an empty dashboard.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
          <p className="text-sm text-ink-500">Chargement de votre laboratoire…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
