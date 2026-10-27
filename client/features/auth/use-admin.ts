'use client';

import { useAuth } from '@/features/auth/auth-provider';

export const ADMIN_ROLE = 'admin';

/**
 * Whether the signed-in account may see the back-office.
 *
 * This only drives what the UI offers. Every SignManager endpoint re-checks the
 * role server-side, so flipping this in a devtools console buys nothing.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return Boolean(user?.roles?.some((role) => role.name === ADMIN_ROLE));
}
