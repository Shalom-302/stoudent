'use client';

import { Zap } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { LevelDetail } from '@/types';

export function LevelCard({ level }: { level: LevelDetail }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Niveau</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold text-ink-900">
                {level.level_number}
              </span>
              <span className="text-sm text-ink-500">{level.title}</span>
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 font-mono text-sm font-medium text-accent-600">
            <Zap className="h-3.5 w-3.5" />
            {level.total_xp} XP
          </span>
        </div>

        <div className="mt-4">
          <Progress value={level.progress_percent} />
          <p className="mt-1.5 text-xs text-ink-400">
            {level.xp_for_next_level} XP avant le niveau {level.level_number + 1}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-ink-300" />}
        </div>
        <p className="mt-1 font-mono text-2xl font-semibold text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </CardContent>
    </Card>
  );
}
