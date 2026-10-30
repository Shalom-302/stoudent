'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import {
  AuthorLine,
  FiliereChip,
  PostBody,
  ReportButton,
  ShareWhatsAppButton,
  TagChip,
  ThanksButton,
  useRequireAuth,
  VoteControl,
} from '@/components/community/parts';
import { FormattingHint } from '@/components/community/question-form';
import { CommentsThread, CommentToggle, LikersLine, useLikes } from '@/components/community/social';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { AnswerDetail, PostType, QuestionDetail } from '@/types';

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

      <article className="mt-4">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{q.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <FiliereChip filiere={q.filiere} />
          {q.subject && <span className="text-xs text-ink-500">{q.subject}</span>}
          {q.tags.map((t) => (
            <Link key={t} href={`/questions?tag=${encodeURIComponent(t)}`}>
              <TagChip tag={t} />
            </Link>
          ))}
          <span className="text-xs text-ink-400">
            · {q.view_count} vue{q.view_count > 1 ? 's' : ''}
            {q.edited && ' · modifiée'}
          </span>
        </div>
        <div className="mt-5">
          <PostBody text={q.body} />
        </div>
        {q.image_url && (
          <a href={q.image_url} target="_blank" rel="noopener noreferrer" className="mt-4 block">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin upload */}
            <img
              src={q.image_url}
              alt="Photo de l’exercice jointe à la question"
              className="max-h-[28rem] rounded-xl border border-ink-200 object-contain"
            />
          </a>
        )}
        <SocialBar targetType="question" post={q} disabled={q.is_mine}>
          <ShareWhatsAppButton title={q.title} questionXId={q.x_id} count={q.share_count} />
        </SocialBar>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <AuthorLine author={q.author} time={q.created_time} />
          <div className="flex items-center gap-4">
            {q.is_mine && (
              <Link
                href={`/questions/${q.x_id}/edit`}
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900"
              >
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </Link>
            )}
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
      </article>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          {q.answers.length} réponse{q.answers.length > 1 ? 's' : ''}
        </h2>
        {q.answers.length === 0 && (
          <p className="mt-2 text-sm text-ink-500">
            Pas encore de réponse. Partagez la question sur WhatsApp à votre classe pour aller plus vite.
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {q.answers.map((a) => (
            <AnswerItem
              key={a.x_id}
              answer={a}
              canAccept={q.is_mine}
              canEndorse={isTeacher && !a.is_mine}
              onAccept={() => accept.mutate(a.x_id)}
              onEndorse={() => endorse.mutate(a.x_id)}
              onChanged={() => void refresh()}
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
          <FormattingHint />
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
  onChanged,
}: {
  answer: AnswerDetail;
  canAccept: boolean;
  canEndorse: boolean;
  onAccept: () => void;
  onEndorse: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(a.body);

  const save = useMutation({
    mutationFn: () => communityService.editAnswer(a.x_id, draft.trim()),
    onSuccess: () => {
      setEditing(false);
      toast.success('Réponse modifiée.');
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => communityService.deleteAnswer(a.x_id),
    onSuccess: () => {
      toast.success('Réponse supprimée.');
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <li
      id={`answer-${a.x_id}`}
      className={cn('scroll-mt-20 rounded-2xl border p-5', a.is_accepted ? 'border-success bg-success/5' : 'border-ink-200')}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {a.is_accepted && (
          <span className="inline-flex items-center gap-1 rounded-md bg-success px-2 py-0.5 text-[11px] font-semibold text-white">
            <Check className="h-3 w-3" /> Meilleure réponse
          </span>
        )}
        {a.teacher_endorsed && (
          <span className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">
            <GraduationCap className="h-3 w-3" /> Validée par un professeur
          </span>
        )}
      </div>

      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim().length < 20) return toast.error('Une réponse fait au moins 20 caractères.');
            save.mutate();
          }}
        >
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} maxLength={20000} aria-label="Modifier la réponse" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <PostBody text={a.body} />
      )}

      <SocialBar targetType="answer" post={a} disabled={a.is_mine}>
        <ThanksButton answerXId={a.x_id} count={a.thanks_count} thanked={a.my_thanks} disabled={a.is_mine} />
        {canAccept && (
          <button
            onClick={onAccept}
            aria-pressed={a.is_accepted}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              a.is_accepted ? 'border-success bg-success text-white' : 'border-ink-200 text-ink-700 hover:border-success hover:text-success',
            )}
          >
            <Check className="h-4 w-4" /> {a.is_accepted ? 'Meilleure réponse' : 'Choisir comme meilleure réponse'}
          </button>
        )}
        {canEndorse && (
          <button
            onClick={onEndorse}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:border-ink-900"
          >
            <GraduationCap className="h-4 w-4" /> {a.teacher_endorsed ? 'Retirer la validation' : 'Valider (prof)'}
          </button>
        )}
      </SocialBar>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <AuthorLine author={a.author} time={a.created_time} />
        <div className="flex items-center gap-4">
          {a.edited && <span className="text-xs text-ink-400">modifiée</span>}
          {a.is_mine && !editing && (
            <>
              <button
                onClick={() => {
                  setDraft(a.body);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900"
              >
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </button>
              <button
                onClick={() => confirm('Supprimer votre réponse ?') && remove.mutate()}
                className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            </>
          )}
          {!a.is_mine && <ReportButton targetType="answer" targetXId={a.x_id} />}
        </div>
      </div>
    </li>
  );
}

/**
 * 👍 Utile, who liked it, 💬 comments, plus the post's own buttons: the same
 * social bar as in the feed.
 */
function SocialBar({
  targetType,
  post,
  disabled,
  children,
}: {
  targetType: PostType;
  post: QuestionDetail | AnswerDetail;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  const likes = useLikes(post);
  const [comments, setComments] = React.useState(post.comment_count);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setComments(post.comment_count), [post.comment_count]);

  return (
    <div className="mt-5">
      <LikersLine targetType={targetType} xId={post.x_id} likers={likes.likers} likeCount={likes.likeCount} me={likes.me} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <VoteControl
          targetType={targetType}
          targetXId={post.x_id}
          score={likes.score}
          myVote={likes.myVote}
          disabled={disabled}
          onChange={likes.onVote}
        />
        <CommentToggle count={comments} open={open} onClick={() => setOpen((v) => !v)} />
        {children}
      </div>
      {open && <CommentsThread targetType={targetType} xId={post.x_id} onCount={setComments} />}
    </div>
  );
}
