import { AuthGuard } from '@/features/auth/auth-guard';

/**
 * The world gets no app chrome: the HUD lives inside the canvas overlay so the
 * 3D view keeps the full viewport.
 */
export default function WorldLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
