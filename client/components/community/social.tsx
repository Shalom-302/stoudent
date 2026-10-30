'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { ReportButton, useRequireAuth } from '@/components/community/parts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { CommentItem, PostType } from '@/types';

/** Initial in a circle: members have no photo yet, a pseudo is enough to tell them apart. */
export function Avatar({ pseudo, size = 'md' }: { pseudo: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-ink-900 font-semibold uppercase text-white',
        size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-9 w-9 text-sm',
      )}
    >
      {pseudo.trim().charAt(0) || '?'}
    </span>
  );
}

interface LikesInput {
  score: number;
  my_vote: number;
  likers: string[];
  like_count: number;
}

/**
 * The score and "who liked it", kept in step with the viewer's own vote so
 * the line reads "Toi, Awa et 3 autres" right after a tap, without a refetch.
 */
export function useLikes(post: LikesInput) {
  const { user } = useAuth();
  const me = user?.pseudo ?? null;
  const initial = React.useMemo(
    () => ({ score: post.score, myVote: post.my_vote, likers: post.likers, likeCount: post.like_count }),
    [post.score, post.my_vote, post.likers, post.like_count],
  );
  const [state, setState] = React.useState(initial);
  React.useEffect(() => setState(initial), [initial]);

  const onVote = React.useCallback(
    (score: number, myVote: number) =>
      setState((prev) => {
        const was = prev.myVote === 1;
        const is = myVote === 1;
        let likers = prev.likers.filter((name) => name !== me);
        if (is && me) likers = [me, ...likers].slice(0, 3);
        return { score, myVote, likers, likeCount: Math.max(prev.likeCount + Number(is) - Number(was), 0) };
      }),
    [me],
  );
  return { ...state, me, onVote };
}

/** "👍 Toi, Awa et 12 autres trouvent ça utile" — opens the full list. */
export function LikersLine({
  targetType,
  xId,
  likers,
  likeCount,
  me,
}: {
  targetType: PostType;
  xId: string;
  likers: string[];
  likeCount: number;
  me: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  if (likeCount <= 0) return null;

  const names = likers.map((name) => (name === me ? 'Toi' : name));
  const others = likeCount - names.length;
  let who = names.join(', ');
  if (others > 0) who += ` et ${others} autre${others > 1 ? 's' : ''}`;
  else if (names.length > 1) who = `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  const verb = likeCount > 1 ? 'trouvent' : names[0] === 'Toi' ? 'trouves' : 'trouve';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-0 items-center gap-1.5 text-left text-xs text-ink-500 hover:text-ink-900"
      >
        <span aria-hidden>👍</span>
        <span className="truncate">
          <b className="font-semibold text-ink-700">{who || `${likeCount} membre${likeCount > 1 ? 's' : ''}`}</b>{' '}
          {verb} ça utile
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>👍 Ont trouvé ça utile</DialogTitle>
          </DialogHeader>
          {open && <LikersList targetType={targetType} xId={xId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LikersList({ targetType, xId }: { targetType: PostType; xId: string }) {
  const list = useQuery({
    queryKey: ['community', 'likers', targetType, xId],
    queryFn: () => communityService.likers(targetType, xId),
  });
  if (list.isLoading) return <Skeleton className="h-24 w-full" />;
  if (list.isError) return <p className="text-sm text-red-700">{(list.error as Error).message}</p>;
  const data = list.data!;
  return (
    <ul className="-mx-2 max-h-80 overflow-y-auto">
      {data.items.map((a, i) => (
        <li key={`${a.pseudo}-${i}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50">
          <Avatar pseudo={a.pseudo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {a.pseudo}
              {a.is_teacher && <span className="ml-1.5 rounded bg-ink-900 px-1 py-0.5 text-[9px] font-bold uppercase text-white">Prof</span>}
            </p>
            <p className="text-xs text-ink-500">{[a.filiere, a.level].filter(Boolean).join(' · ') || 'Membre'}</p>
          </div>
        </li>
      ))}
      {data.total > data.items.length && (
        <li className="px-2 pt-2 text-xs text-ink-500">et {data.total - data.items.length} autres</li>
      )}
    </ul>
  );
}

/** The "💬 Commenter" pill of an action bar. */
export function CommentToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`Commenter${count ? `, ${count} commentaire${count > 1 ? 's' : ''}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        open ? 'border-ink-900 bg-ink-50 text-ink-900' : 'border-ink-200 text-ink-700 hover:border-ink-900',
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Commenter</span>
      {count > 0 && <span className="font-semibold text-ink-900">{count}</span>}
    </button>
  );
}

/**
 * Short comments under a question or an answer, loaded when opened. Not an
 * answer: no votes, no reputation, 600 characters.
 */
export function CommentsThread({
  targetType,
  xId,
  onCount,
}: {
  targetType: PostType;
  xId: string;
  onCount: (count: number) => void;
}) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const key = ['community', 'comments', targetType, xId, user?.x_id ?? 'anon'];
  const list = useQuery({ queryKey: key, queryFn: () => communityService.comments(targetType, xId) });
  const [draft, setDraft] = React.useState('');

  const setItems = (update: (items: CommentItem[]) => CommentItem[]) =>
    queryClient.setQueryData<{ items: CommentItem[] }>(key, (old) => ({ items: update(old?.items ?? []) }));

  const post = useMutation({
    mutationFn: () => communityService.comment(targetType, xId, draft.trim()),
    onSuccess: (r) => {
      setDraft('');
      setItems((items) => [...items, r.comment]);
      onCount(r.comment_count);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (commentXId: string) => communityService.deleteComment(commentXId),
    onSuccess: (r, commentXId) => {
      setItems((items) => items.filter((c) => c.x_id !== commentXId));
      onCount(r.comment_count);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    if (!requireAuth()) return;
    if (draft.trim().length < 2 || post.isPending) return;
    post.mutate();
  };

  return (
    <div className="mt-3 rounded-xl bg-ink-50/70 p-3">
      {list.isLoading && <Skeleton className="h-10 w-full" />}
      {list.data && list.data.items.length > 0 && (
        <ul className="mb-3 space-y-3">
          {list.data.items.map((c) => (
            <li key={c.x_id} className="flex gap-2.5">
              <Avatar pseudo={c.author.pseudo} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-500">
                  <b className="font-semibold text-ink-900">{c.author.pseudo}</b>
                  {c.author.is_teacher && ' · Prof'}
                  {c.author.filiere && ` · ${c.author.filiere}`} · {timeAgo(c.created_time)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-800">{c.body}</p>
                <div className="mt-1 flex items-center gap-3">
                  {c.is_mine ? (
                    <button
                      type="button"
                      onClick={() => confirm('Supprimer ce commentaire ?') && remove.mutate(c.x_id)}
                      className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden /> Supprimer
                    </button>
                  ) : (
                    <ReportButton targetType="comment" targetXId={c.x_id} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            if (!user) requireAuth();
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line: the chat habit.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={600}
          placeholder={user ? 'Ajouter un commentaire…' : 'Connecte-toi pour commenter'}
          aria-label="Ajouter un commentaire"
          className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus-visible:border-ink-900 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={draft.trim().length < 2 || post.isPending}
          aria-label="Envoyer le commentaire"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-white transition-opacity disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
