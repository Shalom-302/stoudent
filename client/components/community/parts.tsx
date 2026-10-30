'use client';

import 'katex/dist/katex.min.css';

import katex from 'katex';
import { ChevronDown, Flag, GraduationCap } from 'lucide-react';
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

/**
 * "👍 Utile" is the vote students recognise; the downvote stays available but
 * discreet. Clicking the active choice withdraws it. Shows the net score.
 */
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

  const liked = state.myVote === 1;
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => void cast(1)}
        disabled={disabled || pending}
        aria-pressed={liked}
        aria-label={`Utile, ${state.score}`}
        title={disabled ? 'Vous ne pouvez pas voter pour votre propre contenu' : 'Cette publication m’a aidé'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          liked ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-900',
        )}
      >
        <span aria-hidden>👍</span> Utile
        <span className={cn('font-semibold', liked ? 'text-white' : 'text-ink-900')}>{state.score}</span>
      </button>
      <button
        type="button"
        onClick={() => void cast(-1)}
        disabled={disabled || pending}
        aria-pressed={state.myVote === -1}
        aria-label="Pas utile"
        title="Pas utile"
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full transition-colors disabled:opacity-40',
          state.myVote === -1 ? 'bg-ink-900 text-white' : 'text-ink-400 hover:bg-ink-50 hover:text-ink-900',
        )}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/** "🙏 Merci" on an answer: gratitude, separate from judging it useful. */
export function ThanksButton({
  answerXId,
  count,
  thanked,
  disabled,
}: {
  answerXId: string;
  count: number;
  thanked: boolean;
  disabled?: boolean;
}) {
  const requireAuth = useRequireAuth();
  const [state, setState] = React.useState({ count, thanked });
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => setState({ count, thanked }), [count, thanked]);

  const toggle = async () => {
    if (!requireAuth() || pending) return;
    setPending(true);
    try {
      const result = await communityService.thank(answerXId);
      setState({ count: result.thanks_count, thanked: result.thanked });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible pour le moment.');
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={disabled || pending}
      aria-pressed={state.thanked}
      title={disabled ? 'C’est votre réponse' : 'Remercier l’auteur'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        state.thanked ? 'border-ink-900 bg-ink-50 text-ink-900' : 'border-ink-200 text-ink-700 hover:border-ink-900',
      )}
    >
      <span aria-hidden>🙏</span> Merci
      {state.count > 0 && <span className="font-semibold text-ink-900">{state.count}</span>}
    </button>
  );
}

/**
 * Opens WhatsApp with the question's title and link, ready to send to a class
 * group, and counts the tap. ``compact`` drops the label for the feed's action bar.
 */
export function ShareWhatsAppButton({
  title,
  questionXId,
  count,
  compact,
}: {
  title: string;
  questionXId: string;
  count: number;
  compact?: boolean;
}) {
  const [shares, setShares] = React.useState(count);
  React.useEffect(() => setShares(count), [count]);

  const share = () => {
    const url = `${window.location.origin}/questions/${questionXId}`;
    const text = `${title}\nQui peut m’aider ? Réponds sur STOUDENT : ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    communityService
      .share(questionXId)
      .then((r) => setShares(r.share_count))
      .catch(() => undefined);
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Partager sur WhatsApp${shares ? `, ${shares} partages` : ''}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-[#25D366] hover:text-[#128C7E]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
      </svg>
      {compact ? <span className="hidden sm:inline">Partager</span> : 'Partager sur WhatsApp'}
      {shares > 0 && <span className="font-semibold text-ink-900">{shares}</span>}
    </button>
  );
}

export function ReportButton({
  targetType,
  targetXId,
}: {
  targetType: 'question' | 'answer' | 'resource' | 'comment';
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

// $$ display $$ first, then $inline$ (no space just inside the dollars, one
// line), so "590 000 F" or a lone "$" in prose stays plain text.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$(?!\s)([^$\n]+?)(?<!\s)\$/g;
const MAX_FORMULA = 500;

/** KaTeX with trust off: it escapes everything it does not typeset itself. */
function Formula({ tex, display }: { tex: string; display: boolean }) {
  const html = React.useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        trust: false,
        strict: 'ignore',
        maxSize: 10,
        maxExpand: 100,
      }),
    [tex, display],
  );
  return display ? (
    <span className="my-2 block overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function WithMath({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MATH_RE)) {
    const tex = match[1] ?? match[2];
    if (tex.length > MAX_FORMULA) continue;
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<Formula key={match.index} tex={tex.trim()} display={match[1] !== undefined} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

/**
 * Post body: paragraphs, ```code``` blocks and $formulas$. User text is only
 * ever rendered as text nodes; the sole HTML injected is KaTeX's own output.
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
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap break-words">
            <WithMath text={part.trim()} />
          </p>
        ) : null,
      )}
    </div>
  );
}
