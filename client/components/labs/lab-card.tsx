'use client';

import { ArrowRight, FlaskConical, Radio } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { LabSummary } from '@/types';

const LAB_ROUTES: Record<string, string> = {
  'signal-lab': '/labs/signal',
  'telecom-lab': '/labs/telecom',
};

export function LabCard({ lab }: { lab: LabSummary }) {
  const available = lab.status === 'available';
  const Icon = lab.type === 'telecom' ? Radio : FlaskConical;

  return (
    <Link
      href={LAB_ROUTES[lab.slug] ?? '/labs'}
      className={cn(
        'group block rounded-[var(--radius-card)] border p-5 transition-colors',
        available
          ? 'border-ink-200 bg-white hover:border-ink-400'
          : 'border-dashed border-ink-200 bg-ink-50',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            available ? 'bg-accent-100 text-accent-600' : 'bg-ink-100 text-ink-400',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <Badge variant={available ? 'accent' : 'outline'}>
          {available ? 'Disponible' : 'Bientôt'}
        </Badge>
      </div>

      <h3
        className={cn(
          'mt-4 text-base font-semibold',
          available ? 'text-ink-900' : 'text-ink-500',
        )}
      >
        {lab.name}
      </h3>
      {lab.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-500">{lab.description}</p>
      )}

      {available ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
            <span>
              {lab.completed_experiments} / {lab.total_experiments} expériences
            </span>
            <span className="font-mono">{lab.progress_percent} %</span>
          </div>
          <Progress value={lab.progress_percent} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-400">
          {lab.scene_config?.locked_message ?? 'Contenu en préparation'}
        </p>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-ink-900">
        {available ? 'Entrer dans le laboratoire' : 'Voir l’aperçu'}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
