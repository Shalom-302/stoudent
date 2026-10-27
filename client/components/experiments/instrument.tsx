'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InstrumentProps {
  title: string;
  subtitle?: string;
  status?: string;
  busy?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Chrome around a virtual instrument screen.
 *
 * Deliberately sober: the immersion budget is spent in the 3D world, the
 * instrument panel only has to be readable (fiche technique, section 10).
 */
export function Instrument({
  title,
  subtitle,
  status,
  busy,
  actions,
  children,
  className,
}: InstrumentProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-ink-200 bg-white',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {busy && (
            <span
              aria-label="Calcul en cours"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-700"
            />
          )}
          {status && <Badge variant="outline">{status}</Badge>}
          {actions}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

interface ReadoutProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'accent' | 'danger' | 'success';
}

/** A single measured quantity under a trace. */
export function Readout({ label, value, hint, tone = 'default' }: ReadoutProps) {
  const toneClass = {
    default: 'text-ink-900',
    accent: 'text-accent-600',
    danger: 'text-[var(--color-danger)]',
    success: 'text-[var(--color-success)]',
  }[tone];

  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={cn('font-mono text-sm font-medium', toneClass)}>{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function ReadoutGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{children}</dl>
  );
}
