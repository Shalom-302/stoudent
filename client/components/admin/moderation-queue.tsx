'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { REPORT_REASONS, timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { signManagerService } from '@/services/signmanager';
import type { ReportQueueItem } from '@/types';

const TYPE_LABEL: Record<ReportQueueItem['target_type'], string> = {
  question: 'Question',
  answer: 'Réponse',
  resource: 'Ressource',
};
const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));
const STATUSES = [
  { value: 'open', label: 'À traiter' },
  { value: 'resolved', label: 'Traités' },
  { value: 'dismissed', label: 'Rejetés' },
] as const;

/** STOUDENT reports, grouped by content: the most-reported first. */
export function ModerationQueue() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<(typeof STATUSES)[number]['value']>('open');
  const queue = useQuery({
    queryKey: ['signmanager', 'reports', status],
    queryFn: () => signManagerService.reports(status),
  });

  const resolve = useMutation({
    mutationFn: ({ item, action }: { item: ReportQueueItem; action: 'hide' | 'restore' | 'dismiss' }) =>
      signManagerService.resolve(item.target_type, item.target_x_id, action),
    onSuccess: (_, { action }) => {
      toast.success(action === 'hide' ? 'Contenu masqué.' : action === 'restore' ? 'Contenu rétabli.' : 'Signalements rejetés.');
      void queryClient.invalidateQueries({ queryKey: ['signmanager', 'reports'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signalements</CardTitle>
        <CardDescription>
          Un contenu signalé par 3 membres est masqué automatiquement en attendant votre décision.
        </CardDescription>
        <div className="mt-2 flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium',
                status === s.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {queue.isLoading ? (
          <Skeleton className="h-40" />
        ) : queue.data?.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">Rien à traiter. La communauté se tient bien.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {queue.data?.items.map((item) => (
              <li key={`${item.target_type}-${item.target_x_id}`} className="flex flex-wrap items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{TYPE_LABEL[item.target_type]}</Badge>
                    <Badge variant="danger">
                      {item.count} signalement{item.count > 1 ? 's' : ''}
                    </Badge>
                    {item.is_hidden && (
                      <Badge>
                        <EyeOff className="h-3 w-3" /> masqué
                      </Badge>
                    )}
                    <span className="text-xs text-ink-400">{timeAgo(item.last_time)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-900">{item.preview}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    par {item.author ?? '—'} · {item.reasons.map((r) => REASON_LABEL[r] ?? r).join(', ')}
                  </p>
                  {item.question_x_id && (
                    <Link
                      href={`/questions/${item.question_x_id}`}
                      target="_blank"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                    >
                      Voir dans le fil <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {status === 'open' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ item, action: 'hide' })}
                    >
                      Masquer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ item, action: 'dismiss' })}
                    >
                      Rejeter
                    </Button>
                  </div>
                )}
                {status !== 'open' && item.is_hidden && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ item, action: 'restore' })}
                  >
                    Rétablir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
