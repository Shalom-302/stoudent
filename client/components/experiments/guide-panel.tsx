'use client';

import { ArrowRight, BookOpen, PencilLine } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Guide } from '@/types';

interface GuidePanelProps {
  guide: Guide | null | undefined;
  className?: string;
  dense?: boolean;
}

/**
 * The formula and a fully worked example, available before the student touches
 * anything.
 *
 * A TP is practice, and practice without the formula in hand is guesswork. The
 * student reads the rule, follows one example solved end to end the way a
 * written exercise would be, then reproduces the reasoning at the bench and
 * checks the answer on the instrument.
 */
export function GuidePanel({ guide, className, dense }: GuidePanelProps) {
  if (!guide || (!guide.formula && guide.example.length === 0)) return null;

  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-ink-200 bg-white',
        dense ? 'p-4' : 'p-5',
        className,
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent-600">
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        Rappel de cours
      </h3>

      {guide.formula && (
        <div className="rounded-lg bg-ink-900 px-3.5 py-3">
          <p className="break-words font-mono text-sm leading-relaxed text-white">
            {guide.formula}
          </p>
          {guide.formula_note && (
            <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink-300">
              {guide.formula_note}
            </p>
          )}
        </div>
      )}

      {guide.example.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Exemple résolu
          </p>
          <ol className="space-y-2.5">
            {guide.example.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-ink-800">{step.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-600">
                  {step.text}
                </p>
                {step.result && (
                  <p className="mt-1.5 flex items-start gap-1.5 font-mono text-sm font-medium text-[var(--color-success)]">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="break-words">{step.result}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {guide.your_turn && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2.5 text-sm leading-relaxed text-ink-700">
          <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
          {guide.your_turn}
        </p>
      )}
    </section>
  );
}
