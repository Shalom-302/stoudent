'use client';

import { ChevronDown, ChevronUp, Flag, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { REPORT_REASONS, timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { CommunityAuthor, ReportReason } from '@/types';

/** Who wrote it, with the filière and the reputation earned. */
export function AuthorLine({ author, time, className }: { author: CommunityAuthor; time: string; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-500', className)}>
      <span className="font-semibold text-ink-900">{author.pseudo}</span>
      {author.is_teacher && (
        <span className="inline-flex items-center gap-1 rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
          <GraduationCap className="h-3 w-3" aria-hidden /> Prof
        </span>
      )}
      <span title="Réputation" className="font-mono text-ink-400">
        {author.reputation}
      </span>
      {author.filiere && <span>· {author.filiere}</span>}
      {author.level && <span>· {author.level}</span>}
      <span>· {timeAgo(time)}</span>
    </p>
  );
}

export function FiliereChip({ filiere }: { filiere: string }) {
  return (
    <span className="rounded-md bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-ink-900">{filiere}</span>
  );
}

export function TagChip({ tag, onClick }: { tag: string; onClick?: () => void }) {
  const className = 'rounded-md bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600';
  if (!onClick) return <span className={className}>#{tag}</span>;
  return (
    <button type="button" onClick={onClick} className={cn(className, 'hover:bg-ink-100 hover:text-ink-900')}>
      #{tag}
    </button>
  );
}

/** Redirects a visitor to the login page instead of failing an action. */
export function useRequireAuth() {
  const { user } = useAuth();
  const router = useRouter();
  return React.useCallback(() => {
    if (user) return true;
    toast.info('Connectez-vous pour participer.');
    router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return false;
  }, [user, router]);
}

/** Up/down arrows around the score. Clicking the active arrow withdraws the vote. */
export function VoteControl({
  targetType,
  targetXId,
  score,
  myVote,
  disabled,
  onChange,
}: {
  targetType: 'question' | 'answer';
  targetXId: string;
  score: number;
  myVote: number;
  disabled?: boolean;
  onChange?: (score: number, myVote: number) => void;
}) {
  const requireAuth = useRequireAuth();
  const [state, setState] = React.useState({ score, myVote });
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setState({ score, myVote }), [score, myVote]);

  const cast = async (direction: 1 | -1) => {
    if (!requireAuth() || pending) return;
    const value = state.myVote === direction ? 0 : direction;
    setPending(true);
    try {
      const result = await communityService.vote(targetType, targetXId, value);
      setState({ score: result.score, myVote: result.my_vote });
      onChange?.(result.score, result.my_vote);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vote impossible.');
    } finally {
      setPending(false);
    }
  };

  const arrow = (active: boolean) =>
    cn(
      'grid h-9 w-9 place-items-center rounded-full border transition-colors disabled:opacity-40',
      active ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-500 hover:border-ink-900 hover:text-ink-900',
    );

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        className={arrow(state.myVote === 1)}
        onClick={() => void cast(1)}
        disabled={disabled || pending}
        aria-label="Vote utile"
        aria-pressed={state.myVote === 1}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span className="font-display text-lg font-semibold" aria-label={`Score ${state.score}`}>
        {state.score}
      </span>
      <button
        type="button"
        className={arrow(state.myVote === -1)}
        onClick={() => void cast(-1)}
        disabled={disabled || pending}
        aria-label="Vote pas utile"
        aria-pressed={state.myVote === -1}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ReportButton({
  targetType,
  targetXId,
}: {
  targetType: 'question' | 'answer' | 'resource';
  targetXId: string;
}) {
  const requireAuth = useRequireAuth();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<ReportReason>('spam');
  const [details, setDetails] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    setPending(true);
    try {
      const result = await communityService.report(targetType, targetXId, reason, details.trim() || undefined);
      toast.success(
        result.hidden ? 'Merci. Ce contenu est masqué en attendant la modération.' : 'Merci, la modération va regarder.',
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signalement impossible.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => requireAuth() && setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-900"
        aria-expanded={open}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Signaler
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold text-ink-900">Pourquoi signaler ?</legend>
            {REPORT_REASONS.filter((r) => r.value !== 'broken_link' || targetType === 'resource').map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="radio"
                  name={`reason-${targetXId}`}
                  className="accent-ink-900"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            placeholder="Précisions (facultatif)"
            className="mt-2 w-full rounded-lg border border-ink-200 p-2 text-sm focus-visible:border-ink-900 focus-visible:outline-none"
            rows={2}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void submit()} disabled={pending}>
              Envoyer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Plain-text body with paragraphs and ```code``` blocks. No HTML is ever
 * interpreted: user content is rendered as text nodes only.
 */
export function PostBody({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink-800">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-ink-900 p-3 font-mono text-[13px] text-white">
            <code>{part.replace(/^\w*\n/, '')}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {part.trim()}
          </p>
        ),
      )}
    </div>
  );
}
