'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Boxes, CheckCircle2, Target } from 'lucide-react';
import Link from 'next/link';

import { LabCard } from '@/components/labs/lab-card';
import { LevelCard, StatCard } from '@/components/student/level-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { labService } from '@/services/labs';
import { studentService } from '@/services/student';

/** MyLab: the student's personal laboratory (fiche technique, section 3.2). */
export default function DashboardPage() {
  const profile = useQuery({ queryKey: ['student'], queryFn: studentService.me });
  const progress = useQuery({ queryKey: ['progress'], queryFn: studentService.progress });
  const labs = useQuery({ queryKey: ['labs'], queryFn: labService.list });
  const history = useQuery({
    queryKey: ['history'],
    queryFn: () => studentService.history(5),
  });

  const firstName = profile.data?.firstname ?? profile.data?.email?.split('@')[0] ?? '';

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Bonjour{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Votre laboratoire personnel, tel que vous l’avez laissé.
          </p>
        </div>
        <Button asChild>
          <Link href="/world">
            <Boxes className="h-4 w-4" />
            Entrer dans le monde 3D
          </Link>
        </Button>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {progress.isLoading || !progress.data ? (
          <>
            <Skeleton className="h-32 lg:col-span-1" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <LevelCard level={progress.data.level} />
            <StatCard
              label="Expériences validées"
              value={`${progress.data.completed_experiments} / ${progress.data.total_experiments}`}
              hint={`${progress.data.in_progress_experiments} en cours`}
              icon={CheckCircle2}
            />
            <StatCard
              label="Score moyen"
              value={`${progress.data.average_score} / 100`}
              icon={Target}
            />
            <StatCard
              label="Badges"
              value={progress.data.achievements_unlocked}
              icon={Award}
            />
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Laboratoires</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {labs.isLoading
            ? [0, 1].map((key) => <Skeleton key={key} className="h-56" />)
            : labs.data?.map((lab) => <LabCard key={lab.slug} lab={lab} />)}
        </div>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Historique des expériences</CardTitle>
          </CardHeader>
          <CardContent>
            {history.isLoading ? (
              <Skeleton className="h-24" />
            ) : history.data && history.data.length > 0 ? (
              <ul className="divide-y divide-ink-100">
                {history.data.map((entry) => (
                  <li
                    key={entry.experiment_slug}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/labs/signal/${entry.experiment_slug}`}
                        className="truncate text-sm font-medium text-ink-900 underline-offset-4 hover:underline"
                      >
                        {entry.experiment_title}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {formatDate(entry.completed_at ?? entry.updated_time)} ·{' '}
                        {entry.attempts} tentative{entry.attempts > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.status === 'completed' ? 'success' : 'outline'}
                      >
                        {entry.status === 'completed' ? 'Validé' : 'En cours'}
                      </Badge>
                      <span className="font-mono text-sm text-ink-700">
                        {entry.best_score} / 100
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">
                Aucune expérience pour l’instant.{' '}
                <Link href="/labs/signal" className="font-medium text-ink-900 underline underline-offset-4">
                  Commencez par les signaux élémentaires.
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
