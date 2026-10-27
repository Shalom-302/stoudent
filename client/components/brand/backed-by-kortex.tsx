import { cn } from '@/lib/utils';

/** "Backed by Kortex" mark. The SVG wordmark is black: `onDark` inverts it. */
export function BackedByKortex({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', onDark ? 'text-white/60' : 'text-ink-500', className)}>
      Backed by
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG wordmark */}
      <img src="/kortex-logo.svg" alt="Kortex" className={cn('h-5 w-auto', onDark && 'invert')} />
    </span>
  );
}
