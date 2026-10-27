/**
 * What the room's wall screens should say right now.
 *
 * The big screen and the whiteboard are not decoration: they carry the current
 * instruction, the live reading to watch, and what is left to do. That is what
 * lets a student look up from the bench and know where they are, instead of
 * hunting through a side panel.
 */
import type { LessonContext } from '@/lib/lab3d/screens';
import type { ExperimentDetail, Milestone } from '@/types';

/** Formula the whiteboard carries for each TP, with a one-line reading of it. */
const BOARD: Record<string, { formula: string; note: string }> = {
  'signaux-elementaires': {
    formula: 'x(t) = A sin(2 pi f t + phi) + C',
    note: 'T = 1 / f    Veff = A / racine(2)',
  },
  'serie-de-fourier': {
    formula: 'f(t) = (4A/pi) [ sin(wt) + (1/3)sin(3wt) + (1/5)sin(5wt) + ... ]',
    note: 'Onde carree : harmoniques impaires seulement.',
  },
  'transformee-de-fourier': {
    formula: 'x(t) = sin(2 pi 1000 t) + 0,5 sin(2 pi 3000 t)',
    note: 'Resolution df = 1 / T : fenetre plus longue, raies plus fines.',
  },
  echantillonnage: {
    formula: 'fe > 2 fmax        |5000 - 6000| = 1000 Hz',
    note: 'Sous le critere de Shannon, le spectre se replie.',
  },
  filtrage: {
    formula: '|H(f)| : -3 dB a fc,  -20n dB/decade au-dela',
    note: 'Le filtre agit sur le spectre ; la forme suit.',
  },
};

function number(parameters: Record<string, unknown>, key: string): number | null {
  const raw = parameters[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hz(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
}

/** The one measurement worth watching while turning this TP's knobs. */
function readout(
  slug: string,
  parameters: Record<string, unknown>,
): { label: string; value: string } | undefined {
  const frequency = number(parameters, 'frequency');

  switch (slug) {
    case 'signaux-elementaires': {
      if (frequency === null || frequency <= 0) return undefined;
      return { label: 'Periode T = 1 / f', value: `${(1000 / frequency).toFixed(3)} ms` };
    }
    case 'serie-de-fourier': {
      const n = number(parameters, 'n_harmonics');
      if (n === null) return undefined;
      return { label: 'Harmoniques retenues', value: `jusqu'a n = ${Math.round(n)}` };
    }
    case 'transformee-de-fourier': {
      const duration = number(parameters, 'duration');
      if (!duration) return undefined;
      return { label: 'Resolution df = 1 / T', value: `${(1 / duration).toFixed(1)} Hz` };
    }
    case 'echantillonnage': {
      const fe = number(parameters, 'sampling_rate');
      if (fe === null || frequency === null) return undefined;
      const aliased = fe < 2 * frequency;
      const apparent = Math.abs(((frequency % fe) + fe) % fe);
      const folded = apparent > fe / 2 ? fe - apparent : apparent;
      return {
        label: aliased ? 'REPLIEMENT — frequence apparente' : 'Critere respecte — fe / 2',
        value: aliased ? hz(folded) : hz(fe / 2),
      };
    }
    case 'filtrage': {
      const cutoff = number(parameters, 'cutoff');
      const order = number(parameters, 'order');
      if (cutoff === null) return undefined;
      return {
        label: `Coupure${order ? ` — ordre ${Math.round(order)}` : ''}`,
        value: `${hz(cutoff)}${order ? ` · ${-20 * Math.round(order)} dB/dec` : ''}`,
      };
    }
    default:
      return undefined;
  }
}

export function buildLesson(
  experiment: ExperimentDetail | undefined,
  parameters: Record<string, unknown>,
  milestones: Milestone[],
  currentStep: number,
): LessonContext | undefined {
  if (!experiment) return undefined;

  const steps = experiment.instructions ?? [];
  const index = Math.min(Math.max(currentStep, 0), Math.max(steps.length - 1, 0));
  const step = steps[index];
  const board = BOARD[experiment.slug];

  return {
    title: experiment.title,
    step: index + 1,
    steps: Math.max(steps.length, 1),
    stepTitle: step?.title ?? experiment.title,
    instruction: step?.content ?? experiment.objective ?? '',
    readout: readout(experiment.slug, parameters),
    todo: milestones.filter((m) => !m.done).map((m) => m.label),
    formula: board?.formula,
    note: board?.note,
  };
}
