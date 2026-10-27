'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { studentService } from '@/services/student';

export default function AchievementsPage() {
  const achievements = useQuery({
    queryKey: ['achievements'],
    queryFn: studentService.achievements,
  });

  const unlocked = achievements.data?.filter((item) => item.unlocked) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Badges</h1>
          <p className="mt-1 text-sm text-ink-500">
            Les compétences que vous avez démontrées en manipulant.
          </p>
        </div>
        {achievements.data && (
          <Badge variant="accent">
            {unlocked.length} / {achievements.data.length} débloqués
          </Badge>
        )}
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {achievements.isLoading
          ? [0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-24" />)
          : achievements.data?.map((achievement) => (
              <article
                key={achievement.slug}
                className={cn(
                  'flex gap-3 rounded-[var(--radius-card)] border p-4',
                  achievement.unlocked
                    ? 'border-accent-200 bg-accent-50'
                    : 'border-dashed border-ink-200 bg-white',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    achievement.unlocked
                      ? 'bg-accent-200 text-accent-600'
                      : 'bg-ink-100 text-ink-300',
                  )}
                >
                  {achievement.unlocked ? (
                    <Award className="h-5 w-5" aria-hidden />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <h2
                    className={cn(
                      'text-sm font-semibold',
                      achievement.unlocked ? 'text-ink-900' : 'text-ink-500',
                    )}
                  >
                    {achievement.name}
                  </h2>
                  {achievement.description && (
                    <p className="mt-0.5 text-sm text-ink-500">{achievement.description}</p>
                  )}
                  <p className="mt-1.5 font-mono text-xs text-ink-400">
                    {achievement.unlocked
                      ? `Débloqué le ${formatDate(achievement.unlocked_at)}`
                      : achievement.xp_reward > 0
                        ? `+${achievement.xp_reward} XP à la clé`
                        : 'Verrouillé'}
                  </p>
                </div>
              </article>
            ))}
      </div>
    </div>
  );
}
