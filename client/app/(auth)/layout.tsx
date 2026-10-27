import { Check } from 'lucide-react';

import { BackedByKortex } from '@/components/brand/backed-by-kortex';

const POINTS = [
  'Posez vos questions de cours et d’exercices',
  'Des réponses expliquées, votées par la communauté',
  'Toutes les filières du BTS, pas seulement la RIT',
  'Un labo virtuel 3D pour pratiquer, inclus',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900 text-white">
      {/* Faint glow, as on the Kortex auth screens. */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-10 sm:px-8 lg:grid-cols-2">
        <section className="hidden lg:block">
          <h1 className="font-display text-5xl font-semibold leading-[1.08] text-white">
            Bloqué sur un exercice ?{' '}
            <span className="text-white/55">Quelqu’un est déjà passé par là.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/70">
            STOUDENT réunit les étudiants et les professeurs de toutes les filières du BTS (IDA, RIT,
            ELT, SEI, MSP, Finance Comptabilité…) pour s’entraider, gratuitement.
          </p>
          <ul className="mt-10 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/85">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-12 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/75">
            Gratuit, pour toujours, pour l’entraide.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md">
          {children}
          <div className="mt-6 flex justify-center">
            <BackedByKortex onDark />
          </div>
        </section>
      </div>
    </div>
  );
}
