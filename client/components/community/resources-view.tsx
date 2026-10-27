'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Search, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { AuthorLine, FiliereChip, ReportButton, useRequireAuth } from '@/components/community/parts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { communityService, type ResourcePayload } from '@/services/community';

const EMPTY: ResourcePayload = { title: '', url: '', filiere: '', subject: '', source: '', description: '' };

/**
 * Shared resources (links + attribution). Closed for the launch: not routed,
 * and the API refuses it unless COMMUNITY_RESOURCES_ENABLED is true. To reopen,
 * render this from app/(community)/resources/page.tsx and add the nav entry.
 */
export function ResourcesView() {
  const queryClient = useQueryClient();
  const requireAuth = useRequireAuth();
  const [filiere, setFiliere] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sharing, setSharing] = React.useState(false);
  const [form, setForm] = React.useState<ResourcePayload>(EMPTY);

  const meta = useQuery({ queryKey: ['community', 'meta'], queryFn: communityService.meta, staleTime: 5 * 60_000 });
  const list = useQuery({
    queryKey: ['community', 'resources', filiere, q, page],
    queryFn: () => communityService.resources({ filiere: filiere || undefined, q: q || undefined, page }),
  });

  const share = useMutation({
    mutationFn: () =>
      communityService.shareResource({
        title: form.title.trim(),
        url: form.url.trim(),
        filiere: form.filiere.trim(),
        subject: form.subject?.trim() || undefined,
        source: form.source?.trim() || undefined,
        description: form.description?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Ressource partagée. Merci !');
      setForm(EMPTY);
      setSharing(false);
      void queryClient.invalidateQueries({ queryKey: ['community', 'resources'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const field = (key: keyof ResourcePayload) => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Ressources</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Cours, documentations et vidéos fiables, partagés par la communauté. On partage le lien et
            sa source, jamais une copie du contenu.
          </p>
        </div>
        <Button onClick={() => requireAuth() && setSharing((v) => !v)}>
          {sharing ? <X /> : <Plus />} {sharing ? 'Fermer' : 'Partager un lien'}
        </Button>
      </div>

      {sharing && (
        <form
          className="mt-6 grid gap-4 rounded-2xl border border-accent-300 bg-accent-50 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            share.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-title">Titre</Label>
            <Input id="r-title" required minLength={5} maxLength={200} {...field('title')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-url">Lien</Label>
            <Input id="r-url" type="url" required placeholder="https://…" {...field('url')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-filiere">Filière</Label>
            <Input id="r-filiere" list="r-filieres" required maxLength={100} {...field('filiere')} />
            <datalist id="r-filieres">
              {meta.data?.filieres.map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-subject">Matière</Label>
            <Input id="r-subject" maxLength={100} {...field('subject')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-source">Source (organisme ou auteur)</Label>
            <Input id="r-source" maxLength={200} placeholder="Université, éditeur, chaîne…" {...field('source')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-desc">Pourquoi c’est utile</Label>
            <Textarea id="r-desc" rows={3} maxLength={1000} {...field('description')} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={share.isPending}>
              {share.isPending ? 'Partage…' : 'Partager'}
            </Button>
          </div>
        </form>
      )}

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une ressource…"
            className="pl-9"
            aria-label="Rechercher"
          />
        </div>
        <select
          aria-label="Filière"
          value={filiere}
          onChange={(e) => {
            setPage(1);
            setFiliere(e.target.value);
          }}
          className="h-10 rounded-lg border border-ink-200 bg-white px-2 text-sm"
        >
          <option value="">Toutes les filières</option>
          {meta.data?.filieres.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Chercher
        </Button>
      </form>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {list.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-36 w-full rounded-2xl" />
            </li>
          ))}
        {list.data?.items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-ink-300 p-10 text-center sm:col-span-2">
            <p className="font-display text-lg font-semibold">Aucune ressource pour l’instant.</p>
            <p className="mt-1 text-sm text-ink-500">Partagez le premier lien utile de votre filière.</p>
          </li>
        )}
        {list.data?.items.map((r) => (
          <li key={r.x_id} className="flex flex-col rounded-2xl border border-ink-200 p-5">
            <div className="flex items-center gap-2">
              <FiliereChip filiere={r.filiere} />
              {r.subject && <span className="text-xs text-ink-500">{r.subject}</span>}
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="mt-2 inline-flex items-start gap-1.5 font-display text-lg font-semibold leading-snug hover:underline"
            >
              {r.title} <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
            </a>
            <p className="mt-0.5 text-xs text-ink-400">
              {r.domain}
              {r.source && <> · Source : {r.source}</>}
            </p>
            {r.description && <p className="mt-2 text-sm text-ink-600">{r.description}</p>}
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <AuthorLine author={r.author} time={r.created_time} />
              <ReportButton targetType="resource" targetXId={r.x_id} />
            </div>
          </li>
        ))}
      </ul>

      {list.data && list.data.total_pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <span className="text-sm text-ink-500">
            {page} / {list.data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= list.data.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </nav>
      )}
    </div>
  );
}
