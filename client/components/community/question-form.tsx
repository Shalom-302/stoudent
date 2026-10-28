'use client';

import { useQuery } from '@tanstack/react-query';
import { Camera, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { communityService, type AskPayload } from '@/services/community';
import { studentService } from '@/services/student';

const MAX_TAGS = 5;
const MAX_PHOTO_MB = 8;

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Ask a question, or edit one (``initial`` given). The photo is uploaded as
 * soon as it is picked, so publishing only sends the URL the API returned.
 */
/** How to write code and formulas; shared by the question and answer forms. */
export function FormattingHint() {
  return (
    <p className="text-xs text-ink-400">
      Formule : entourez-la de $, par ex. <code className="rounded bg-ink-50 px-1">{'$f_e > 2 f_{max}$'}</code> · code :
      entourez-le de <code className="rounded bg-ink-50 px-1">```</code>
    </p>
  );
}

export function QuestionForm({
  initial,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
  onSubmit,
}: {
  initial?: AskPayload;
  /** Prefilled fields for a new question (from a library document). */
  defaults?: Partial<AskPayload>;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  onSubmit: (payload: AskPayload) => Promise<void>;
}) {
  const editing = Boolean(initial);
  const profile = useQuery({ queryKey: ['student'], queryFn: studentService.me, enabled: !editing });
  const meta = useQuery({ queryKey: ['community', 'meta'], queryFn: communityService.meta, staleTime: 5 * 60_000 });

  const [title, setTitle] = React.useState(initial?.title ?? defaults?.title ?? '');
  const [body, setBody] = React.useState(initial?.body ?? defaults?.body ?? '');
  const [filiere, setFiliere] = React.useState(initial?.filiere ?? defaults?.filiere ?? '');
  const [subject, setSubject] = React.useState(initial?.subject ?? defaults?.subject ?? '');
  const [tags, setTags] = React.useState(initial?.tags.join(', ') ?? '');
  const [imageUrl, setImageUrl] = React.useState<string | undefined>(initial?.image_url);
  const [uploading, setUploading] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  // Default to the member's own filière once the profile arrives.
  React.useEffect(() => {
    if (profile.data?.filiere && !filiere) setFiliere(profile.data.filiere);
  }, [profile.data, filiere]);

  // Anti-doublons: show close matches while a new title is typed.
  const debouncedTitle = useDebounced(title.trim());
  const similar = useQuery({
    queryKey: ['community', 'similar', debouncedTitle],
    queryFn: () => communityService.questions({ q: debouncedTitle, sort: 'votes' }),
    enabled: !editing && debouncedTitle.length >= 10,
  });

  const tagList = tags
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return toast.error(`Photo trop lourde (${MAX_PHOTO_MB} Mo maximum).`);
    setUploading(true);
    try {
      const { image_url } = await communityService.uploadImage(file);
      setImageUrl(image_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Envoi de la photo impossible.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const problems = [
    title.trim().length < 10 && 'Le titre doit faire au moins 10 caractères.',
    body.trim().length < 20 && 'Détaillez votre question (20 caractères minimum).',
    filiere.trim().length < 2 && 'Choisissez une filière.',
    tagList.length > MAX_TAGS && `${MAX_TAGS} tags maximum.`,
  ].filter(Boolean) as string[];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (problems.length) return toast.error(problems[0]);
    if (uploading) return toast.info('Patientez, la photo est en cours d’envoi.');
    setPending(true);
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        filiere: filiere.trim(),
        subject: subject.trim() || undefined,
        tags: tagList,
        image_url: imageUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publication impossible.');
      setPending(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ex. Comment passer du MCD au MLD avec une association n,n ?"
        />
        {similar.data && similar.data.items.length > 0 && (
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-3">
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
          rows={9}
          maxLength={20000}
          placeholder={'Énoncé, ce que vous avez essayé, où vous bloquez.\nEntourez le code avec ``` pour le garder lisible.'}
        />
        <FormattingHint />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium text-ink-900">
          Photo de l’exercice <span className="font-normal text-ink-400">(facultatif)</span>
        </span>
        {imageUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin upload */}
            <img src={imageUrl} alt="Photo jointe" className="max-h-56 rounded-xl border border-ink-200 object-contain" />
            <button
              type="button"
              onClick={() => setImageUrl(undefined)}
              aria-label="Retirer la photo"
              className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-white shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 px-4 py-6 text-sm text-ink-600 transition hover:border-ink-900 hover:text-ink-900"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {uploading ? 'Envoi de la photo…' : 'Prendre ou choisir une photo'}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </label>
        )}
        <p className="text-xs text-ink-400">JPEG, PNG ou WebP, {MAX_PHOTO_MB} Mo max. La position GPS de la photo est supprimée.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="filiere">Filière</Label>
          <Input id="filiere" list="filieres" value={filiere} onChange={(e) => setFiliere(e.target.value)} maxLength={100} />
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
            placeholder="Bases de données"
          />
          <datalist id="subjects">
            {meta.data?.subjects.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags</Label>
        <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="merise, mcd, sql" />
        <p className="text-xs text-ink-400">Séparés par des virgules, {MAX_TAGS} maximum.</p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" asChild>
          <Link href={cancelHref}>Annuler</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
