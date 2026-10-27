/**
 * Translation layer between a TP's saved parameters and what the room shows.
 *
 * The backend stores the bench state as free-form JSON (`parameters`), the 3D
 * instruments render a `SignalSettings`. Keeping the mapping in one file means
 * the room never guesses at an experiment's vocabulary, and adding a TP is one
 * entry here rather than a conditional in every component.
 */
import { DEFAULT_SIGNAL, HARMONICS, type Harmonic, type SignalSettings, type Waveform } from './signal';

const WAVEFORMS: Record<string, Waveform> = {
  sine: 'sine',
  square: 'square',
  triangle: 'triangle',
  // The room's instruments only synthesise these three; a sawtooth reads close
  // enough to a triangle on a 3D screen seen from 0.8 m.
  sawtooth: 'triangle',
};

function num(parameters: Record<string, unknown>, key: string, fallback: number): number {
  const raw = parameters[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Bench parameters -> what the 3D screens display. */
export function signalFromParameters(parameters: Record<string, unknown>): SignalSettings {
  const type = typeof parameters.signal_type === 'string' ? parameters.signal_type : 'square';
  const nHarmonics = Math.round(num(parameters, 'n_harmonics', 9));

  const harmonics = HARMONICS.reduce(
    (acc, n) => {
      acc[n] = n <= nHarmonics;
      return acc;
    },
    {} as Record<Harmonic, boolean>,
  );

  return {
    waveform: WAVEFORMS[type] ?? DEFAULT_SIGNAL.waveform,
    frequency: num(parameters, 'frequency', DEFAULT_SIGNAL.frequency),
    amplitude: num(parameters, 'amplitude', DEFAULT_SIGNAL.amplitude),
    offset: num(parameters, 'offset', 0),
    harmonics,
  };
}

/** Which knobs a given TP puts on the bench. */
export interface KnobSpec {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  log?: boolean;
  hint?: string;
}

export interface ChoiceSpec {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface BenchControls {
  choices: ChoiceSpec[];
  knobs: KnobSpec[];
}

const WAVEFORM_CHOICE: ChoiceSpec = {
  key: 'signal_type',
  label: 'Forme d’onde',
  options: [
    { value: 'sine', label: 'Sinusoïde' },
    { value: 'square', label: 'Carré' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'sawtooth', label: 'Dent de scie' },
  ],
};

/**
 * Per-experiment control layout.
 *
 * Deliberately smaller than the 2D bench: at a real bench you turn the knobs
 * that matter for the exercise, and the screen in front of you is the readout.
 */
export const BENCH_CONTROLS: Record<string, BenchControls> = {
  'signaux-elementaires': {
    choices: [WAVEFORM_CHOICE],
    knobs: [
      { key: 'frequency', label: 'Fréquence', unit: 'Hz', min: 10, max: 100_000, log: true },
      { key: 'amplitude', label: 'Amplitude', unit: 'V', min: 0.1, max: 5, step: 0.1 },
      { key: 'phase', label: 'Phase', min: -Math.PI, max: Math.PI, step: 0.05, hint: 'radians' },
      { key: 'offset', label: 'Offset', unit: 'V', min: -2, max: 2, step: 0.1 },
    ],
  },
  'serie-de-fourier': {
    choices: [
      {
        key: 'signal_type',
        label: 'Onde cible',
        options: [
          { value: 'square', label: 'Carré' },
          { value: 'triangle', label: 'Triangle' },
          { value: 'sawtooth', label: 'Dent de scie' },
        ],
      },
    ],
    knobs: [
      { key: 'frequency', label: 'Fréquence', unit: 'Hz', min: 100, max: 10_000, log: true },
      {
        key: 'n_harmonics',
        label: 'Harmoniques activées',
        min: 1,
        max: 31,
        step: 2,
        hint: 'les harmoniques paires d’un carré sont nulles',
      },
    ],
  },
  'transformee-de-fourier': {
    choices: [],
    knobs: [
      { key: 'frequency', label: 'Fréquence', unit: 'Hz', min: 100, max: 20_000, log: true },
      { key: 'amplitude', label: 'Amplitude', unit: 'V', min: 0.1, max: 3, step: 0.05 },
      {
        key: 'duration',
        label: 'Durée d’acquisition',
        unit: 's',
        min: 0.002,
        max: 0.2,
        log: true,
        hint: 'plus longue = raies plus fines',
      },
    ],
  },
  echantillonnage: {
    choices: [],
    knobs: [
      { key: 'frequency', label: 'Fréquence du signal', unit: 'Hz', min: 100, max: 50_000, log: true },
      {
        key: 'sampling_rate',
        label: 'Fréquence d’échantillonnage',
        unit: 'Hz',
        min: 500,
        max: 200_000,
        log: true,
        hint: 'critère : fe > 2 × fmax',
      },
    ],
  },
  filtrage: {
    choices: [
      {
        key: 'filter_type',
        label: 'Type de filtre',
        options: [
          { value: 'low_pass', label: 'Passe-bas' },
          { value: 'high_pass', label: 'Passe-haut' },
          { value: 'band_pass', label: 'Passe-bande' },
          { value: 'band_stop', label: 'Réjecteur' },
        ],
      },
      WAVEFORM_CHOICE,
    ],
    knobs: [
      { key: 'cutoff', label: 'Fréquence de coupure', unit: 'Hz', min: 100, max: 50_000, log: true },
      { key: 'order', label: 'Ordre', min: 1, max: 8, step: 1, hint: '-20n dB par décade' },
      { key: 'frequency', label: 'Signal d’entrée', unit: 'Hz', min: 50, max: 20_000, log: true },
    ],
  },
};

export function controlsFor(slug: string): BenchControls {
  return BENCH_CONTROLS[slug] ?? { choices: [], knobs: [] };
}
