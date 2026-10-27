'use client';

import { useQuery } from '@tanstack/react-query';

import { LevelCard, StatCard } from '@/components/student/level-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { studentService } from '@/services/student';

export default function ProgressPage() {
  const progress = useQuery({ queryKey: ['progress'], queryFn: studentService.progress });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Progression</h1>
      <p className="mt-1 text-sm text-ink-500">
        Votre avancement laboratoire par laboratoire.
      </p>

      {progress.isLoading || !progress.data ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <LevelCard level={progress.data.level} />
            <StatCard
              label="Expériences validées"
              value={`${progress.data.completed_experiments} / ${progress.data.total_experiments}`}
            />
            <StatCard label="Score moyen" value={`${progress.data.average_score} / 100`} />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Par laboratoire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {progress.data.labs.map((lab) => (
                <div key={lab.lab_slug}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">{lab.lab_name}</span>
                    <span className="font-mono text-xs text-ink-500">
                      {lab.completed_experiments} / {lab.total_experiments} ·{' '}
                      {lab.xp_earned} XP
                    </span>
                  </div>
                  <Progress value={lab.progress_percent} />
                </div>
              ))}
              {progress.data.labs.length === 0 && (
                <p className="text-sm text-ink-500">Aucun laboratoire disponible.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
