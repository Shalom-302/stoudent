'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 10;
const message = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

/** Password, WhatsApp number and account deletion. Every change asks for the current password. */
export function AccountSettings({ phone }: { phone: string | null }) {
  return (
    <div className="space-y-6">
      <PasswordCard />
      <PhoneCard phone={phone} />
      <DeleteCard />
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) return toast.error(`Au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    if (next !== confirm) return toast.error('Les mots de passe ne correspondent pas.');
    setPending(true);
    try {
      await authService.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Mot de passe changé. Vos autres appareils ont été déconnectés.');
    } catch (error) {
      toast.error(message(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe</CardTitle>
        <CardDescription>Changer de mot de passe déconnecte vos autres appareils.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Actuel</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Nouveau</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirmer</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end sm:col-span-3">
            <Button type="submit" disabled={pending || !current || !next}>
              {pending ? 'Un instant…' : 'Changer le mot de passe'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PhoneCard({ phone }: { phone: string | null }) {
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<'idle' | 'code'>('idle');
  const [password, setPassword] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\+?\d[\d\s.-]{7,}$/.test(newPhone.trim())) return toast.error('Entrez un numéro WhatsApp valide.');
    setPending(true);
    try {
      await authService.startPhoneChange(password, newPhone.trim());
      setStep('code');
      toast.success('Un code a été envoyé sur WhatsApp au nouveau numéro.');
    } catch (error) {
      toast.error(message(error));
    } finally {
      setPending(false);
    }
  };

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await authService.confirmPhoneChange(newPhone.trim(), code.trim());
      setStep('idle');
      setPassword('');
      setNewPhone('');
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['student'] });
      toast.success('Numéro changé. Utilisez-le désormais pour vous connecter.');
    } catch (error) {
      toast.error(message(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Numéro WhatsApp</CardTitle>
        <CardDescription>
          {phone ? (
            <>
              Numéro actuel : <b className="text-ink-900">+{phone}</b>. Il sert à vous connecter et n’est jamais affiché.
            </>
          ) : (
            'Aucun numéro : ajoutez-en un pour vous connecter avec et pouvoir utiliser « Mot de passe oublié ».'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'idle' ? (
          <form onSubmit={start} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone-new">{phone ? 'Nouveau numéro' : 'Numéro WhatsApp'}</Label>
              <Input id="phone-new" type="tel" autoComplete="tel" placeholder="07 88 01 62 04" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone-password">Mot de passe actuel</Label>
              <Input id="phone-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={pending || !password || !newPhone}>
                {pending ? 'Envoi…' : 'Recevoir un code'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone-code">Code reçu sur WhatsApp au {newPhone}</Label>
              <Input
                id="phone-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 max-w-56 text-center text-xl tracking-[0.4em]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep('idle')}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending || code.length < 4}>
                Confirmer le numéro
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteCard() {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [sure, setSure] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await authService.deleteAccount(password);
      toast.success('Votre compte a été supprimé.');
      // Full reload: every cached query belonged to the deleted account.
      window.location.href = '/';
    } catch (error) {
      toast.error(message(error));
      setPending(false);
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle>Supprimer mon compte</CardTitle>
        <CardDescription>
          Votre numéro, votre pseudo et vos informations sont effacés. Vos questions et réponses restent, sous « Membre
          supprimé ».{' '}
          <Link href="/confidentialite" className="underline underline-offset-4">
            En savoir plus
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>
            Supprimer mon compte…
          </Button>
        ) : (
          <form onSubmit={remove} className="space-y-4">
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="delete-password">Mot de passe</Label>
              <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-ink-600">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-red-700" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              Je comprends que c’est définitif.
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="danger" disabled={pending || !password || !sure}>
                {pending ? 'Suppression…' : 'Supprimer définitivement'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
