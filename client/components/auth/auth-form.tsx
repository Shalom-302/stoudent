'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError } from '@/lib/api';
import { FILIERES, LEVELS } from '@/lib/community';
import { cn } from '@/lib/utils';
import { authService, OTP_REQUIRED_PREFIX } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 10;
const OTHER = '__other__';

interface AuthFormProps {
  mode: 'login' | 'register';
}

const selectClass =
  'flex h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

/**
 * Sign-up / sign-in, ported from the shaapi flow: the WhatsApp number is the
 * identifier and, when the API has the code gate on, a 6-digit code sent on
 * WhatsApp activates the account.
 *
 * Client-side checks only save a round trip; the server enforces the same
 * rules and is the one that decides.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { login, register } = useAuth();
  const isRegister = mode === 'register';

  const [identifier, setIdentifier] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [pseudo, setPseudo] = React.useState('');
  const [filiere, setFiliere] = React.useState('');
  const [otherFiliere, setOtherFiliere] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [level, setLevel] = React.useState('');
  const [memberType, setMemberType] = React.useState<'student' | 'teacher'>('student');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Set when the API asks for the WhatsApp code: we switch to that screen.
  const [otpPhone, setOtpPhone] = React.useState('');

  const finish = () => {
    const next = params.get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/questions');
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const chosenFiliere = filiere === OTHER ? otherFiliere.trim() : filiere;

    if (isRegister) {
      if (!/^\+?\d[\d\s.-]{7,}$/.test(phone.trim()))
        return setError('Entrez un numéro WhatsApp valide (indicatif + numéro).');
      if (!/^[\p{L}\p{N}._-]{3,30}$/u.test(pseudo.trim()))
        return setError('Pseudo : 3 à 30 caractères, lettres, chiffres, « . », « _ » ou « - ».');
      if (chosenFiliere.length < 2) return setError('Indiquez votre filière.');
      if (password.length < MIN_PASSWORD_LENGTH)
        return setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');
      if (!terms) return setError('Acceptez les règles de la communauté pour continuer.');
    }

    setPending(true);
    try {
      if (isRegister) {
        const challenge = await register({
          phone: phone.trim(),
          pseudo: pseudo.trim(),
          password,
          filiere: chosenFiliere,
          institution: institution.trim() || undefined,
          level: level || undefined,
          member_type: memberType,
        });
        if (challenge) {
          setOtpPhone(challenge.phone);
          return;
        }
        toast.success('Compte créé. Bienvenue sur STOUDENT !');
      } else {
        await login(identifier.trim(), password);
        toast.success('Connexion réussie.');
      }
      finish();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Une erreur inattendue est survenue.';
      // Login of an account whose WhatsApp code was never entered.
      if (!isRegister && message.startsWith(OTP_REQUIRED_PREFIX) && !identifier.includes('@')) {
        setOtpPhone(identifier.trim());
        return;
      }
      if (caught instanceof ApiError && caught.status === 429) {
        setError('Trop de tentatives. Patientez quelques minutes puis réessayez.');
      } else {
        setError(message.replace(`${OTP_REQUIRED_PREFIX}: `, ''));
      }
    } finally {
      setPending(false);
    }
  };

  if (otpPhone) {
    return (
      <OtpScreen
        phone={otpPhone}
        onVerified={() => {
          toast.success('Compte vérifié. Bienvenue sur STOUDENT !');
          finish();
        }}
        onBack={() => {
          setOtpPhone('');
          setError(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink-100 sm:p-8">
      <Link href="/" className="mb-6 flex justify-center">
        <Logo size="lg" />
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900">
        {isRegister ? 'Rejoindre la communauté' : 'Bon retour parmi nous'}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {isRegister
          ? 'Posez vos questions, aidez les autres. C’est gratuit.'
          : 'Connectez-vous avec votre numéro WhatsApp.'}
      </p>

      <div className="mt-6 space-y-4">
        {isRegister ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Numéro WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07 88 01 62 04"
              />
              <p className="text-xs text-ink-400">
                Il sert à vous connecter. Ex. 07 88 01 62 04 (Côte d’Ivoire) ou +33 6… à l’étranger.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pseudo">Pseudo public</Label>
              <Input
                id="pseudo"
                autoComplete="username"
                required
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="kouadio.rit"
              />
              <p className="text-xs text-ink-400">Affiché sur vos questions et vos réponses.</p>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink-900">Je suis</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'teacher'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMemberType(value)}
                    aria-pressed={memberType === value}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      memberType === value
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                    )}
                  >
                    {value === 'student' ? 'Étudiant·e' : 'Professeur·e'}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="filiere">Filière</Label>
              <select
                id="filiere"
                required
                value={filiere}
                onChange={(e) => setFiliere(e.target.value)}
                className={selectClass}
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {FILIERES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value={OTHER}>Autre filière…</option>
              </select>
              {filiere === OTHER && (
                <Input
                  aria-label="Nom de votre filière"
                  value={otherFiliere}
                  onChange={(e) => setOtherFiliere(e.target.value)}
                  placeholder="Nom de votre filière"
                  maxLength={100}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="institution">
                  Établissement <span className="font-normal text-ink-400">(facultatif)</span>
                </Label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="level">
                  Niveau <span className="font-normal text-ink-400">(facultatif)</span>
                </Label>
                <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Numéro WhatsApp</Label>
            <Input
              id="identifier"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="07 88 01 62 04"
            />
            <p className="text-xs text-ink-400">Ancien compte SignalLab ? Votre e-mail fonctionne aussi.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isRegister && (
            <p className="text-xs text-ink-400">
              Au moins {MIN_PASSWORD_LENGTH} caractères, mélangeant deux types de caractères.
            </p>
          )}
        </div>
        {isRegister && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmer le mot de passe</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}
        {isRegister && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-500">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ink-900"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            <span>
              J’accepte les{' '}
              <Link href="/regles" target="_blank" className="font-semibold text-ink-900 underline underline-offset-4">
                règles de la communauté
              </Link>
              .
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Un instant…' : isRegister ? 'Créer mon compte' : 'Se connecter'}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-ink-500">
        {isRegister ? 'Déjà membre ? ' : 'Pas encore de compte ? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-semibold text-ink-900 underline underline-offset-4"
        >
          {isRegister ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
    </form>
  );
}

function OtpScreen({ phone, onVerified, onBack }: { phone: string; onVerified: () => void; onBack: () => void }) {
  const { verifyOtp } = useAuth();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      await verifyOtp(phone, code.trim());
      onVerified();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vérification impossible.');
      setPending(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await authService.resendOtp(phone);
      setInfo('Un nouveau code a été envoyé sur WhatsApp.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Envoi impossible.');
    }
  };

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink-100 sm:p-8">
      <Link href="/" className="mb-6 flex justify-center">
        <Logo size="lg" />
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900">Vérifiez votre numéro</h1>
      <p className="mt-1 text-sm text-ink-500">
        Un code vous a été envoyé sur WhatsApp au <b className="text-ink-900">+{phone}</b>.
      </p>
      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otp">Code de vérification</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="______"
            className="h-14 text-center text-2xl tracking-[0.4em]"
          />
        </div>
        {info && (
          <p role="status" className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-sm text-ink-800">
            {info}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending || code.length < 4}>
          {pending ? 'Vérification…' : 'Valider'}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="text-ink-500 hover:text-ink-900 hover:underline">
            ← Retour
          </button>
          <button type="button" onClick={() => void resend()} className="font-semibold text-ink-900 underline underline-offset-4">
            Renvoyer le code
          </button>
        </div>
      </div>
    </form>
  );
}
