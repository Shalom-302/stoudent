'use client';

import { useMutation } from '@tanstack/react-query';
import { Check, Eye, GraduationCap, PenLine } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import {
  FiliereChip,
  PostBody,
  ShareWhatsAppButton,
  TagChip,
  ThanksButton,
  useRequireAuth,
  VoteControl,
} from '@/components/community/parts';
import { FormattingHint, PhotoPicker } from '@/components/community/question-form';
import { Avatar, CommentsThread, CommentToggle, LikersLine, useLikes } from '@/components/community/social';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-provider';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { AnswerPreview, CommunityAuthor, QuestionSummary } from '@/types';

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

/** Avatar, pseudo, filière and time: the header of a post, as on a social network. */
function PostHeader({ author, time, children }: { author: CommunityAuthor; time: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar pseudo={author.pseudo} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <b className="font-semibold text-ink-900">{author.pseudo}</b>
          {author.is_teacher && (
            <span className="inline-flex items-center gap-0.5 rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              <GraduationCap className="h-3 w-3" aria-hidden /> Prof
            </span>
          )}
          <span title="Réputation" className="font-mono text-[11px] text-ink-400">
            {author.reputation}
          </span>
        </p>
        <p className="text-xs text-ink-500">
          {[author.filiere, author.level].filter(Boolean).join(' · ')}
          {(author.filiere || author.level) && ' · '}
          {timeAgo(time)}
        </p>
      </div>
      {children}
    </div>
  );
}

/**
 * A question in the feed, Quora style: like, comment, answer and share without
 * leaving the feed, with the best answer already readable underneath.
 */
export function FeedCard({
  question: q,
  onTag,
  onAnswered,
}: {
  question: QuestionSummary;
  onTag: (tag: string) => void;
  onAnswered: () => void;
}) {
  const likes = useLikes(q);
  const [comments, setComments] = React.useState(q.comment_count);
  const [showComments, setShowComments] = React.useState(false);
  const [answering, setAnswering] = React.useState(false);
  const requireAuth = useRequireAuth();
  React.useEffect(() => setComments(q.comment_count), [q.comment_count]);

  const href = `/questions/${q.x_id}`;
  const stats = [
    q.answer_count > 0 && plural(q.answer_count, 'réponse'),
    comments > 0 && plural(comments, 'commentaire'),
    q.share_count > 0 && plural(q.share_count, 'partage'),
  ].filter(Boolean);

  return (
    <article className="rounded-2xl border border-ink-200 bg-white p-4 sm:p-5">
      <PostHeader author={q.author} time={q.created_time}>
        <FiliereChip filiere={q.filiere} />
      </PostHeader>

      <Link href={href} className="mt-3 block font-display text-lg font-semibold leading-snug text-ink-900 hover:underline">
        {q.title}
      </Link>
      <p className="mt-1 line-clamp-3 text-sm text-ink-600">{q.excerpt}</p>
      {q.image_url && (
        <Link href={href} className="mt-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin upload */}
          <img
            src={q.image_url}
            alt="Photo de l’exercice"
            loading="lazy"
            className="max-h-72 w-full rounded-xl border border-ink-100 bg-ink-50 object-contain"
          />
        </Link>
      )}
      {(q.subject || q.tags.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {q.subject && <span className="text-[11px] text-ink-500">{q.subject}</span>}
          {q.tags.map((t) => (
            <TagChip key={t} tag={t} onClick={() => onTag(t)} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <LikersLine targetType="question" xId={q.x_id} likers={likes.likers} likeCount={likes.likeCount} me={likes.me} />
        <p className="ml-auto flex items-center gap-1 text-xs text-ink-400">
          {stats.length > 0 && <span>{stats.join(' · ')} ·</span>}
          <Eye className="h-3 w-3" aria-hidden /> {q.view_count}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <VoteControl
          targetType="question"
          targetXId={q.x_id}
          score={likes.score}
          myVote={likes.myVote}
          disabled={q.is_mine}
          onChange={likes.onVote}
        />
        <CommentToggle count={comments} open={showComments} onClick={() => setShowComments((v) => !v)} />
        {!q.is_mine && (
          <button
            type="button"
            onClick={() => requireAuth() && setAnswering((v) => !v)}
            aria-expanded={answering}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              answering ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-900',
            )}
          >
            <PenLine className="h-4 w-4" aria-hidden /> Répondre
          </button>
        )}
        <ShareWhatsAppButton title={q.title} questionXId={q.x_id} count={q.share_count} compact />
      </div>

      {showComments && <CommentsThread targetType="question" xId={q.x_id} onCount={setComments} />}
      {answering && (
        <AnswerComposer
          questionXId={q.x_id}
          onCancel={() => setAnswering(false)}
          onPosted={() => {
            setAnswering(false);
            onAnswered();
          }}
        />
      )}

      {q.top_answer && <TopAnswer answer={q.top_answer} href={href} answerCount={q.answer_count} />}
      {!q.top_answer && !answering && (
        <p className="mt-3 text-xs text-ink-500">
          Pas encore de réponse.{' '}
          {!q.is_mine && (
            <button
              type="button"
              onClick={() => requireAuth() && setAnswering(true)}
              className="font-semibold text-ink-900 underline underline-offset-4"
            >
              Sois le premier à aider
            </button>
          )}
        </p>
      )}
    </article>
  );
}

/** The answer the question page puts first, readable and actionable from the feed. */
function TopAnswer({ answer: a, href, answerCount }: { answer: AnswerPreview; href: string; answerCount: number }) {
  const likes = useLikes(a);
  const [comments, setComments] = React.useState(a.comment_count);
  const [showComments, setShowComments] = React.useState(false);
  React.useEffect(() => setComments(a.comment_count), [a.comment_count]);

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border-l-4 bg-ink-50/50 p-3 sm:p-4',
        a.is_accepted ? 'border-success' : a.teacher_endorsed ? 'border-ink-900' : 'border-ink-200',
      )}
    >
      <PostHeader author={a.author} time={a.created_time}>
        <div className="flex flex-col items-end gap-1">
          {a.is_accepted && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <Check className="h-3 w-3" aria-hidden /> Meilleure réponse
            </span>
          )}
          {a.teacher_endorsed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <GraduationCap className="h-3 w-3" aria-hidden /> Validée prof
            </span>
          )}
        </div>
      </PostHeader>
      <div className="mt-2 text-sm [&_p]:text-sm">
        <PostBody text={a.excerpt} />
      </div>
      {a.image_url && (
        <Link href={`${href}#answer-${a.x_id}`} className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin upload */}
          <img
            src={a.image_url}
            alt="Photo jointe à la réponse"
            loading="lazy"
            className="max-h-56 rounded-lg border border-ink-100 bg-white object-contain"
          />
        </Link>
      )}
      <Link href={`${href}#answer-${a.x_id}`} className="mt-1 inline-block text-xs font-semibold text-ink-900 underline underline-offset-4">
        {answerCount > 1 ? `Lire la suite · voir les ${answerCount} réponses` : 'Lire la suite'}
      </Link>

      <div className="mt-2">
        <LikersLine targetType="answer" xId={a.x_id} likers={likes.likers} likeCount={likes.likeCount} me={likes.me} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <VoteControl
          targetType="answer"
          targetXId={a.x_id}
          score={likes.score}
          myVote={likes.myVote}
          disabled={a.is_mine}
          onChange={likes.onVote}
        />
        <ThanksButton answerXId={a.x_id} count={a.thanks_count} thanked={a.my_thanks} disabled={a.is_mine} />
        <CommentToggle count={comments} open={showComments} onClick={() => setShowComments((v) => !v)} />
      </div>
      {showComments && <CommentsThread targetType="answer" xId={a.x_id} onCount={setComments} />}
    </div>
  );
}

/** Answer right from the feed; the question page stays the place for long answers. */
export function AnswerComposer({
  questionXId,
  onPosted,
  onCancel,
}: {
  questionXId: string;
  onPosted: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState<string | undefined>();
  const [uploading, setUploading] = React.useState(false);
  const post = useMutation({
    mutationFn: () => communityService.answer(questionXId, body.trim(), imageUrl),
    onSuccess: () => {
      setBody('');
      setImageUrl(undefined);
      toast.success('Réponse publiée. Merci pour ton aide !');
      onPosted();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-ink-200 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (uploading) return toast.info('Patiente, la photo est en cours d’envoi.');
        if (body.trim().length < 20) return toast.error('Une réponse fait au moins 20 caractères.');
        post.mutate();
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={20000}
        autoFocus
        placeholder={user ? 'Explique le raisonnement, pas seulement le résultat…' : 'Connecte-toi pour répondre.'}
        aria-label="Ta réponse"
      />
      <FormattingHint />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PhotoPicker value={imageUrl} onChange={setImageUrl} onUploading={setUploading} compact />
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={post.isPending || uploading}>
            {post.isPending ? 'Publication…' : 'Publier'}
          </Button>
        </div>
      </div>
    </form>
  );
}
