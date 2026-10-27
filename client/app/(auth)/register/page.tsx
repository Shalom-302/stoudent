import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Créer un compte' };

export default function RegisterPage() {
  // The form reads ?next=, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
