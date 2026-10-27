'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { AppShell } from '@/components/student/app-shell';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/features/auth/auth-guard';
import { useIsAdmin } from '@/features/auth/use-admin';

function AdminOnly({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdmin();

  // A refusal, not a redirect: silently bouncing an authenticated user to the
  // dashboard reads like a bug. The API refuses the data either way.
  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20 text-center sm:px-6">
        <ShieldAlert className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Espace réservé</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          SignManager est accessible aux comptes administrateurs.
        </p>
        <Button variant="outline" asChild className="mt-6">
          <Link href="/dashboard">Retour à MyLab</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>
        <AdminOnly>{children}</AdminOnly>
      </AppShell>
    </AuthGuard>
  );
}
