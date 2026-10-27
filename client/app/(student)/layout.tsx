import { AppShell } from '@/components/student/app-shell';
import { AuthGuard } from '@/features/auth/auth-guard';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
