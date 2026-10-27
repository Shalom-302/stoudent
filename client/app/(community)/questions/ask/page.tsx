'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { QuestionForm } from '@/components/community/question-form';
import { AuthGuard } from '@/features/auth/auth-guard';
import { communityService } from '@/services/community';

export default function AskPage() {
  const router = useRouter();
  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Poser une question</h1>
        <p className="mt-1 text-sm text-ink-500">
          Une bonne question explique ce que vous avez déjà essayé. Vous aurez une meilleure réponse.
        </p>
        <QuestionForm
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
