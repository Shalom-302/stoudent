'use client';

import { ArrowLeft, Clock, Save, Zap } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ExperimentDetail } from '@/types';

interface ExperimentShellProps {
  experiment: ExperimentDetail;
  saving?: boolean;
  bench: React.ReactNode;
  instructions: React.ReactNode;
  questions: React.ReactNode;
  theory: React.ReactNode;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

/**
 * Three-column bench layout: what to do, what to manipulate, what to answer.
 *
 * On narrow screens the columns stack in that same order, so a tablet user
 * still reads the instruction before meeting the instrument.
 */
export function ExperimentShell({
  experiment,
  saving,
  bench,
  instructions,
  questions,
  theory,
}: ExperimentShellProps) {
  const labHref = experiment.lab_slug === 'telecom-lab' ? '/labs/telecom' : '/labs/signal';

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
          <Link href={labHref}>
            <ArrowLeft className="h-4 w-4" />
            Retour au laboratoire
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              {experiment.title}
            </h1>
            {experiment.description && (
              <p className="mt-1 max-w-2xl text-sm text-ink-500">{experiment.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-ink-400">
                <Save className="h-3.5 w-3.5" />
                Sauvegarde…
              </span>
            )}
            <Badge variant="outline">
              {DIFFICULTY_LABELS[experiment.difficulty] ?? experiment.difficulty}
            </Badge>
            <Badge variant="outline">
              <Clock className="h-3 w-3" />
              {experiment.duration_minutes} min
            </Badge>
            <Badge variant="accent">
              <Zap className="h-3 w-3" />
              {experiment.xp_reward} XP
            </Badge>
          </div>
        </div>

        {experiment.best_score > 0 && (
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
              <span>Meilleur score</span>
              <span className="font-mono">{experiment.best_score} / 100</span>
            </div>
            <Progress value={experiment.best_score} />
          </div>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,340px)]">
        <aside className="order-1 min-w-0 xl:order-none">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Protocole
          </h2>
          {instructions}
        </aside>

        <main className="order-2 min-w-0 space-y-4 xl:order-none">{bench}</main>

        <aside className="order-3 min-w-0 space-y-4 xl:order-none">
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Validation
            </h2>
            {questions}
          </div>
          {theory}
        </aside>
      </div>
    </div>
  );
}
