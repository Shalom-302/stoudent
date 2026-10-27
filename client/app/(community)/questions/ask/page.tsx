'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthGuard } from '@/features/auth/auth-guard';
import { communityService } from '@/services/community';
import { studentService } from '@/services/student';

const MAX_TAGS = 5;

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function AskForm() {
  const router = useRouter();
  const profile = useQuery({ queryKey: ['student'], queryFn: studentService.me });
  const meta = useQuery({ queryKey: ['community', 'meta'], queryFn: communityService.meta, staleTime: 5 * 60_000 });

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [filiere, setFiliere] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');

  // Default to the member's own filière once the profile arrives.
  React.useEffect(() => {
    if (profile.data?.filiere && !filiere) setFiliere(profile.data.filiere);
  }, [profile.data, filiere]);

  // Anti-doublons: show close matches while the title is typed.
  const debouncedTitle = useDebounced(title.trim());
  const similar = useQuery({
    queryKey: ['community', 'similar', debouncedTitle],
    queryFn: () => communityService.questions({ q: debouncedTitle, sort: 'votes' }),
    enabled: debouncedTitle.length >= 10,
  });

  const tagList = tags
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean);

  const submit = useMutation({
    mutationFn: () =>
      communityService.ask({
        title: title.trim(),
        body: body.trim(),
        filiere: filiere.trim(),
        subject: subject.trim() || undefined,
        tags: tagList,
        image_url: imageUrl.trim() || undefined,
      }),
    onSuccess: ({ x_id }) => {
      toast.success('Question publiée.');
      router.push(`/questions/${x_id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const problems = [
    title.trim().length < 10 && 'Le titre doit faire au moins 10 caractères.',
    body.trim().length < 20 && 'Détaillez votre question (20 caractères minimum).',
    filiere.trim().length < 2 && 'Choisissez une filière.',
    tagList.length > MAX_TAGS && `${MAX_TAGS} tags maximum.`,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Poser une question</h1>
      <p className="mt-1 text-sm text-ink-500">
        Une bonne question explique ce que vous avez déjà essayé. Vous aurez une meilleure réponse.
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length) return toast.error(problems[0]);
          submit.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Titre</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex. Pourquoi le repliement apparaît-il quand fe < 2·fmax ?"
          />
          {similar.data && similar.data.items.length > 0 && (
            <div className="rounded-xl border border-accent-300 bg-accent-50 p-3">
              <p className="text-xs font-semibold text-ink-900">Ces questions ressemblent à la vôtre :</p>
              <ul className="mt-1.5 space-y-1">
                {similar.data.items.slice(0, 5).map((q) => (
                  <li key={q.x_id}>
                    <Link href={`/questions/${q.x_id}`} target="_blank" className="text-sm text-ink-800 underline underline-offset-2">
                      {q.title}
                    </Link>
                    <span className="ml-2 text-xs text-ink-500">
                      {q.answer_count} réponse{q.answer_count > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Votre question en détail</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            maxLength={20000}
            placeholder={'Énoncé, ce que vous avez essayé, où vous bloquez.\nEntourez le code avec ``` pour le garder lisible.'}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="filiere">Filière</Label>
            <Input
              id="filiere"
              list="filieres"
              value={filiere}
              onChange={(e) => setFiliere(e.target.value)}
              maxLength={100}
            />
            <datalist id="filieres">
              {meta.data?.filieres.map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">
              Matière <span className="font-normal text-ink-400">(facultatif)</span>
            </Label>
            <Input
              id="subject"
              list="subjects"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
              placeholder="Traitement du signal"
            />
            <datalist id="subjects">
              {meta.data?.subjects.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fourier, échantillonnage, shannon"
          />
          <p className="text-xs text-ink-400">Séparés par des virgules, {MAX_TAGS} maximum.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="image">
            Lien vers une image de l’énoncé <span className="font-normal text-ink-400">(facultatif)</span>
          </Label>
          <Input
            id="image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" asChild>
            <Link href="/questions">Annuler</Link>
          </Button>
          <Button type="submit" size="lg" disabled={submit.isPending}>
            {submit.isPending ? 'Publication…' : 'Publier la question'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AskPage() {
  return (
    <AuthGuard>
      <AskForm />
    </AuthGuard>
  );
}
