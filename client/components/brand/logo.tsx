import { cn } from '@/lib/utils';

/**
 * STOUDENT wordmark: a speech bubble (a question asked) holding a spark (the
 * answer that unblocks it), next to the name.
 */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('grid place-items-center rounded-xl bg-ink-900 text-white', box)}>
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden="true">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M12 6.5v6M9 9.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className={cn(
          'font-display font-bold tracking-tight text-ink-900',
          size === 'lg' ? 'text-2xl' : 'text-lg',
        )}
      >
        STOUDENT
      </span>
    </span>
  );
}
