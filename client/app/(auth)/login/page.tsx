import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  // The form reads ?next=, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
