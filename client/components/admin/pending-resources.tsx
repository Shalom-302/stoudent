'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { kindLabel, timeAgo } from '@/lib/community';
import { signManagerService } from '@/services/signmanager';

/** Library links suggested by members: published only once an admin approves. */
export function PendingResources() {
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ['signmanager', 'pending-resources'], queryFn: signManagerService.pendingResources });
  const review = useMutation({
    mutationFn: ({ xId, action }: { xId: string; action: 'approve' | 'reject' }) =>
      signManagerService.reviewResource(xId, action),
    onSuccess: (_, { action }) => {
      toast.success(action === 'approve' ? 'Publié dans la bibliothèque.' : 'Proposition refusée.');
      void queryClient.invalidateQueries({ queryKey: ['signmanager', 'pending-resources'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Documents proposés</CardTitle>
        <CardDescription>
          Vérifiez que le lien est public, utile et que la source est citée. Jamais de fichier copié.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending.isLoading && <Skeleton className="h-16 w-full" />}
        {pending.data?.items.length === 0 && <p className="text-sm text-ink-500">Aucune proposition en attente.</p>}
        <ul className="divide-y divide-ink-100">
          {pending.data?.items.map((r) => (
            <li key={r.x_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  {kindLabel(r.kind)} · {r.filiere}
                  {r.subject && <> · {r.subject}</>}
                  {r.session_year && <> · {r.session_year}</>}
                </p>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 font-medium text-ink-900 hover:underline"
                >
                  {r.title} <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                </a>
                <p className="break-all text-xs text-ink-400">{r.url}</p>
                <p className="mt-1 text-xs text-ink-500">
                  Source : {r.source ?? '—'}
                  {r.original_author && <> · Auteur : {r.original_author}</>} · proposé par {r.author},{' '}
                  {timeAgo(r.created_time)}
                </p>
                {r.description && <p className="mt-1 text-sm text-ink-600">{r.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ xId: r.x_id, action: 'approve' })}>
                  Publier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ xId: r.x_id, action: 'reject' })}
                >
                  Refuser
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
