/**
 * SignalLab — cotes de reference.
 *
 * Toutes les valeurs viennent du document de specification 3D.
 * 1 unite = 1 metre. Rien ne doit etre redefini ailleurs dans le code :
 * chaque composant lit ce fichier.
 *
 * Repere : origine au centre du sol de la salle.
 *   X : -6 -> +6   (mur avant = mur de 12 m)
 *   Z : -5 -> +5   (Z negatif = vers le mur avant / le grand ecran)
 *   Y : 0 = sol fini
 */

export const ROOM = {
  width: 12.0, // X
  depth: 10.0, // Z
  height: 3.2, // interieur
  wallThickness: 0.2,
  slabThickness: 0.15,
} as const;

export const BOUNDS = {
  minX: -ROOM.width / 2,
  maxX: ROOM.width / 2,
  minZ: -ROOM.depth / 2,
  maxZ: ROOM.depth / 2,
} as const;

export const DOOR = { width: 1.0, height: 2.1, x: 4.5 } as const;

export const WINDOW = { width: 2.5, height: 1.8, sill: 1.0 } as const;

/** Fenetres du mur avant, en X. Le grand ecran occupe -2 -> +2. */
export const FRONT_WINDOWS = [-4.0, 4.0];
/** Fenetres du mur gauche, en Z. */
export const LEFT_WINDOWS = [0.0, 3.2];

export const DESK = { width: 1.6, depth: 0.75, height: 0.75 } as const;
export const CHAIR = { width: 0.55, depth: 0.55, height: 0.85 } as const;

export const CENTER_TABLE = {
  width: 2.4,
  depth: 1.2,
  height: 0.75,
  position: [0, -0.4] as [number, number],
} as const;

export const BIG_SCREEN = {
  width: 4.0,
  height: 2.2,
  bottom: 0.75, // bas de l'ecran / sol
} as const;

export const WHITEBOARD = { width: 2.5, height: 1.2, bottom: 1.0 } as const;

export const SHELF = { width: 2.5, depth: 0.45, height: 2.0, levels: 4 } as const;

export const RACK = { units: 42, width: 0.6, depth: 0.8, height: 2.0 } as const;

export const CABINET = { width: 1.0, depth: 0.5, height: 1.95 } as const;

export const AVATAR = {
  total: 1.75,
  eyes: 1.6,
  shoulders: 1.4,
  hips: 0.9,
  knees: 0.45,
  shoulderWidth: 0.42,
} as const;

/** Section 17 — positionnement avatar / equipement. */
export const INTERACTION = {
  detectionRadius: 1.0,
  standOff: 0.8, // 0.70 - 0.90 m devant l'equipement
  workTop: 0.75,
  eyeHeight: 1.6,
} as const;

export type StationId = 'A' | 'B' | 'C' | 'D';

export interface Station {
  id: StationId;
  label: string;
  /** Centre du plateau, au sol. Le poste regarde le mur avant (-Z). */
  position: [number, number];
  /** Instrument principal du poste. */
  kind: 'oscilloscope' | 'spectrum';
  computer: boolean;
}

/**
 * Implantation — vue de dessus de la spec (section 3).
 * Rang avant : A et B. Rang arriere : C et D. Table centrale entre les deux.
 * Circulation conservee : >= 1.20 m dans les axes, >= 0.80 m devant chaque poste.
 */
export const STATIONS: Station[] = [
  { id: 'A', label: 'Poste A — oscilloscope + generateur', position: [-3.4, -3.0], kind: 'oscilloscope', computer: false },
  { id: 'B', label: 'Poste B — oscilloscope + generateur', position: [3.4, -3.0], kind: 'oscilloscope', computer: false },
  { id: 'C', label: 'Poste C — ordinateur + oscilloscope', position: [-3.4, 1.8], kind: 'oscilloscope', computer: true },
  { id: 'D', label: 'Poste D — ordinateur + analyseur', position: [3.4, 1.8], kind: 'spectrum', computer: true },
];

/** Section 18 — points d'ancrage 3D, derives de l'implantation. */
export interface Anchors {
  interactionPoint: [number, number, number];
  lookAtPoint: [number, number, number];
  handTarget: [number, number, number];
  screenAnchor: [number, number, number];
}

export function anchorsFor(station: Station): Anchors {
  const [x, z] = station.position;
  // L'etudiant se place cote +Z, entre l'instrument principal et le generateur,
  // a 0.70-0.90 m de la facade des appareils. La chaise est decalee en X pour
  // laisser ce couloir libre (voir COLLIDERS).
  const stand = z + DESK.depth / 2 + 0.42;
  const instrumentZ = z - DESK.depth / 2 + 0.2;
  const instrumentX = x + MAIN_INSTRUMENT_X[station.kind];
  return {
    interactionPoint: [x - 0.25, 0, stand],
    lookAtPoint: [instrumentX, 1.0, instrumentZ],
    handTarget: [instrumentX, INTERACTION.workTop + 0.08, instrumentZ + 0.08],
    screenAnchor: [instrumentX, 1.15, instrumentZ],
  };
}

/** Position en X de l'instrument principal sur le plateau, selon son gabarit. */
export const MAIN_INSTRUMENT_X = { oscilloscope: -0.45, spectrum: -0.52 } as const;

/** Decalage de la chaise : tiree sur le cote pour degager l'acces au poste. */
export const CHAIR_OFFSET: [number, number] = [0.62, DESK.depth / 2 + 0.45];

export const BACK_ROW_Z = 4.5;

export const PROPS = {
  shelf: { x: -4.0, z: BACK_ROW_Z },
  rack: { x: -0.4, z: BACK_ROW_Z },
  cabinet: { x: 2.2, z: BACK_ROW_Z },
} as const;

/** Panneaux LED du plafond (section 4.3) — 6 panneaux 1.20 x 0.30. */
export const CEILING_PANELS: [number, number][] = [
  [-3.6, -3.0], [0, -3.0], [3.6, -3.0],
  [-3.6, 2.0], [0, 2.0], [3.6, 2.0],
];

/** Boites de collision au sol (AABB en XZ). Le joueur a un rayon de 0.30 m. */
export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number }

function box(cx: number, cz: number, w: number, d: number): Collider {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export const COLLIDERS: Collider[] = [
  ...STATIONS.flatMap((s) => [
    box(s.position[0], s.position[1], DESK.width, DESK.depth),
    box(s.position[0] + CHAIR_OFFSET[0], s.position[1] + CHAIR_OFFSET[1], CHAIR.width, CHAIR.depth),
  ]),
  box(CENTER_TABLE.position[0], CENTER_TABLE.position[1], CENTER_TABLE.width, CENTER_TABLE.depth),
  box(PROPS.shelf.x, PROPS.shelf.z, SHELF.width, SHELF.depth),
  box(PROPS.rack.x, PROPS.rack.z, RACK.width, RACK.depth),
  box(PROPS.cabinet.x, PROPS.cabinet.z, CABINET.width, CABINET.depth),
];

/** Direction artistique (section 20). */
export const PALETTE = {
  floor: '#b5b8bb',
  floorLine: '#a2a6aa',
  wall: '#eceae5',
  ceiling: '#f3f2ef',
  skirting: '#d5d2cb',
  laminate: '#d8d3c9',
  metal: '#9ba1a6',
  darkMetal: '#4a4f54',
  equipment: '#2d3237',
  equipmentFace: '#3a4045',
  screenOff: '#11161a',
  screenOn: '#0d1418',
  accent: '#f2b705',
  accentSoft: '#f7d06a',
  cable: '#26292c',
  cableAlt: '#1f5f8b',
  fabric: '#3f4a52',
  skin: '#c9a184',
} as const;
