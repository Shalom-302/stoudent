'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  FileCheck2,
  FileText,
  Files,
  MessageCirclePlus,
  PencilLine,
  Plus,
  Scale,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ReportButton, useRequireAuth } from '@/components/community/parts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BTS_FILIERES, FILIERE_GROUPS, PRIVACY_CONTACT, RESOURCE_KINDS, TRONC_COMMUN, kindLabel } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService, type ResourcePayload, type ResourceSort } from '@/services/community';
import type { ResourceItem, ResourceKind } from '@/types';

const SORTS: { value: ResourceSort; label: string }[] = [
  { value: 'recent', label: 'Sessions récentes' },
  { value: 'subject', label: 'Par matière' },
  { value: 'popular', label: 'Les plus consultés' },
];

const KIND_ICONS: Record<ResourceKind, React.ComponentType<{ className?: string }>> = {
  sujet: FileText,
  corrige: FileCheck2,
  cours: BookOpen,
  td: PencilLine,
  autre: Files,
};

function filiereName(code: string): string | undefined {
  if (FILIERE_GROUPS[code]) return FILIERE_GROUPS[code];
  return BTS_FILIERES.find((f) => f.code === code)?.name;
}

/**
 * The BTS library: sujets d'examen, corrigés, cours and TD, sorted by filière,
 * matière and session. Each entry links to the site that hosts the document,
 * credited by name; STOUDENT never keeps a copy.
 */
export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = {
    filiere: params.get('filiere') ?? undefined,
    subject: params.get('subject') ?? undefined,
    kind: (params.get('kind') as ResourceKind | null) ?? undefined,
    year: Number(params.get('year')) || undefined,
    q: params.get('q') ?? undefined,
    sort: (params.get('sort') as ResourceSort | null) ?? 'recent',
    page: Number(params.get('page') ?? 1) || 1,
  };
  const [search, setSearch] = React.useState(filters.q ?? '');
  const [suggesting, setSuggesting] = React.useState(false);

  // Filters live in the URL so a filtered shelf can be shared on WhatsApp.
  const setParam = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const facets = useQuery({
    queryKey: ['community', 'library-facets', filters.filiere, filters.subject, filters.kind],
    queryFn: () =>
      communityService.resourceFacets({ filiere: filters.filiere, subject: filters.subject, kind: filters.kind }),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  const list = useQuery({
    queryKey: ['community', 'library', filters],
    queryFn: () => communityService.resources(filters),
    placeholderData: (previous) => previous,
  });

  const kindCount = (kind?: string) =>
    kind
      ? (facets.data?.kinds.find((k) => k.value === kind)?.count ?? 0)
      : (facets.data?.kinds.reduce((sum, k) => sum + k.count, 0) ?? 0);
  const filtered = Boolean(filters.filiere || filters.subject || filters.kind || filters.year || filters.q);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="relative overflow-hidden rounded-3xl bg-ink-900 px-5 py-8 text-white sm:px-10 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Bibliothèque BTS</p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Sujets, corrigés, cours et TD, rangés par filière et matière.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            {facets.data ? `${facets.data.total} documents` : '…'} repérés pour toi sur les sites qui les publient. Tu
            les ouvres chez leur auteur, la source est toujours citée.
          </p>
          <form
            className="mt-6 flex max-w-2xl gap-2"
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
                placeholder="Ex. : maths 2024, comptabilité, réseaux téléphoniques…"
                className="h-12 border-0 pl-9 text-ink-900"
                aria-label="Rechercher un document"
              />
            </div>
            <Button type="submit" size="lg" className="bg-white text-ink-900 hover:bg-ink-100">
              Chercher
            </Button>
          </form>
        </div>
      </header>

      {/* Filières */}
      <nav aria-label="Filière" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <FilterPill
              active={!filters.filiere}
              onClick={() => setParam({ filiere: undefined, subject: undefined })}
              label="Toutes"
              count={facets.data?.total}
            />
          </li>
          {facets.data?.filieres.map((f) => (
            <li key={f.value}>
              <FilterPill
                active={filters.filiere === f.value}
                onClick={() =>
                  setParam({ filiere: filters.filiere === f.value ? undefined : f.value, subject: undefined })
                }
                label={f.value}
                title={filiereName(f.value)}
                count={f.count}
              />
            </li>
          ))}
        </ul>
      </nav>
      {filters.filiere && filiereName(filters.filiere) && (
        <p className="mt-2 text-sm text-ink-500">{filiereName(filters.filiere)}</p>
      )}

      {/* Types */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-xl border border-ink-200 p-0.5" role="tablist" aria-label="Type">
          {[{ value: undefined, plural: 'Tout' }, ...RESOURCE_KINDS].map((k) => {
            const count = kindCount(k.value);
            if (k.value && !count && filters.kind !== k.value) return null;
            return (
              <button
                key={k.value ?? 'all'}
                role="tab"
                aria-selected={filters.kind === k.value}
                onClick={() => setParam({ kind: k.value })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium',
                  filters.kind === k.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {k.plural} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <select
          aria-label="Tri"
          value={filters.sort}
          onChange={(e) => setParam({ sort: e.target.value === 'recent' ? undefined : e.target.value })}
          className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="text-xs text-ink-500 underline underline-offset-4 hover:text-ink-900"
            onClick={() => {
              setSearch('');
              router.push(pathname, { scroll: false });
            }}
          >
            Effacer les filtres
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
          <FacetBlock title="Matières">
            {facets.isLoading && <Skeleton className="h-24 w-full" />}
            {facets.data?.subjects.length === 0 && <p className="text-xs text-ink-400">Aucune matière.</p>}
            <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:max-h-[50vh] lg:flex-col lg:flex-nowrap lg:gap-0.5 lg:overflow-y-auto">
              {facets.data?.subjects.map((s) => (
                <li key={s.value}>
                  <button
                    onClick={() => setParam({ subject: filters.subject === s.value ? undefined : s.value })}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-full border px-2.5 py-1 text-left text-xs lg:rounded-lg lg:border-0 lg:px-2 lg:py-1.5 lg:text-sm',
                      filters.subject === s.value
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-ink-200 text-ink-700 hover:bg-ink-50 hover:text-ink-900',
                    )}
                  >
                    <span className="truncate">{s.value}</span>
                    <span className="font-mono text-[11px] opacity-60">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </FacetBlock>

          {facets.data && facets.data.years.length > 0 && (
            <FacetBlock title="Session">
              <div className="flex flex-wrap gap-1.5">
                {facets.data.years.map((y) => (
                  <button
                    key={y.value}
                    onClick={() => setParam({ year: filters.year === y.value ? undefined : String(y.value) })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 font-mono text-xs',
                      filters.year === y.value
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-ink-200 text-ink-700 hover:border-ink-900',
                    )}
                  >
                    {y.value} <span className="opacity-60">{y.count}</span>
                  </button>
                ))}
              </div>
            </FacetBlock>
          )}

          <CopyrightNote sources={facets.data?.sources ?? []} />
        </aside>

        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              {list.data ? `${list.data.total} document${list.data.total > 1 ? 's' : ''}` : '…'}
              {filters.subject && <> · {filters.subject}</>}
              {filters.year && <> · session {filters.year}</>}
              {filters.q && <> · « {filters.q} »</>}
            </p>
            <SuggestButton open={suggesting} onToggle={() => setSuggesting((v) => !v)} />
          </div>

          {suggesting && <SuggestForm defaults={filters} onDone={() => setSuggesting(false)} />}

          <ul
            className={cn(
              'mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-200 transition-opacity',
              list.isFetching && list.isPlaceholderData && 'opacity-60',
            )}
          >
            {list.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex gap-4 p-5">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-5 w-2/3" />
                  </div>
                </li>
              ))}
            {list.isError && <li className="p-5 text-sm text-red-700">{(list.error as Error).message}</li>}
            {list.data?.items.length === 0 && (
              <li className="p-10 text-center">
                <p className="font-display text-lg font-semibold">Rien ici pour l’instant.</p>
                <p className="mt-1 text-sm text-ink-500">
                  Essaie une autre matière, ou propose un document que tu connais.
                </p>
              </li>
            )}
            {list.data?.items.map((r) => (
              <DocumentRow key={r.x_id} doc={r} onSubject={(subject) => setParam({ subject })} />
            ))}
          </ul>

          {list.data && list.data.total_pages > 1 && (
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
                {filters.page} / {list.data.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= list.data.total_pages}
                onClick={() => setParam({ page: String(filters.page + 1) })}
              >
                Suivant
              </Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-900',
      )}
    >
      {label}
      {count !== undefined && <span className="font-mono text-[11px] opacity-60">{count}</span>}
    </button>
  );
}

function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-400">{title}</p>
      {children}
    </div>
  );
}

function DocumentRow({ doc, onSubject }: { doc: ResourceItem; onSubject: (subject: string) => void }) {
  const Icon = KIND_ICONS[doc.kind] ?? Files;
  const [opens, setOpens] = React.useState(doc.open_count);
  const open = useMutation({
    mutationFn: () => communityService.openResource(doc.x_id),
    onSuccess: (data) => setOpens(data.open_count),
  });
  const ask = new URLSearchParams({ doc: doc.title, url: doc.url });
  if (!FILIERE_GROUPS[doc.filiere]) ask.set('filiere', doc.filiere);
  if (doc.subject) ask.set('subject', doc.subject);

  return (
    <li className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent-50/60 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <span
          aria-hidden
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            doc.kind === 'sujet' ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-900',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            <span className="text-ink-900">{kindLabel(doc.kind)}</span>
            {doc.session_year && <span>· Session {doc.session_year}</span>}
            <span className="rounded-md bg-accent-100 px-1.5 py-0.5 normal-case tracking-normal text-ink-900">
              {doc.filiere}
            </span>
          </p>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => open.mutate()}
            className="mt-1 block font-display text-base font-semibold leading-snug text-ink-900 hover:underline sm:text-lg"
          >
            {doc.title}
          </a>
          <p className="mt-0.5 text-sm text-ink-500">
            {doc.subject && (
              <button onClick={() => onSubject(doc.subject!)} className="hover:text-ink-900 hover:underline">
                {doc.subject}
              </button>
            )}
            {doc.chapter && <> · {doc.chapter}</>}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-400">
            <Scale className="h-3 w-3" aria-hidden />
            <span>
              Source : <span className="text-ink-600">{doc.source ?? doc.domain}</span>
            </span>
            {doc.original_author && (
              <span>
                · Auteur : <span className="text-ink-600">{doc.original_author}</span>
              </span>
            )}
            {opens > 0 && <span>· consulté {opens} fois sur STOUDENT</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-2 sm:flex-col sm:flex-nowrap sm:items-end">
        <Button asChild size="sm">
          <a href={doc.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => open.mutate()}>
            Ouvrir sur {doc.domain} <ArrowUpRight />
          </a>
        </Button>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/questions/ask?${ask.toString()}`} title="Bloqué sur un exercice ? Demande à la communauté">
              <MessageCirclePlus /> Poser une question
            </Link>
          </Button>
          <ReportButton targetType="resource" targetXId={doc.x_id} />
        </div>
      </div>
    </li>
  );
}

function CopyrightNote({ sources }: { sources: { value: string; count: number }[] }) {
  return (
    <div className="rounded-2xl border border-ink-200 p-4 text-xs leading-relaxed text-ink-500">
      <p className="flex items-center gap-1.5 font-semibold text-ink-900">
        <Scale className="h-3.5 w-3.5" aria-hidden /> Droits d’auteur
      </p>
      <p className="mt-2">
        STOUDENT ne copie aucun document : chaque fiche renvoie vers le site qui le publie, avec sa source et son
        auteur. Les droits restent à leurs auteurs.
      </p>
      {sources.length > 0 && (
        <p className="mt-2">
          Merci à{' '}
          {sources.map((s, i) => (
            <React.Fragment key={s.value}>
              {i > 0 && ', '}
              <b className="font-medium text-ink-700">{s.value}</b>
            </React.Fragment>
          ))}
          .
        </p>
      )}
      <p className="mt-2">
        Vous êtes l’auteur et souhaitez un retrait ? Signalez la fiche ou écrivez à{' '}
        <a className="underline" href={`mailto:${PRIVACY_CONTACT}`}>
          {PRIVACY_CONTACT}
        </a>
        .
      </p>
    </div>
  );
}

function SuggestButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const requireAuth = useRequireAuth();
  return (
    <Button size="sm" variant="outline" onClick={() => (open ? onToggle() : requireAuth() && onToggle())}>
      {open ? <X /> : <Plus />} {open ? 'Fermer' : 'Proposer un document'}
    </Button>
  );
}

function SuggestForm({
  defaults,
  onDone,
}: {
  defaults: { filiere?: string; subject?: string; kind?: ResourceKind };
  onDone: () => void;
}) {
  const [form, setForm] = React.useState<ResourcePayload>({
    title: '',
    url: '',
    filiere: defaults.filiere ?? '',
    subject: defaults.subject ?? '',
    kind: defaults.kind ?? 'sujet',
    source: '',
    original_author: '',
    description: '',
  });
  const [year, setYear] = React.useState('');

  const share = useMutation({
    mutationFn: () =>
      communityService.shareResource({
        title: form.title.trim(),
        url: form.url.trim(),
        filiere: form.filiere.trim(),
        kind: form.kind,
        subject: form.subject?.trim() || undefined,
        source: form.source?.trim() || undefined,
        original_author: form.original_author?.trim() || undefined,
        description: form.description?.trim() || undefined,
        session_year: Number(year) || undefined,
      }),
    onSuccess: () => {
      toast.success('Merci ! Le document apparaîtra dès qu’un admin l’aura vérifié.');
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const field = (key: keyof ResourcePayload) => ({
    value: (form[key] as string | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form
      className="mt-4 grid gap-4 rounded-2xl border border-ink-900 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        share.mutate();
      }}
    >
      <p className="text-sm text-ink-500 sm:col-span-2">
        Partage le <b>lien</b> vers un document public (pas de fichier) et cite d’où il vient. Un admin le vérifie avant
        publication.
      </p>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="r-title">Titre</Label>
        <Input id="r-title" required minLength={5} maxLength={200} placeholder="Sujet de maths générales" {...field('title')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="r-url">Lien</Label>
        <Input id="r-url" type="url" required placeholder="https://…" {...field('url')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-filiere">Filière</Label>
        <Input id="r-filiere" list="r-filieres" required maxLength={100} {...field('filiere')} />
        <datalist id="r-filieres">
          <option value={TRONC_COMMUN} />
          {BTS_FILIERES.map((f) => (
            <option key={f.code} value={f.code}>
              {f.name}
            </option>
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-subject">Matière</Label>
        <Input id="r-subject" maxLength={100} placeholder="Comptabilité générale" {...field('subject')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-kind">Type</Label>
        <select
          id="r-kind"
          className="h-10 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm"
          {...field('kind')}
        >
          {RESOURCE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-year">Session (année)</Label>
        <Input
          id="r-year"
          inputMode="numeric"
          pattern="(19|20)[0-9]{2}"
          placeholder="2025"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-source">Source (site ou organisme)</Label>
        <Input id="r-source" maxLength={200} placeholder="fomesoutra.com" {...field('source')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-author">Auteur, si connu</Label>
        <Input id="r-author" maxLength={150} {...field('original_author')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="r-desc">Pourquoi c’est utile (facultatif)</Label>
        <Textarea id="r-desc" rows={2} maxLength={1000} {...field('description')} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={share.isPending}>
          {share.isPending ? 'Envoi…' : 'Proposer'}
        </Button>
      </div>
    </form>
  );
}
