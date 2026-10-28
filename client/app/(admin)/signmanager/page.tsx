'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, GraduationCap, Target, UserCheck, Users, Zap } from 'lucide-react';
import * as React from 'react';

import { ModerationQueue } from '@/components/admin/moderation-queue';
import { PendingResources } from '@/components/admin/pending-resources';
import { StudentTable } from '@/components/admin/student-table';
import { StatCard } from '@/components/student/level-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signManagerService } from '@/services/signmanager';

/** SignManager: the whole platform on one page. */
export default function SignManagerPage() {
  const overview = useQuery({
    queryKey: ['signmanager', 'overview'],
    queryFn: signManagerService.overview,
  });

  const counters = overview.data?.counters;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">SignManager</h1>
        <p className="mt-1 text-sm text-ink-500">
          Vue d’ensemble de STOUDENT : membres, modération de la communauté, et progression au labo.
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.isLoading || !counters ? (
          [0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-28" />)
        ) : (
          <>
            <StatCard
              label="Étudiants"
              value={counters.total_students}
              hint={`${counters.active_students} actifs · ${counters.inactive_students} désactivés`}
              icon={Users}
            />
            <StatCard
              label="Ont validé un TP"
              value={counters.engaged_students}
              hint={`${counters.total_experiments_completed} TP validés au total`}
              icon={UserCheck}
            />
            <StatCard
              label="Score moyen"
              value={`${counters.average_score} / 100`}
              icon={Target}
            />
            <StatCard
              label="XP distribuée"
              value={counters.total_xp_awarded}
              hint={`${counters.badges_unlocked} badges débloqués`}
              icon={Zap}
            />
          </>
        )}
      </section>

      <Tabs defaultValue="students" className="mt-8">
        <TabsList>
          <TabsTrigger value="students">Membres</TabsTrigger>
          <TabsTrigger value="moderation">Modération</TabsTrigger>
          <TabsTrigger value="experiments">Expériences</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <StudentTable />
        </TabsContent>

        <TabsContent value="moderation">
          <ModerationQueue />
          <PendingResources />
        </TabsContent>

        <TabsContent value="experiments">
          <Card>
            <CardHeader>
              <CardTitle>Entonnoir par expérience</CardTitle>
              <CardDescription>
                Le taux de complétion indique où une promotion bloque.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overview.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ul className="space-y-4">
                  {overview.data?.experiments.map((experiment) => (
                    <li key={experiment.slug}>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
                          <GraduationCap className="h-4 w-4 text-ink-300" aria-hidden />
                          {experiment.title}
                        </span>
                        <span className="font-mono text-xs text-ink-500">
                          {experiment.completed}/{experiment.started} validés · score{' '}
                          {experiment.average_score} · {experiment.average_attempts} tentative
                          {experiment.average_attempts > 1 ? 's' : ''} en moyenne
                        </span>
                      </div>
                      <Progress
                        value={experiment.completion_rate}
                        indicatorClassName={
                          experiment.started > 0 && experiment.completion_rate < 50
                            ? 'bg-[var(--color-danger)]'
                            : undefined
                        }
                      />
                    </li>
                  ))}
                  {overview.data?.experiments.length === 0 && (
                    <li className="text-sm text-ink-500">Aucune expérience publiée.</li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <Award className="h-3.5 w-3.5" aria-hidden />
        Les rôles et l’activation des comptes sont appliqués côté serveur : cette page ne fait
        qu’exposer les actions autorisées.
      </p>
    </div>
  );
}
