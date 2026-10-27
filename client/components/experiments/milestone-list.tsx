'use client';

import { Check, Circle } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Milestone } from '@/types';

interface MilestoneListProps {
  milestones: Milestone[];
  className?: string;
  /** Compact form for the in-room panel. */
  dense?: boolean;
}

/**
 * What the TP asks the student to actually do, and what they have done.
 *
 * This carries most of the marks: a TP is practice, so the bench state the
 * student reached is what is graded. Each line ticks the moment the bench
 * reaches it and stays ticked - turning a knob back does not undo a
 * manipulation that really happened.
 */
export function MilestoneList({ milestones, className, dense }: MilestoneListProps) {
  if (milestones.length === 0) return null;

  const done = milestones.filter((m) => m.done);
  const earned = done.reduce((sum, m) => sum + m.points, 0);
  const total = milestones.reduce((sum, m) => sum + m.points, 0);
  const percent = total ? Math.round((100 * earned) / total) : 0;

  return (
    <section className={cn('rounded-[var(--radius-card)] border border-ink-200 p-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Manipulation
        </h3>
        <span className="font-mono text-xs text-ink-500">
          {earned} / {total} pts
        </span>
      </div>

      <Progress
        value={percent}
        indicatorClassName={percent === 100 ? 'bg-[var(--color-success)]' : undefined}
      />

      <ul className={cn('mt-3', dense ? 'space-y-1.5' : 'space-y-2')}>
        {milestones.map((milestone) => (
          <li key={milestone.id} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                milestone.done
                  ? 'bg-[var(--color-success)] text-white'
                  : 'border border-ink-300 text-transparent',
              )}
            >
              {milestone.done ? <Check className="h-2.5 w-2.5" /> : <Circle className="h-2 w-2" />}
            </span>
            <span
              className={cn(
                'text-sm leading-relaxed',
                milestone.done ? 'text-ink-500 line-through' : 'text-ink-800',
              )}
            >
              {milestone.label}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-400">
              {milestone.points}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-ink-400">
        Ces points s’obtiennent au banc, pas au questionnaire. Une étape validée le reste.
      </p>
    </section>
  );
}
