import { AppShell } from '@/components/student/app-shell';
import { AuthGuard } from '@/features/auth/auth-guard';

export default function LabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
