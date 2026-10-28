'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from 'sonner';

import { QuestionForm } from '@/components/community/question-form';
import { AuthGuard } from '@/features/auth/auth-guard';
import { communityService } from '@/services/community';

/** Opened from a library document: its filière, matière and title prefill the form. */
function useDefaults() {
  const params = useSearchParams();
  const doc = params.get('doc');
  const url = params.get('url');
  return {
    filiere: params.get('filiere') ?? undefined,
    subject: params.get('subject') ?? undefined,
    body: doc ? `À propos du document « ${doc} »${url ? ` (${url})` : ''} :

` : undefined,
  };
}

function Ask() {
  const router = useRouter();
  const defaults = useDefaults();
  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Poser une question</h1>
        <p className="mt-1 text-sm text-ink-500">
          Une bonne question explique ce que vous avez déjà essayé. Vous aurez une meilleure réponse.
        </p>
        <QuestionForm
          defaults={defaults}
          submitLabel="Publier la question"
          pendingLabel="Publication…"
          cancelHref="/questions"
          onSubmit={async (payload) => {
            const { x_id } = await communityService.ask(payload);
            toast.success('Question publiée. Partagez-la sur WhatsApp pour une réponse plus rapide.');
            router.push(`/questions/${x_id}`);
          }}
        />
      </div>
    </AuthGuard>
  );
}

export default function AskPage() {
  return (
    <Suspense>
      <Ask />
    </Suspense>
  );
}
