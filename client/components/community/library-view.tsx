'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
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
import { useAuth } from '@/features/auth/auth-provider';
import { BTS_FILIERES, FILIERE_GROUPS, LEGACY_FILIERES, PRIVACY_CONTACT, RESOURCE_KINDS, TRONC_COMMUN, kindLabel } from '@/lib/community';
import { cn } from '@/lib/utils';
import { communityService, type ResourcePayload, type ResourceSort } from '@/services/community';
import { studentService } from '@/services/student';
import type { KindCounts, ResourceItem, ResourceKind } from '@/types';

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

/**
 * The BTS library, organised on the official programme (DECO / MESRS):
 * filière -> épreuves with their coefficients -> the sujets, corrigés, cours
 * and TD that prepare each one. Every entry links to the site that hosts the
 * document, credited by name; STOUDENT never keeps a copy.
 */
export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = {
    filiere: normalizeFiliere(params.get('filiere')),
    epreuve: params.get('epreuve') ?? undefined,
    other: params.get('other') === '1',
    kind: (params.get('kind') as ResourceKind | null) ?? undefined,
    q: params.get('q') ?? undefined,
    sort: (params.get('sort') as ResourceSort | null) ?? 'recent',
    page: Number(params.get('page') ?? 1) || 1,
  };
  const [search, setSearch] = React.useState(filters.q ?? '');

  // Filters live in the URL so a shelf can be shared on WhatsApp.
  const go = (changes: Record<string, string | undefined>, reset = false) => {
    const next = new URLSearchParams(reset ? '' : params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const facets = useQuery({
    queryKey: ['community', 'library-facets'],
    queryFn: () => communityService.resourceFacets({}),
    staleTime: 5 * 60_000,
  });

  const searching = Boolean(filters.q);
  const shelf = filters.filiere && (filters.epreuve || filters.other);

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
            Le programme officiel de ta filière, épreuve par épreuve.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Les épreuves et coefficients du MESRS, et pour chacune les sujets, corrigés, cours et TD qui la
            préparent. {facets.data ? `${facets.data.total} documents, ` : ''}source et auteur toujours cités.
          </p>
          <form
            className="mt-6 flex max-w-2xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: search.trim() || undefined, epreuve: undefined, other: undefined, kind: undefined });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex. : maths 2024, fiscalité, réseaux d’accès…"
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

      {searching ? (
        <SearchResults
          filters={filters}
          onClear={() => {
            setSearch('');
            go({ q: undefined });
          }}
          go={go}
        />
      ) : shelf ? (
        <EpreuveShelf filters={filters} go={go} />
      ) : filters.filiere ? (
        <FiliereProgramme code={filters.filiere} go={go} />
      ) : (
        <FilierePicker go={go} />
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-[1fr_320px]">
        <SuggestBlock defaults={{ filiere: filters.filiere, subject: filters.epreuve, kind: filters.kind }} />
        <CopyrightNote sources={facets.data?.sources ?? []} />
      </div>
    </div>
  );
}

type Go = (changes: Record<string, string | undefined>, reset?: boolean) => void;

function normalizeFiliere(code: string | null): string | undefined {
  if (!code) return undefined;
  return LEGACY_FILIERES[code.toUpperCase()] ?? code;
}

/** Step 1: the 33 filières, the member's own first. */
function FilierePicker({ go }: { go: Go }) {
  const { user } = useAuth();
  const me = useQuery({ queryKey: ['student'], queryFn: studentService.me, enabled: Boolean(user) });
  const overview = useQuery({ queryKey: ['community', 'programme'], queryFn: communityService.programme, staleTime: 5 * 60_000 });
  const mine = normalizeFiliere(me.data?.filiere ?? null);
  const own = overview.data?.filieres.find((f) => f.code === mine);

  return (
    <section className="mt-8">
      {own && (
        <button
          onClick={() => go({ filiere: own.code }, true)}
          className="group mb-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-ink-900 p-5 text-left transition hover:bg-ink-50"
        >
          <span>
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">Ta filière</span>
            <span className="mt-1 block font-display text-xl font-semibold">
              {own.code} · {own.name}
            </span>
            <span className="mt-1 block text-sm text-ink-500">
              {own.epreuves_covered}/{own.epreuves} épreuves avec des documents · {own.documents} documents
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
        </button>
      )}

      {(['industrielle', 'tertiaire'] as const).map((family) => (
        <div key={family} className="mb-8">
          <h2 className="font-display text-xl font-semibold">
            {family === 'industrielle' ? 'Filières industrielles' : 'Filières tertiaires'}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overview.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </li>
              ))}
            {overview.data?.filieres
              .filter((f) => f.family === family)
              .map((f) => (
                <li key={f.code}>
                  <button
                    onClick={() => go({ filiere: f.code }, true)}
                    className="flex h-full w-full flex-col rounded-2xl border border-ink-200 p-4 text-left transition hover:border-ink-900"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-semibold">{f.code}</span>
                      <span className="font-mono text-[11px] text-ink-400">
                        {f.documents ? `${f.documents} docs` : 'à compléter'}
                      </span>
                    </span>
                    <span className="mt-0.5 text-sm text-ink-500">{f.name}</span>
                    <CoverageBar covered={f.epreuves_covered} total={f.epreuves} />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {overview.data && <p className="text-xs text-ink-400">Épreuves et coefficients : {overview.data.source}.</p>}
    </section>
  );
}

function CoverageBar({ covered, total }: { covered: number; total: number }) {
  return (
    <span className="mt-3 flex items-center gap-2 text-[11px] text-ink-400" title="Épreuves qui ont au moins un document">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100">
        <span className="block h-full bg-ink-900" style={{ width: `${total ? (covered / total) * 100 : 0}%` }} />
      </span>
      {covered}/{total} épreuves
    </span>
  );
}

/** Step 2: the filière's official épreuves, each with what prepares it. */
function FiliereProgramme({ code, go }: { code: string; go: Go }) {
  const data = useQuery({
    queryKey: ['community', 'programme', code],
    queryFn: () => communityService.programmeFiliere(code),
    retry: false,
  });

  if (data.isError) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-ink-300 p-8 text-center">
        <p className="font-display text-lg font-semibold">Filière « {code} » introuvable dans le programme officiel.</p>
        <Button className="mt-4" variant="outline" onClick={() => go({}, true)}>
          Voir les 33 filières
        </Button>
      </section>
    );
  }
  const f = data.data;

  return (
    <section className="mt-8">
      <Breadcrumb go={go} items={[{ label: f ? f.code : code }]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {f ? `${f.code} · ${f.name}` : <Skeleton className="h-8 w-80" />}
          </h2>
          {f && (
            <p className="mt-1 text-sm text-ink-500">
              {f.epreuves.length} épreuves officielles · total des coefficients {f.coefficients} · filière{' '}
              {f.family}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {data.isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-28 w-full rounded-2xl" />
            </li>
          ))}
        {f?.epreuves.map((e) => (
          <li key={e.name}>
            <button
              onClick={() => go({ epreuve: e.name, kind: undefined, other: undefined })}
              className={cn(
                'flex h-full w-full flex-col rounded-2xl border p-5 text-left transition',
                e.total ? 'border-ink-200 hover:border-ink-900' : 'border-dashed border-ink-200 hover:border-ink-400',
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-display text-lg font-semibold leading-snug">{e.name}</span>
                <span
                  className="shrink-0 rounded-lg bg-ink-900 px-2 py-1 text-center font-mono text-xs font-semibold text-white"
                  title="Coefficient à l’examen"
                >
                  coef {e.coefficient}
                </span>
              </span>
              <span className="mt-1 text-xs text-ink-400">
                Épreuve {e.nature}
                {f.coefficients > 0 && <> · {Math.round((e.coefficient / f.coefficients) * 100)} % de la note</>}
              </span>
              <span className="mt-auto pt-4">
                {e.total ? (
                  <KindChips kinds={e.kinds} />
                ) : (
                  <span className="text-xs text-ink-400">Pas encore de document. Tu en connais un ? Propose-le.</span>
                )}
              </span>
            </button>
          </li>
        ))}
        {f && f.other.total > 0 && (
          <li className="md:col-span-2">
            <button
              onClick={() => go({ other: '1', epreuve: undefined, kind: undefined })}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-5 text-left transition hover:border-ink-900"
            >
              <span>
                <span className="font-display text-lg font-semibold">Autres documents de la filière</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  Anciens sujets, cours complémentaires… qui ne se rattachent pas à une épreuve précise.
                </span>
              </span>
              <KindChips kinds={f.other.kinds} />
            </button>
          </li>
        )}
      </ul>
      {f && <p className="mt-4 text-xs text-ink-400">Épreuves et coefficients : {f.source}.</p>}
    </section>
  );
}

function KindChips({ kinds }: { kinds: KindCounts }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {RESOURCE_KINDS.filter((k) => kinds[k.value]).map((k) => (
        <span key={k.value} className="rounded-md bg-accent-100 px-2 py-0.5 text-[11px] text-ink-700">
          <b className="font-semibold text-ink-900">{kinds[k.value]}</b> {k.plural.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

function Breadcrumb({ go, items }: { go: Go; items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1 text-sm text-ink-500">
      <button onClick={() => go({}, true)} className="inline-flex items-center gap-1 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Filières
      </button>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
          {item.onClick ? (
            <button onClick={item.onClick} className="hover:text-ink-900">
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-ink-900">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

interface Filters {
  filiere?: string;
  epreuve?: string;
  other: boolean;
  kind?: ResourceKind;
  q?: string;
  sort: ResourceSort;
  page: number;
}

/** Step 3: the documents of one épreuve (or the filière's other documents). */
function EpreuveShelf({ filters, go }: { filters: Filters; go: Go }) {
  const programmeQuery = useQuery({
    queryKey: ['community', 'programme', filters.filiere],
    queryFn: () => communityService.programmeFiliere(filters.filiere!),
  });
  const f = programmeQuery.data;
  const e = f?.epreuves.find((x) => x.name === filters.epreuve);
  const kinds = filters.other ? f?.other.kinds : e?.kinds;
  const title = filters.other ? 'Autres documents' : (filters.epreuve ?? '');

  return (
    <section className="mt-8">
      <Breadcrumb
        go={go}
        items={[
          { label: filters.filiere!, onClick: () => go({ filiere: filters.filiere }, true) },
          { label: title },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {e && (
          <p className="text-sm text-ink-500">
            Épreuve {e.nature} · <b className="text-ink-900">coef {e.coefficient}</b>
          </p>
        )}
      </div>
      {kinds && <KindTabs kinds={kinds} active={filters.kind} onPick={(kind) => go({ kind })} sort={filters.sort} go={go} />}
      <DocumentList filters={filters} go={go} emptyHint="Aucun document pour cette épreuve pour l’instant." />
    </section>
  );
}

function KindTabs({
  kinds,
  active,
  onPick,
  sort,
  go,
}: {
  kinds: KindCounts;
  active?: ResourceKind;
  onPick: (kind?: string) => void;
  sort: ResourceSort;
  go: Go;
}) {
  const total = Object.values(kinds).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-xl border border-ink-200 p-0.5" role="tablist" aria-label="Type">
        {[{ value: undefined, plural: 'Tout' }, ...RESOURCE_KINDS].map((k) => {
          const count = k.value ? (kinds[k.value] ?? 0) : total;
          if (k.value && !count) return null;
          return (
            <button
              key={k.value ?? 'all'}
              role="tab"
              aria-selected={active === k.value}
              onClick={() => onPick(k.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                active === k.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {k.plural} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      <select
        aria-label="Tri"
        value={sort}
        onChange={(e) => go({ sort: e.target.value === 'recent' ? undefined : e.target.value })}
        className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SearchResults({ filters, onClear, go }: { filters: Filters; onClear: () => void; go: Go }) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">« {filters.q} »</h2>
        <button className="text-xs text-ink-500 underline underline-offset-4 hover:text-ink-900" onClick={onClear}>
          Revenir au programme
        </button>
      </div>
      <DocumentList filters={filters} go={go} emptyHint="Aucun document ne correspond. Essaie un autre mot." />
    </section>
  );
}

function DocumentList({ filters, go, emptyHint }: { filters: Filters; go: Go; emptyHint: string }) {
  const list = useQuery({
    queryKey: ['community', 'library', filters],
    queryFn: () =>
      communityService.resources({
        filiere: filters.filiere,
        epreuve: filters.epreuve,
        other: filters.other || undefined,
        kind: filters.kind,
        q: filters.q,
        sort: filters.sort,
        page: filters.page,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <ul
        className={cn(
          'mt-4 divide-y divide-ink-100 rounded-2xl border border-ink-200 transition-opacity',
          list.isFetching && list.isPlaceholderData && 'opacity-60',
        )}
      >
        {list.isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
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
            <p className="font-display text-lg font-semibold">{emptyHint}</p>
            <p className="mt-1 text-sm text-ink-500">Tu connais un bon document ? Propose-le plus bas.</p>
          </li>
        )}
        {list.data?.items.map((r) => (
          <DocumentRow key={r.x_id} doc={r} />
        ))}
      </ul>
      {list.data && list.data.total_pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => go({ page: String(filters.page - 1) })}
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
            onClick={() => go({ page: String(filters.page + 1) })}
          >
            Suivant
          </Button>
        </nav>
      )}
    </>
  );
}

function SuggestBlock({ defaults }: { defaults: { filiere?: string; subject?: string; kind?: ResourceKind } }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-ink-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">Il manque un document ?</p>
          <p className="text-sm text-ink-500">Propose le lien d’un sujet, d’un cours ou d’un TD public.</p>
        </div>
        <SuggestButton open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
      {open && <SuggestForm defaults={defaults} onDone={() => setOpen(false)} />}
    </div>
  );
}

function DocumentRow({ doc }: { doc: ResourceItem }) {
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
            {doc.subject}
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
