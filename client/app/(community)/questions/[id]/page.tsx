'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, GraduationCap, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import {
  AuthorLine,
  FiliereChip,
  PostBody,
  ReportButton,
  TagChip,
  useRequireAuth,
  VoteControl,
} from '@/components/community/parts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { AnswerDetail, QuestionDetail } from '@/types';

export default function QuestionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const isTeacher = Boolean(user?.roles?.some((r) => r.name === 'teacher' || r.name === 'admin'));

  // The viewer's votes are part of the payload, so the key includes who asks.
  const key = ['community', 'question', id, user?.x_id ?? 'anon'];
  const question = useQuery({ queryKey: key, queryFn: () => communityService.question(id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['community', 'question', id] });

  const [answer, setAnswer] = React.useState('');
  const post = useMutation({
    mutationFn: () => communityService.answer(id, answer.trim()),
    onSuccess: () => {
      setAnswer('');
      toast.success('Réponse publiée. Merci pour votre aide !');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accept = useMutation({
    mutationFn: (answerXId: string) => communityService.accept(id, answerXId),
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const endorse = useMutation({
    mutationFn: (answerXId: string) => communityService.endorse(answerXId),
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => communityService.deleteQuestion(id),
    onSuccess: () => {
      toast.success('Question supprimée.');
      router.push('/questions');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (question.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (question.isError || !question.data) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-xl font-semibold">Question introuvable.</p>
        <p className="mt-1 text-sm text-ink-500">Elle a peut-être été supprimée ou masquée par la modération.</p>
        <Button className="mt-6" asChild>
          <Link href="/questions">Retour au fil</Link>
        </Button>
      </div>
    );
  }

  const q: QuestionDetail = question.data;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/questions" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Toutes les questions
      </Link>

      <article className="mt-4 flex gap-4 sm:gap-6">
        <VoteControl targetType="question" targetXId={q.x_id} score={q.score} myVote={q.my_vote} disabled={q.is_mine} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{q.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FiliereChip filiere={q.filiere} />
            {q.subject && <span className="text-xs text-ink-500">{q.subject}</span>}
            {q.tags.map((t) => (
              <Link key={t} href={`/questions?tag=${encodeURIComponent(t)}`}>
                <TagChip tag={t} />
              </Link>
            ))}
            <span className="text-xs text-ink-400">· {q.view_count} vue{q.view_count > 1 ? 's' : ''}</span>
          </div>
          <div className="mt-5">
            <PostBody text={q.body} />
          </div>
          {q.image_url && (
            <a href={q.image_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 block">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external host */}
              <img
                src={q.image_url}
                alt="Énoncé joint à la question"
                className="max-h-96 rounded-xl border border-ink-200 object-contain"
                referrerPolicy="no-referrer"
              />
            </a>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
            <AuthorLine author={q.author} time={q.created_time} />
            <div className="flex items-center gap-4">
              {q.is_mine && q.answer_count === 0 && (
                <button
                  onClick={() => confirm('Supprimer cette question ?') && remove.mutate()}
                  className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              )}
              {!q.is_mine && <ReportButton targetType="question" targetXId={q.x_id} />}
            </div>
          </div>
        </div>
      </article>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          {q.answers.length} réponse{q.answers.length > 1 ? 's' : ''}
        </h2>
        <ul className="mt-4 space-y-4">
          {q.answers.map((a) => (
            <AnswerItem
              key={a.x_id}
              answer={a}
              canAccept={q.is_mine}
              canEndorse={isTeacher && !a.is_mine}
              onAccept={() => accept.mutate(a.x_id)}
              onEndorse={() => endorse.mutate(a.x_id)}
            />
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-ink-200 p-5">
        <h2 className="font-display text-lg font-semibold">Votre réponse</h2>
        <p className="mt-1 text-sm text-ink-500">
          Expliquez le raisonnement, pas seulement le résultat : c’est ce qui aide vraiment.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!requireAuth()) return;
            if (answer.trim().length < 20) return toast.error('Une réponse fait au moins 20 caractères.');
            post.mutate();
          }}
        >
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={7}
            maxLength={20000}
            placeholder={user ? 'Votre explication…' : 'Connectez-vous pour répondre.'}
            aria-label="Votre réponse"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={post.isPending}>
              {post.isPending ? 'Publication…' : 'Publier ma réponse'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AnswerItem({
  answer: a,
  canAccept,
  canEndorse,
  onAccept,
  onEndorse,
}: {
  answer: AnswerDetail;
  canAccept: boolean;
  canEndorse: boolean;
  onAccept: () => void;
  onEndorse: () => void;
}) {
  return (
    <li
      className={cn(
        'flex gap-4 rounded-2xl border p-5 sm:gap-6',
        a.is_accepted ? 'border-success bg-success/5' : 'border-ink-200',
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <VoteControl targetType="answer" targetXId={a.x_id} score={a.score} myVote={a.my_vote} disabled={a.is_mine} />
        {canAccept ? (
          <button
            onClick={onAccept}
            title={a.is_accepted ? 'Retirer la meilleure réponse' : 'Marquer comme meilleure réponse'}
            aria-pressed={a.is_accepted}
            className={cn(
              'grid h-9 w-9 place-items-center rounded-full border transition-colors',
              a.is_accepted ? 'border-success bg-success text-white' : 'border-ink-200 text-ink-400 hover:border-success hover:text-success',
            )}
          >
            <Check className="h-5 w-5" />
          </button>
        ) : (
          a.is_accepted && (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-success text-white" title="Meilleure réponse">
              <Check className="h-5 w-5" />
            </span>
          )
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap gap-2">
          {a.is_accepted && (
            <span className="rounded-md bg-success px-2 py-0.5 text-[11px] font-semibold text-white">Meilleure réponse</span>
          )}
          {a.teacher_endorsed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              <GraduationCap className="h-3 w-3" /> Validée par un professeur
            </span>
          )}
        </div>
        <PostBody text={a.body} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <AuthorLine author={a.author} time={a.created_time} />
          <div className="flex items-center gap-4">
            {canEndorse && (
              <button onClick={onEndorse} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-ink-900">
                <GraduationCap className="h-3.5 w-3.5" /> {a.teacher_endorsed ? 'Retirer la validation' : 'Valider (prof)'}
              </button>
            )}
            {!a.is_mine && <ReportButton targetType="answer" targetXId={a.x_id} />}
          </div>
        </div>
      </div>
    </li>
  );
}
