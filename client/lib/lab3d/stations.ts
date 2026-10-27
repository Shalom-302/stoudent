/**
 * Bridge between the 3D room and the pedagogical catalogue.
 *
 * `specs.ts` stays the single source of truth for geometry and must not learn
 * about experiments; this file is the only place that knows a desk in the room
 * corresponds to a TP slug served by the API.
 */
import {
  CENTER_TABLE,
  INTERACTION,
  STATIONS,
  anchorsFor,
  type Anchors,
  type StationId,
} from '@/lib/lab3d/specs';

export type PointId = StationId | 'CENTER';

export interface LabPoint {
  id: PointId;
  /** Experiment slug on the backend. */
  slug: string;
  title: string;
  subtitle: string;
  anchors: Anchors;
}

/** Desk -> experiment. The room has four desks; the fifth TP sits on the
 *  central experimental table, which is where a filter bench belongs anyway. */
const DESK_EXPERIMENTS: Record<StationId, { slug: string; title: string; subtitle: string }> = {
  A: {
    slug: 'signaux-elementaires',
    title: 'Signaux élémentaires',
    subtitle: 'Générateur + oscilloscope — amplitude, fréquence, phase',
  },
  B: {
    slug: 'serie-de-fourier',
    title: 'Série de Fourier',
    subtitle: 'Reconstruction harmonique d’une onde carrée',
  },
  C: {
    slug: 'echantillonnage',
    title: 'Échantillonnage',
    subtitle: 'Nyquist, repliement, reconstruction',
  },
  D: {
    slug: 'transformee-de-fourier',
    title: 'Transformée de Fourier',
    subtitle: 'FFT, raies, résolution fréquentielle',
  },
};

/** The central table, approached from the +Z side like any other bench. */
function centerAnchors(): Anchors {
  const [x, z] = CENTER_TABLE.position;
  const stand = z + CENTER_TABLE.depth / 2 + INTERACTION.standOff;
  return {
    interactionPoint: [x, 0, stand],
    lookAtPoint: [x, 1.0, z],
    handTarget: [x, CENTER_TABLE.height + 0.08, z + 0.2],
    screenAnchor: [x, 1.1, z],
  };
}

export const LAB_POINTS: LabPoint[] = [
  ...STATIONS.map((station) => ({
    id: station.id as PointId,
    ...DESK_EXPERIMENTS[station.id],
    anchors: anchorsFor(station),
  })),
  {
    id: 'CENTER' as PointId,
    slug: 'filtrage',
    title: 'Filtrage',
    subtitle: 'Passe-bas, passe-haut, passe-bande, réjecteur',
    anchors: centerAnchors(),
  },
];

export function pointById(id: PointId | null): LabPoint | undefined {
  if (!id) return undefined;
  return LAB_POINTS.find((point) => point.id === id);
}

/** Door out of the room, used by the HUD prompt and the exit hotspot. */
export const EXIT_POINT: [number, number] = [4.5, 4.2];
