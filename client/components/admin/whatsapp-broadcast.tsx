'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Clock, Search, Send, ShieldCheck, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BTS_FILIERES, timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import type { BroadcastAudience, BroadcastItem, BroadcastPayload } from '@/services/broadcast-types';
import { signManagerService, type ManagedStudent } from '@/services/signmanager';

const TEMPLATES = [
  {
    label: 'Nouvelle mise à jour',
    title: 'Nouvelle mise à jour sur STOUDENT',
    message: 'STOUDENT vient d’évoluer : ',
    link: '/',
  },
  {
    label: 'Nouveaux sujets et cours',
    title: 'Nouveaux sujets et cours dans la bibliothèque',
    message:
      'De nouveaux sujets d’examen, corrigés, cours et TD sont disponibles, rangés par filière et par épreuve. Va voir ceux de ta filière.',
    link: '/bibliotheque',
  },
  {
    label: 'Révisions d’examen',
    title: 'Révisions d’examen',
    message:
      'L’examen approche : révise avec les anciens sujets et leurs corrigés, et pose tes questions à la communauté si tu bloques.',
    link: '/bibliotheque',
  },
  { label: 'Message libre', title: '', message: '', link: '' },
] as const;

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'filiere', label: 'Une filière' },
  { value: 'members', label: 'Membres choisis' },
];

const STATUS_LABEL: Record<BroadcastItem['status'], string> = {
  queued: 'En attente',
  sending: 'En cours',
  done: 'Terminé',
  failed: 'Arrêté',
};

function duration(seconds: number): string {
  if (seconds < 60) return 'moins d’une minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Debounce a value so the preview is not recomputed on every keystroke. */
function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * WhatsApp announcements to members who accepted STOUDENT news on WhatsApp.
 * The server only ever sends to consenting members, one message at a time
 * with pauses, so the gowa number is not flagged as spam.
 */
export function WhatsAppBroadcast() {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState<string>(TEMPLATES[0].title);
  const [message, setMessage] = React.useState<string>(TEMPLATES[0].message);
  const [link, setLink] = React.useState<string>(TEMPLATES[0].link);
  const [audience, setAudience] = React.useState<BroadcastAudience>('all');
  const [filiere, setFiliere] = React.useState('');
  const [members, setMembers] = React.useState<ManagedStudent[]>([]);
  const [confirming, setConfirming] = React.useState(false);

  const payload: BroadcastPayload = {
    title: title.trim(),
    message: message.trim(),
    link: link.trim() || undefined,
    audience,
    filiere: audience === 'filiere' ? filiere : undefined,
    user_x_ids: audience === 'members' ? members.map((m) => m.user_x_id) : undefined,
  };
  const ready =
    payload.title.length >= 3 &&
    payload.message.length >= 5 &&
    (audience !== 'filiere' || Boolean(filiere)) &&
    (audience !== 'members' || members.length > 0);
  const debounced = useDebounced(payload);

  const preview = useQuery({
    queryKey: ['signmanager', 'broadcast-preview', debounced],
    queryFn: () => signManagerService.broadcastPreview(debounced),
    enabled: ready,
    placeholderData: (previous) => previous,
  });
  const history = useQuery({
    queryKey: ['signmanager', 'broadcasts'],
    queryFn: signManagerService.broadcasts,
    refetchInterval: (query) =>
      query.state.data?.items.some((b) => b.status === 'queued' || b.status === 'sending') ? 5000 : false,
  });
  const active = history.data?.items.find((b) => b.status === 'queued' || b.status === 'sending');

  const send = useMutation({
    mutationFn: () => signManagerService.broadcast(payload),
    onSuccess: (data) => {
      toast.success(`Envoi lancé vers ${data.recipients} membre(s), durée estimée ${duration(data.estimated_seconds)}.`);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['signmanager', 'broadcasts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirming(false);
    },
  });

  const recipients = preview.data?.recipients ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Envoyer une annonce WhatsApp</CardTitle>
          <CardDescription>
            Seuls les membres qui ont accepté les infos STOUDENT sur WhatsApp la reçoivent. Les messages partent un par
            un, avec des pauses, pour protéger le numéro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Modèle</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setTitle(t.title);
                    setMessage(t.message);
                    setLink(t.link);
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs',
                    title === t.title && message === t.message
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-ink-200 text-ink-700 hover:border-ink-900',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-title">Titre</Label>
            <Input id="bc-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bc-message">Message</Label>
              <span className="text-[11px] text-ink-400">{message.length}/600</span>
            </div>
            <Textarea id="bc-message" rows={5} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-link">Lien (facultatif)</Label>
            <Input
              id="bc-link"
              maxLength={300}
              placeholder="/bibliotheque ou https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Destinataires</Label>
            <div className="flex w-fit rounded-xl border border-ink-200 p-0.5" role="tablist" aria-label="Audience">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  role="tab"
                  aria-selected={audience === a.value}
                  onClick={() => setAudience(a.value)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium',
                    audience === a.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {audience === 'filiere' && (
              <select
                aria-label="Filière"
                value={filiere}
                onChange={(e) => setFiliere(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-2 text-sm sm:w-72"
              >
                <option value="">Choisir une filière…</option>
                {BTS_FILIERES.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} · {f.name}
                  </option>
                ))}
              </select>
            )}
            {audience === 'members' && <MemberPicker selected={members} onChange={setMembers} />}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-[#e5ddd5] p-3">
              <div className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 text-[13px] leading-snug text-ink-900 shadow-sm">
                {ready && preview.data ? preview.data.text : 'Remplissez le titre, le message et les destinataires.'}
              </div>
            </div>

            {ready && preview.data && (
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <b>{preview.data.recipients}</b> membre{preview.data.recipients > 1 ? 's' : ''} recevront le message
                </p>
                {preview.data.excluded > 0 && (
                  <p className="text-ink-500">
                    {preview.data.excluded} membre{preview.data.excluded > 1 ? 's' : ''} n’
                    {preview.data.excluded > 1 ? 'ont' : 'a'} pas donné leur accord : ils ne recevront rien.
                  </p>
                )}
                {preview.data.consenting > preview.data.max_recipients && (
                  <p className="text-ink-500">
                    Plafond de {preview.data.max_recipients} destinataires par envoi : les suivants ne seront pas
                    contactés cette fois.
                  </p>
                )}
                {preview.data.recipients > 0 && (
                  <p className="flex items-center gap-2 text-ink-500">
                    <Clock className="h-4 w-4" aria-hidden /> Durée estimée : {duration(preview.data.estimated_seconds)}
                  </p>
                )}
                {!preview.data.gowa_ready && (
                  <p className="flex items-start gap-2 text-[var(--color-danger)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    WhatsApp (gowa) n’est pas configuré sur ce serveur : l’envoi sera refusé.
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!ready || !recipients || Boolean(active) || send.isPending}
              onClick={() => setConfirming(true)}
            >
              <Send /> {active ? 'Un envoi est en cours…' : `Envoyer à ${recipients} membre${recipients > 1 ? 's' : ''}`}
            </Button>
          </CardContent>
        </Card>

        <BroadcastHistory items={history.data?.items ?? []} />
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer à {recipients} membre{recipients > 1 ? 's' : ''} ?</DialogTitle>
            <DialogDescription>
              Le message part sur WhatsApp, un par un, pendant {duration(preview.data?.estimated_seconds ?? 0)}. Un
              message envoyé ne peut pas être retiré.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? 'Lancement…' : 'Confirmer l’envoi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberPicker({
  selected,
  onChange,
}: {
  selected: ManagedStudent[];
  onChange: (members: ManagedStudent[]) => void;
}) {
  const [search, setSearch] = React.useState('');
  const term = useDebounced(search.trim(), 300);
  const results = useQuery({
    queryKey: ['signmanager', 'broadcast-members', term],
    queryFn: () => signManagerService.students({ search: term, size: 8 }),
    enabled: term.length >= 2,
  });
  const chosen = new Set(selected.map((m) => m.user_x_id));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((m) => (
            <li key={m.user_x_id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.user_x_id !== m.user_x_id))}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                  m.whatsapp_opt_in ? 'border-ink-900' : 'border-dashed border-ink-300 text-ink-400 line-through',
                )}
                title={m.whatsapp_opt_in ? 'Retirer' : 'Pas d’accord WhatsApp : ne recevra rien'}
              >
                {m.pseudo ?? m.phone} <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pseudo ou numéro…"
          className="pl-9"
          aria-label="Rechercher un membre"
        />
      </div>
      {term.length >= 2 && (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 sm:w-80">
          {results.data?.items.length === 0 && <li className="px-3 py-2 text-xs text-ink-500">Aucun membre.</li>}
          {results.data?.items.map((m) => (
            <li key={m.user_x_id}>
              <button
                type="button"
                disabled={chosen.has(m.user_x_id)}
                onClick={() => onChange([...selected, m])}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 disabled:opacity-50"
              >
                <span className="min-w-0 truncate">
                  {m.pseudo ?? '—'} <span className="text-xs text-ink-400">{m.filiere ?? ''}</span>
                </span>
                {m.whatsapp_opt_in ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-700">
                    <Check className="h-3 w-3" /> accord
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-400">pas d’accord</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BroadcastHistory({ items }: { items: BroadcastItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Derniers envois</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 && <p className="text-sm text-ink-500">Aucun envoi pour l’instant.</p>}
        <ul className="space-y-4">
          {items.map((b) => {
            const done = b.sent + b.failed;
            const pct = b.recipients ? Math.round((done / b.recipients) * 100) : 0;
            return (
              <li key={b.x_id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{b.message.split('\n')[0].replace(/^STOUDENT · /, '')}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      b.status === 'failed' ? 'bg-[var(--color-danger)] text-white' : 'bg-ink-100 text-ink-700',
                    )}
                  >
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full bg-ink-900 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {b.sent} envoyé{b.sent > 1 ? 's' : ''}
                  {b.failed > 0 && `, ${b.failed} échec${b.failed > 1 ? 's' : ''}`} sur {b.recipients} ·{' '}
                  {b.audience === 'all' ? 'tous' : b.audience === 'filiere' ? b.filiere : 'membres choisis'} ·{' '}
                  {timeAgo(b.created_time)}
                </p>
                {b.error && <p className="mt-1 text-xs text-[var(--color-danger)]">{b.error}</p>}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
