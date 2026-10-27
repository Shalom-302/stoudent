'use client';

import { CheckCircle2, Clock, Lock, PlayCircle, Zap } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExperimentSummary } from '@/types';

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

export function ExperimentCard({ experiment }: { experiment: ExperimentSummary }) {
  const done = experiment.status === 'completed';
  const started = experiment.status === 'in_progress';
  const locked = experiment.is_locked;

  const body = (
    <article
      className={cn(
        'h-full rounded-[var(--radius-card)] border p-4 transition-colors',
        locked
          ? 'border-ink-200 bg-ink-50'
          : 'border-ink-200 bg-white hover:border-ink-400',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              'truncate text-sm font-semibold',
              locked ? 'text-ink-400' : 'text-ink-900',
            )}
          >
            {experiment.title}
          </h3>
          {experiment.description && (
            <p className="mt-1 line-clamp-2 text-sm text-ink-500">{experiment.description}</p>
          )}
        </div>
        <span aria-hidden className="shrink-0">
          {locked ? (
            <Lock className="h-4 w-4 text-ink-300" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
          ) : (
            <PlayCircle className="h-4 w-4 text-accent-500" />
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">
          {DIFFICULTY_LABELS[experiment.difficulty] ?? experiment.difficulty}
        </Badge>
        <Badge variant="outline">
          <Clock className="h-3 w-3" />
          {experiment.duration_minutes} min
        </Badge>
        <Badge variant={done ? 'success' : 'accent'}>
          <Zap className="h-3 w-3" />
          {experiment.xp_reward} XP
        </Badge>
      </div>

      {(done || started) && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
            <span>{done ? 'Validé' : 'En cours'}</span>
            <span className="font-mono">
              {done ? `${experiment.best_score} / 100` : `${experiment.progress} %`}
            </span>
          </div>
          <Progress
            value={done ? experiment.best_score : experiment.progress}
            indicatorClassName={done ? 'bg-[var(--color-success)]' : undefined}
          />
        </div>
      )}

      {locked && (
        <p className="mt-3 text-xs text-ink-400">
          Terminez l’expérience précédente pour débloquer celle-ci.
        </p>
      )}
    </article>
  );

  if (locked) {
    return <div aria-disabled>{body}</div>;
  }

  return (
    <Link
      href={`/labs/signal/${experiment.slug}`}
      className="block h-full rounded-[var(--radius-card)]"
    >
      {body}
    </Link>
  );
}
