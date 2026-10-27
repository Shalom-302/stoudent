'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService } from '@/services/community';
import type { NotificationItem } from '@/types';

const TEXT: Record<NotificationItem['kind'], (actor: string) => string> = {
  answer: (actor) => `${actor} a répondu à ta question`,
  accepted: () => 'Ta réponse a été choisie comme meilleure réponse',
  endorsed: () => 'Un professeur a validé ta réponse',
  thanks: (actor) => `${actor} t’a dit merci pour ta réponse`,
};

/**
 * In-app notifications. Polled every minute and on focus: cheap, and enough
 * for a Q&A where answers take minutes, not seconds.
 */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const panel = React.useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['community', 'notifications'],
    queryFn: communityService.notifications,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: (xIds: string[]) => communityService.markRead(xIds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community', 'notifications'] }),
  });

  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  const unread = query.data?.unread ?? 0;
  const items = query.data?.items ?? [];

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => {
          // Opening the list is reading it; the dots stay until the next refetch.
          if (!open && (query.data?.unread ?? 0) > 0) markRead.mutate([]);
          setOpen((v) => !v);
        }}
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-700 hover:bg-ink-50 hover:text-ink-900"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button onClick={() => markRead.mutate([])} className="text-xs font-medium text-ink-500 hover:text-ink-900">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">
              Rien pour l’instant. Quand quelqu’un répond à ta question, c’est ici.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.x_id}>
                  <Link
                    href={`/questions/${n.question_x_id}`}
                    onClick={() => !n.is_read && markRead.mutate([n.x_id])}
                    className={cn('block px-4 py-3 hover:bg-ink-50', !n.is_read && 'bg-ink-50/70')}
                  >
                    <p className="flex items-start gap-2 text-sm text-ink-900">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="non lue" />}
                      <span>{TEXT[n.kind](n.actor)}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">« {n.question_title} »</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{timeAgo(n.created_time)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
