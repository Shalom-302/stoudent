'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { QuestionForm } from '@/components/community/question-form';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthGuard } from '@/features/auth/auth-guard';
import { communityService } from '@/services/community';

function EditQuestion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const question = useQuery({ queryKey: ['community', 'question', id, 'edit'], queryFn: () => communityService.question(id) });

  if (question.isLoading) return <Skeleton className="mt-8 h-96" />;
  if (!question.data?.is_mine) {
    return <p className="mt-8 text-sm text-ink-500">Seul l’auteur peut modifier cette question.</p>;
  }
  const q = question.data;
  return (
    <QuestionForm
      initial={{
        title: q.title,
        body: q.body,
        filiere: q.filiere,
        subject: q.subject ?? undefined,
        tags: q.tags,
        image_url: q.image_url ?? undefined,
      }}
      submitLabel="Enregistrer"
      pendingLabel="Enregistrement…"
      cancelHref={`/questions/${id}`}
      onSubmit={async (payload) => {
        await communityService.editQuestion(id, payload);
        await queryClient.invalidateQueries({ queryKey: ['community', 'question', id] });
        toast.success('Question modifiée.');
        router.push(`/questions/${id}`);
      }}
    />
  );
}

export default function EditQuestionPage() {
  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Modifier ma question</h1>
        <EditQuestion />
      </div>
    </AuthGuard>
  );
}
