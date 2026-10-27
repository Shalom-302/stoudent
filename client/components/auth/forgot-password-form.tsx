'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 10;

/**
 * Two steps: the WhatsApp number, then the code received on WhatsApp with the
 * new password. Every session of the account is closed by the API afterwards.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const message = (caught: unknown) => (caught instanceof Error ? caught.message : 'Une erreur est survenue.');

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\+?\d[\d\s.-]{7,}$/.test(phone.trim())) return setError('Entrez votre numéro WhatsApp.');
    setPending(true);
    try {
      await authService.forgotPassword(phone.trim());
      setStep('reset');
      setInfo('Si un compte existe pour ce numéro, un code vient d’être envoyé sur WhatsApp.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPending(false);
    }
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH)
      return setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');
    setPending(true);
    try {
      await authService.resetPassword(phone.trim(), code.trim(), password);
      toast.success('Mot de passe changé. Connectez-vous avec le nouveau.');
      router.replace('/login');
    } catch (caught) {
      setError(message(caught));
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={step === 'phone' ? sendCode : reset}
      noValidate
      className="rounded-3xl bg-white p-6 text-ink-900 shadow-2xl ring-1 ring-ink-100 sm:p-8"
    >
      <Link href="/" className="mb-6 flex justify-center">
        <Logo size="lg" />
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-ink-500">
        {step === 'phone'
          ? 'Entrez le numéro WhatsApp de votre compte : vous recevrez un code.'
          : 'Saisissez le code reçu sur WhatsApp et choisissez un nouveau mot de passe.'}
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Numéro WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07 88 01 62 04"
            disabled={step === 'reset'}
          />
        </div>

        {step === 'reset' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code reçu sur WhatsApp</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="______"
                className="h-14 text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-ink-400">
                Au moins {MIN_PASSWORD_LENGTH} caractères, mélangeant deux types de caractères.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </>
        )}

        {info && (
          <p role="status" className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-800">
            {info}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending || (step === 'reset' && code.length < 4)}>
          {pending ? 'Un instant…' : step === 'phone' ? 'Recevoir un code' : 'Changer mon mot de passe'}
        </Button>

        <div className="flex items-center justify-between text-sm">
          {step === 'reset' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                  setInfo(null);
                }}
                className="text-ink-500 hover:text-ink-900 hover:underline"
              >
                ← Changer de numéro
              </button>
              <button
                type="button"
                onClick={() => void sendCode()}
                className="font-semibold text-ink-900 underline underline-offset-4"
              >
                Renvoyer le code
              </button>
            </>
          ) : (
            <Link href="/login" className="text-ink-500 hover:text-ink-900 hover:underline">
              ← Retour à la connexion
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
