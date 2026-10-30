'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { FeedCard } from '@/components/community/feed-card';
import { TagChip } from '@/components/community/parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { cn } from '@/lib/utils';
import { communityService, type QuestionSort } from '@/services/community';

const SORTS: { value: QuestionSort; label: string }[] = [
  { value: 'recent', label: 'Récentes' },
  { value: 'votes', label: 'Les mieux notées' },
  { value: 'active', label: 'Actives' },
  { value: 'unanswered', label: 'Sans réponse' },
];

function Feed() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const filters = {
    filiere: params.get('filiere') ?? undefined,
    subject: params.get('subject') ?? undefined,
    tag: params.get('tag') ?? undefined,
    q: params.get('q') ?? undefined,
    sort: (params.get('sort') as QuestionSort | null) ?? 'recent',
    page: Number(params.get('page') ?? 1) || 1,
  };
  const [search, setSearch] = React.useState(filters.q ?? '');

  // Filters live in the URL so a filtered feed can be shared.
  const setParam = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  const meta = useQuery({ queryKey: ['community', 'meta'], queryFn: communityService.meta, staleTime: 5 * 60_000 });
  // The viewer's votes are in the payload, so the key includes who asks.
  const feed = useQuery({
    queryKey: ['community', 'questions', filters, user?.x_id ?? 'anon'],
    queryFn: () => communityService.questions(filters),
  });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_260px]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {filters.filiere ? `Questions · ${filters.filiere}` : 'Toutes les questions'}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {feed.data ? `${feed.data.total} question${feed.data.total > 1 ? 's' : ''}` : '…'}
              {filters.tag && <> · tag #{filters.tag}</>}
              {filters.q && <> · « {filters.q} »</>}
            </p>
          </div>
          <Button asChild>
            <Link href="/questions/ask">
              <Plus /> Poser une question
            </Link>
          </Button>
        </div>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ q: search.trim() || undefined });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une question déjà posée…"
              className="pl-9"
              aria-label="Rechercher"
            />
          </div>
          <Button type="submit" variant="secondary">
            Chercher
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 p-0.5" role="tablist" aria-label="Tri">
            {SORTS.map((s) => (
              <button
                key={s.value}
                role="tab"
                aria-selected={filters.sort === s.value}
                onClick={() => setParam({ sort: s.value === 'recent' ? undefined : s.value })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  filters.sort === s.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filière"
            value={filters.filiere ?? ''}
            onChange={(e) => setParam({ filiere: e.target.value || undefined })}
            className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm"
          >
            <option value="">Toutes les filières</option>
            {meta.data?.filieres.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {(filters.filiere || filters.tag || filters.q || filters.subject) && (
            <button
              className="text-xs text-ink-500 underline underline-offset-4 hover:text-ink-900"
              onClick={() => {
                setSearch('');
                router.push(pathname);
              }}
            >
              Effacer les filtres
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {feed.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-ink-200 p-5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="mt-4 h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-4 h-8 w-1/2" />
              </div>
            ))}
          {feed.isError && <p className="rounded-2xl border border-ink-200 p-5 text-sm text-red-700">{(feed.error as Error).message}</p>}
          {feed.data?.items.length === 0 && (
            <div className="rounded-2xl border border-ink-200 p-10 text-center">
              <p className="font-display text-lg font-semibold">Aucune question ici pour l’instant.</p>
              <p className="mt-1 text-sm text-ink-500">Soyez le premier : posez la vôtre.</p>
            </div>
          )}
          {feed.data?.items.map((q) => (
            <FeedCard
              key={q.x_id}
              question={q}
              onTag={(t) => setParam({ tag: t })}
              onAnswered={() => void queryClient.invalidateQueries({ queryKey: ['community', 'questions'] })}
            />
          ))}
        </div>

        {feed.data && feed.data.total_pages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setParam({ page: String(filters.page - 1) })}
            >
              Précédent
            </Button>
            <span className="text-sm text-ink-500">
              {filters.page} / {feed.data.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= feed.data.total_pages}
              onClick={() => setParam({ page: String(filters.page + 1) })}
            >
              Suivant
            </Button>
          </nav>
        )}
      </section>

      <aside className="space-y-6">
        {meta.data && (
          <div className="rounded-2xl bg-ink-900 p-5 text-white">
            <p className="font-display text-lg font-semibold">La communauté</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['Questions', meta.data.stats.questions],
                ['Réponses', meta.data.stats.answers],
                ['Membres', meta.data.stats.members],
              ].map(([label, value]) => (
                <div key={label}>
                  <dd className="font-display text-xl font-semibold">{value}</dd>
                  <dt className="text-[11px]">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
        {meta.data && meta.data.tags.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Tags populaires</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.data.tags.map((t) => (
                <TagChip key={t.name} tag={`${t.name} ×${t.count}`} onClick={() => setParam({ tag: t.name })} />
              ))}
            </div>
          </div>
        )}
        {meta.data && meta.data.subjects.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Matières</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meta.data.subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setParam({ subject: s })}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    filters.subject === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 hover:border-ink-900',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-ink-200 p-5 text-sm text-ink-600">
          <p className="font-semibold text-ink-900">Avant de poser</p>
          <p className="mt-1">Cherchez si la question existe déjà, et montrez ce que vous avez essayé.</p>
          <Link href="/regles" className="mt-2 inline-block font-semibold text-ink-900 underline underline-offset-4">
            Règles de la communauté
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <React.Suspense>
      <Feed />
    </React.Suspense>
  );
}
