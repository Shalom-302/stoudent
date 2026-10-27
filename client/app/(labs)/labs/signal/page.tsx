'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes } from 'lucide-react';
import Link from 'next/link';

import { ExperimentCard } from '@/components/labs/experiment-card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { labService } from '@/services/labs';

const SLUG = 'signal-lab';

export default function SignalLabPage() {
  const lab = useQuery({ queryKey: ['lab', SLUG], queryFn: () => labService.detail(SLUG) });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
        <Link href="/labs">
          <ArrowLeft className="h-4 w-4" />
          Tous les laboratoires
        </Link>
      </Button>

      {lab.isLoading || !lab.data ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
                {lab.data.name}
              </h1>
              {lab.data.description && (
                <p className="mt-1 max-w-2xl text-sm text-ink-500">{lab.data.description}</p>
              )}
            </div>
            <Button variant="outline" asChild>
              <Link href="/world">
                <Boxes className="h-4 w-4" />
                Vue 3D
              </Link>
            </Button>
          </header>

          <div className="mt-5 max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
              <span>
                {lab.data.completed_experiments} / {lab.data.total_experiments} expériences
                validées
              </span>
              <span className="font-mono">{lab.data.progress_percent} %</span>
            </div>
            <Progress value={lab.data.progress_percent} />
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Parcours</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {lab.data.experiments.map((experiment) => (
                <ExperimentCard key={experiment.slug} experiment={experiment} />
              ))}
            </div>
            {lab.data.experiments.length === 0 && (
              <p className="text-sm text-ink-500">
                Aucune expérience publiée. Lancez{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs">
                  shaapi exec seed-labs
                </code>{' '}
                côté backend.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
