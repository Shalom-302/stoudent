/**
 * Calcul du signal affiche par les instruments.
 *
 * Dans la version finale, ce calcul part vers FastAPI / NumPy (section 25).
 * Ici il tourne cote client pour que la maquette reste autonome : la forme
 * des donnees est volontairement celle qu'une API renverrait.
 */

export type Waveform = 'sine' | 'square' | 'triangle';

export const HARMONICS = [1, 3, 5, 7, 9] as const;
export type Harmonic = (typeof HARMONICS)[number];

export interface SignalSettings {
  waveform: Waveform;
  /** Frequence fondamentale en Hz. */
  frequency: number;
  /** Amplitude crete en volts. */
  amplitude: number;
  /** Offset continu en volts. */
  offset: number;
  /** Harmoniques retenues dans la reconstruction (TP 02 — serie de Fourier). */
  harmonics: Record<Harmonic, boolean>;
}

export const DEFAULT_SIGNAL: SignalSettings = {
  waveform: 'square',
  frequency: 1000,
  amplitude: 2,
  offset: 0,
  harmonics: { 1: true, 3: true, 5: true, 7: false, 9: false },
};

export const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: 'Sinus',
  square: 'Carre',
  triangle: 'Triangle',
};

/** Coefficient de l'harmonique n pour la forme d'onde demandee. */
function coefficient(waveform: Waveform, n: number): number {
  if (waveform === 'sine') return n === 1 ? 1 : 0;
  if (waveform === 'square') return n % 2 === 1 ? (4 / Math.PI) / n : 0;
  // triangle
  if (n % 2 === 0) return 0;
  const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
  return (sign * 8) / (Math.PI * Math.PI * n * n);
}

/** Valeur du signal reconstruit a l'instant t (secondes). */
export function sampleAt(t: number, s: SignalSettings): number {
  let v = 0;
  for (const n of HARMONICS) {
    if (!s.harmonics[n]) continue;
    v += coefficient(s.waveform, n) * Math.sin(2 * Math.PI * n * s.frequency * t);
  }
  return s.amplitude * v + s.offset;
}

/** Trace temporelle sur `periods` periodes, normalisee en volts. */
export function trace(s: SignalSettings, periods = 2, points = 512): number[] {
  const period = 1 / s.frequency;
  const out: number[] = new Array(points);
  for (let i = 0; i < points; i++) {
    out[i] = sampleAt((i / (points - 1)) * periods * period, s);
  }
  return out;
}

export interface SpectrumLine {
  harmonic: Harmonic;
  frequency: number;
  amplitude: number;
  active: boolean;
}

/** Raies du spectre — ce qu'affiche l'analyseur du poste D. */
export function spectrum(s: SignalSettings): SpectrumLine[] {
  return HARMONICS.map((n) => ({
    harmonic: n,
    frequency: n * s.frequency,
    amplitude: Math.abs(coefficient(s.waveform, n)) * s.amplitude,
    active: s.harmonics[n],
  }));
}

/** Pleine echelle verticale conseillee pour le trace (V/div lisible). */
export function fullScale(s: SignalSettings): number {
  const peak = Math.max(...trace(s, 1, 256).map(Math.abs));
  return Math.max(peak * 1.25, 0.5);
}

export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(2)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}
