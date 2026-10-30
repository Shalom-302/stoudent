'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MessageCircleQuestion, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EquipmentType } from '@/lib/terrain/city';
import { SITE_CONTENT, type QuizItem } from '@/lib/terrain/sites';
import { cn } from '@/lib/utils';
import { signalService, type FibreDropInput, type MicrowaveLinkInput } from '@/services/signals';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-700">{label}</span>
        <span className="font-mono text-ink-900">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={o === value}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            o === value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-900',
          )}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

function Results({ rows, verdict, ok }: { rows: [string, string][]; verdict: string; ok: boolean }) {
  return (
    <div className="mt-4 rounded-xl border border-ink-200 p-3">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-ink-500">{label}</dt>
            <dd className="text-right font-mono text-ink-900">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className={cn('mt-3 flex items-start gap-1.5 text-sm font-medium', ok ? 'text-success' : 'text-red-700')}>
        {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
        {verdict}
      </p>
    </div>
  );
}

const db = (v: number) => `${v.toFixed(1)} dB`;
const dbm = (v: number) => `${v.toFixed(1)} dBm`;

/**
 * The link between the two towers drawn to scale vertically: towers, the
 * Sigma building and the first Fresnel zone around the line of sight.
 */
function LinkProfile({ height, obstacle, radius, ok }: { height: number; obstacle: number; radius: number; ok: boolean }) {
  const W = 320;
  const H = 150;
  const top = 70; // metres shown
  const y = (m: number) => H - 12 - (m / top) * (H - 24);
  const scale = (H - 24) / top;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full rounded-lg bg-[#eef5fa]" role="img" aria-label="Profil de la liaison">
      <rect x={0} y={H - 12} width={W} height={12} fill="#c9a77c" />
      <ellipse
        cx={W / 2}
        cy={y(height)}
        rx={W / 2 - 24}
        ry={Math.max(radius * scale, 1)}
        fill={ok ? '#21b36b' : '#e0442c'}
        fillOpacity={0.15}
        stroke={ok ? '#21b36b' : '#e0442c'}
        strokeDasharray="4 3"
      />
      <rect x={W / 2 - 18} y={y(obstacle)} width={36} height={H - 12 - y(obstacle)} fill="#9aa5ae" />
      <text x={W / 2} y={y(obstacle) - 4} textAnchor="middle" fontSize={9} fill="#3a4148">
        Sigma {obstacle} m
      </text>
      {[24, W - 24].map((x) => (
        <g key={x}>
          <line x1={x} y1={H - 12} x2={x} y2={y(height)} stroke="#6f7a83" strokeWidth={3} />
          <circle cx={x} cy={y(height)} r={4} fill="#f4f4f1" stroke="#3a4148" />
        </g>
      ))}
      <line x1={24} y1={y(height)} x2={W - 24} y2={y(height)} stroke={ok ? '#21b36b' : '#e0442c'} strokeWidth={1.5} />
      <text x={24} y={y(height) - 8} fontSize={9} fill="#3a4148">
        A {height} m
      </text>
      <text x={W - 24} y={y(height) - 8} fontSize={9} textAnchor="end" fill="#3a4148">
        B {height} m
      </text>
    </svg>
  );
}

const OBSTACLE = 24;

function MicrowaveMission({ onResult }: { onResult: (up: boolean, success: boolean) => void }) {
  // The mission starts broken: 25 m towers barely see over a 24 m building.
  const [params, setParams] = React.useState({ height: 25, frequency: 15, dish: 0.6, distance: 10 });
  const input: Partial<MicrowaveLinkInput> = {
    frequency_ghz: params.frequency,
    distance_km: params.distance,
    dish_diameter_m: params.dish,
    height_a_m: params.height,
    height_b_m: params.height,
    obstacle_height_m: OBSTACLE,
  };
  const debounced = useDebounced(input);
  const result = useQuery({
    queryKey: ['terrain', 'microwave', debounced],
    queryFn: () => signalService.microwaveLink(debounced),
    placeholderData: (previous) => previous,
  });
  const r = result.data;
  const success = Boolean(r && r.link_up && r.fade_margin_db >= 20);

  React.useEffect(() => {
    if (r) onResult(r.link_up, success);
  }, [r, success, onResult]);

  return (
    <div>
      <p className="text-sm text-ink-700">
        <b>Mission :</b> la liaison entre le pylône A et le pylône B passe au-dessus de l’immeuble Sigma (24 m).
        Rétablis-la avec <b>au moins 20 dB de marge</b> contre la pluie.
      </p>
      {r && <LinkProfile height={params.height} obstacle={OBSTACLE} radius={r.fresnel_radius_m} ok={r.fresnel_clear} />}
      <div className="mt-4 space-y-4">
        <Field label="Hauteur des antennes" value={`${params.height} m`}>
          <Slider min={15} max={60} step={1} value={[params.height]} onValueChange={([v]) => setParams((p) => ({ ...p, height: v }))} />
        </Field>
        <Field label="Distance A → B" value={`${params.distance} km`}>
          <Slider min={2} max={40} step={1} value={[params.distance]} onValueChange={([v]) => setParams((p) => ({ ...p, distance: v }))} />
        </Field>
        <Field label="Fréquence" value={`${params.frequency} GHz`}>
          <Choice options={[7, 15, 23, 38] as const} value={params.frequency as 7} onChange={(v) => setParams((p) => ({ ...p, frequency: v }))} format={(v) => `${v} GHz`} />
        </Field>
        <Field label="Diamètre des paraboles" value={`${params.dish} m`}>
          <Choice options={[0.3, 0.6, 1.2, 1.8] as const} value={params.dish as 0.3} onChange={(v) => setParams((p) => ({ ...p, dish: v }))} format={(v) => `${v} m`} />
        </Field>
      </div>
      {result.isError && <p className="mt-3 text-sm text-red-700">{(result.error as Error).message}</p>}
      {r && (
        <Results
          ok={success}
          verdict={success ? `${r.verdict} Mission réussie !` : r.verdict}
          rows={[
            ['Affaiblissement espace libre', db(r.free_space_loss_db)],
            ['Gain d’une parabole', `${r.dish_gain_dbi.toFixed(1)} dBi`],
            ['Niveau reçu', dbm(r.received_dbm)],
            ['Marge (sensibilité −80 dBm)', db(r.fade_margin_db)],
            ['Rayon de Fresnel au milieu', `${r.fresnel_radius_m.toFixed(1)} m`],
            ['Dégagement de la zone', `${Math.round(r.clearance_ratio * 100)} %`],
            ...(r.raise_towers_by_m > 0 ? ([['Il manque', `${r.raise_towers_by_m} m de hauteur`]] as [string, string][]) : []),
          ]}
        />
      )}
      <p className="mt-2 text-[11px] text-ink-400">
        Calculé par le moteur scientifique : émission 20 dBm, pertes 3 dB, sol plat, k = 4/3.
      </p>
    </div>
  );
}

const SPLITS: { label: string; value: number[] }[] = [
  { label: '1:8', value: [8] },
  { label: '1:8 + 1:8', value: [8, 8] },
  { label: '1:16 + 1:4', value: [16, 4] },
  { label: '1:32', value: [32] },
  { label: '1:32 + 1:4', value: [32, 4] },
  { label: '1:64', value: [64] },
];

function FibreMission({ onResult }: { onResult: (up: boolean, success: boolean) => void }) {
  // Starts over budget: 128 subscribers on a long drop.
  const [params, setParams] = React.useState({ length: 15, wavelength: 1490 as 1310 | 1490 | 1550, split: 4, splices: 8 });
  const input: Partial<FibreDropInput> = {
    length_km: params.length,
    wavelength_nm: params.wavelength,
    splitters: SPLITS[params.split].value,
    splices: params.splices,
    connectors: 4,
  };
  const debounced = useDebounced(input);
  const result = useQuery({
    queryKey: ['terrain', 'fibre', debounced],
    queryFn: () => signalService.fibreDrop(debounced),
    placeholderData: (previous) => previous,
  });
  const r = result.data;
  const success = Boolean(r && r.link_up && r.subscribers_per_port >= 64 && r.margin_db >= 3);

  React.useEffect(() => {
    if (r) onResult(r.link_up, success);
  }, [r, success, onResult]);

  return (
    <div>
      <p className="text-sm text-ink-700">
        <b>Mission :</b> raccorde <b>au moins 64 abonnés</b> sur un port GPON, avec <b>3 dB de marge</b> minimum
        (box classe B+ : sensibilité −28 dBm, OLT à +3 dBm).
      </p>
      <div className="mt-4 space-y-4">
        <Field label="Longueur NRO → abonné" value={`${params.length} km`}>
          <Slider min={0.5} max={20} step={0.5} value={[params.length]} onValueChange={([v]) => setParams((p) => ({ ...p, length: v }))} />
        </Field>
        <Field label="Soudures sur le parcours" value={String(params.splices)}>
          <Slider min={0} max={20} step={1} value={[params.splices]} onValueChange={([v]) => setParams((p) => ({ ...p, splices: v }))} />
        </Field>
        <Field label="Coupleurs" value={SPLITS[params.split].label}>
          <Choice options={SPLITS.map((_, i) => i)} value={params.split} onChange={(v) => setParams((p) => ({ ...p, split: v }))} format={(i) => SPLITS[i].label} />
        </Field>
        <Field label="Longueur d’onde descendante" value={`${params.wavelength} nm`}>
          <Choice options={[1310, 1490, 1550] as const} value={params.wavelength} onChange={(v) => setParams((p) => ({ ...p, wavelength: v }))} format={(v) => `${v} nm`} />
        </Field>
      </div>
      {result.isError && <p className="mt-3 text-sm text-red-700">{(result.error as Error).message}</p>}
      {r && (
        <Results
          ok={success}
          verdict={success ? `${r.verdict} Mission réussie !` : r.link_up && r.subscribers_per_port < 64 ? `Ça passe, mais seulement ${r.subscribers_per_port} abonnés : il en faut 64.` : r.verdict}
          rows={[
            ['Fibre', `${db(r.fibre_loss_db)} (${r.attenuation_db_per_km} dB/km)`],
            ['Soudures', db(r.splice_loss_db)],
            ['Connecteurs (4)', db(r.connector_loss_db)],
            ['Coupleurs', db(r.splitter_loss_db)],
            ['Perte totale', db(r.total_loss_db)],
            ['Niveau reçu à la box', dbm(r.received_dbm)],
            ['Marge', db(r.margin_db)],
            ['Abonnés par port', String(r.subscribers_per_port)],
          ]}
        />
      )}
      <p className="mt-2 text-[11px] text-ink-400">Calculé par le moteur scientifique : 0,1 dB par soudure, 0,5 dB par connecteur.</p>
    </div>
  );
}

function Quiz({ items, onPassed }: { items: QuizItem[]; onPassed: () => void }) {
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => items.map(() => null));
  const done = answers.every((a) => a !== null);
  const score = answers.filter((a, i) => a === items[i].answer).length;
  React.useEffect(() => {
    if (done && score === items.length) onPassed();
  }, [done, score, items.length, onPassed]);

  return (
    <ol className="space-y-5">
      {items.map((item, i) => {
        const chosen = answers[i];
        return (
          <li key={item.question}>
            <p className="text-sm font-medium text-ink-900">
              {i + 1}. {item.question}
            </p>
            <div className="mt-2 space-y-1.5">
              {item.options.map((option, o) => {
                const right = chosen !== null && o === item.answer;
                const wrong = chosen === o && o !== item.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={chosen !== null}
                    onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? o : x)))}
                    className={cn(
                      'block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      right
                        ? 'border-success bg-success/10 text-ink-900'
                        : wrong
                          ? 'border-red-600 bg-red-50 text-ink-900'
                          : 'border-ink-200 text-ink-700 hover:border-ink-900 disabled:hover:border-ink-200',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {chosen !== null && <p className="mt-1.5 text-xs text-ink-500">{item.explain}</p>}
          </li>
        );
      })}
      {done && (
        <p className={cn('text-sm font-semibold', score === items.length ? 'text-success' : 'text-ink-700')}>
          {score}/{items.length} {score === items.length ? '— site maîtrisé !' : '— relis la fiche et réessaie plus tard.'}
        </p>
      )}
    </ol>
  );
}

export interface SiteProgress {
  mission: boolean;
  quiz: boolean;
}

/** What a site is, its calculation and its quiz, over the scene. */
export function SitePanel({
  site,
  progress,
  onClose,
  onMission,
  onQuiz,
  onBeam,
}: {
  site: EquipmentType;
  progress: SiteProgress;
  onClose: () => void;
  onMission: () => void;
  onQuiz: () => void;
  onBeam: (status: 'up' | 'down') => void;
}) {
  const content = SITE_CONTENT[site];
  const onResult = React.useCallback(
    (up: boolean, success: boolean) => {
      if (site === 'fh') onBeam(up ? 'up' : 'down');
      if (success) onMission();
    },
    [site, onBeam, onMission],
  );
  const ask = `/questions/ask?filiere=RIT&subject=${encodeURIComponent(content.subject)}`;

  return (
    <aside
      className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-2xl border border-ink-200 bg-white p-4 shadow-2xl sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[420px] sm:rounded-2xl sm:p-5"
      aria-label={content.title}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">Labo Terrain · RIT</p>
          <h2 className="mt-0.5 font-display text-xl font-semibold leading-tight text-ink-900">{content.title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {content.mission && <Badge variant={progress.mission ? 'success' : 'outline'}>{progress.mission ? 'Mission réussie' : 'Mission'}</Badge>}
            <Badge variant={progress.quiz ? 'success' : 'outline'}>{progress.quiz ? 'Quiz réussi' : 'Quiz'}</Badge>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-900">
          <X className="h-5 w-5" />
        </button>
      </div>

      <Tabs defaultValue="learn" className="mt-4">
        <TabsList>
          <TabsTrigger value="learn">Découvrir</TabsTrigger>
          {content.mission && <TabsTrigger value="mission">Mission</TabsTrigger>}
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="learn" className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-ink-700">{content.intro}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Ce que tu vois</p>
            <ul className="mt-2 space-y-2">
              {content.parts.map((part) => (
                <li key={part.name} className="text-sm">
                  <b className="text-ink-900">{part.name}</b> <span className="text-ink-600">— {part.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Chiffres clés</p>
            <dl className="mt-2 space-y-1.5">
              {content.figures.map((f) => (
                <div key={f.label} className="flex flex-wrap justify-between gap-x-3 text-sm">
                  <dt className="text-ink-500">{f.label}</dt>
                  <dd className="font-medium text-ink-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsContent>

        {content.mission && (
          <TabsContent value="mission" className="mt-4">
            {content.mission === 'microwave' ? <MicrowaveMission onResult={onResult} /> : <FibreMission onResult={onResult} />}
          </TabsContent>
        )}

        <TabsContent value="quiz" className="mt-4">
          <Quiz items={content.quiz} onPassed={onQuiz} />
        </TabsContent>
      </Tabs>

      <Button variant="outline" size="sm" className="mt-5 w-full" asChild>
        <Link href={ask}>
          <MessageCircleQuestion className="h-4 w-4" /> Une question sur ce site ? Demande à la communauté
        </Link>
      </Button>
    </aside>
  );
}
