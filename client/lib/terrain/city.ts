/**
 * Labo Terrain: a wired district, described as data.
 *
 * The point of the district is its telecom equipment: a student walks a few
 * minutes and sees what a field visit would show - towers, rooftop links,
 * street cabinets, poles with their PBO, draw pits along the fibre route, the
 * central office. Streets and houses are there so the equipment sits where it
 * sits in a real city.
 *
 * Everything is a plain record: adding equipment is adding an object here.
 * Units are metres, x to the east, z to the south, ground at y = 0. The
 * district is invented ("inspiré d'Abidjan"): real infrastructure is not
 * mapped, on purpose.
 */

export type EquipmentType = 'fh' | 'fh-roof' | 'gsm' | 'smallcell' | 'nro' | 'sro' | 'chambre' | 'pbo';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Half-size of the walkable district. */
export const EXTENT = 70;
export const SIDEWALK = 2.5;
/** Height of the sidewalks above the road and the yards. */
export const CURB = 0.12;
export const PLAYER_RADIUS = 0.32;

export interface Street extends Rect {
  name: string;
}

/** Carriageways; sidewalks run SIDEWALK metres along both sides. */
export const STREETS: Street[] = [
  { name: 'Boulevard de la Fibre', minX: -EXTENT, maxX: EXTENT, minZ: -5, maxZ: 5 },
  { name: 'Rue des Antennes', minX: -4, maxX: 4, minZ: -EXTENT, maxZ: EXTENT },
  { name: 'Rue du Relais', minX: 4, maxX: EXTENT, minZ: 31, maxZ: 37 },
];

export interface Building extends Rect {
  height: number;
  color: string;
  /** A landmark, labelled in the scene. */
  name?: string;
}

export const SPAWN = { x: 6, z: 12, rotation: Math.PI };

// -- Landmarks ------------------------------------------------------------------

/** Main microwave tower, in its compound, seen from the arrival point. */
export const FH_TOWER_A: [number, number] = [-18, -20];
/** Its far end, at the edge of the district. */
export const FH_TOWER_B: [number, number] = [52, -58];
export const FH_COMPOUND: Rect = { minX: -24, maxX: -12, minZ: -26, maxZ: -14 };
export const TOWER_HEIGHT = 30;

/** Halfway along the A-B link: the building the mission must clear (24 m vs 30 m towers). */
export const SIGMA: Building = { minX: 11, maxX: 23, minZ: -45, maxZ: -33, height: 24, color: '#b9c2c9', name: 'Immeuble Sigma' };
export const ORION: Building = { minX: 33, maxX: 47, minZ: 41, maxZ: 53, height: 18, color: '#d6c3a5', name: 'Immeuble Orion' };
/** The central office (NRO): where the district's fibre starts. */
export const NRO: Building = { minX: -44, maxX: -32, minZ: 10.5, maxZ: 18, height: 5, color: '#e9ecee', name: 'Central optique (NRO)' };

/**
 * Utility poles along the south sidewalk of the boulevard, carrying power and
 * aerial fibre; three of them carry a PBO.
 */
export const POLE_LINE_Z = 7.2;
export const UTILITY_POLES: number[] = [-50, -28, -6, 16, 38, 60];

/** Street lamps along the Rue des Antennes, two of them carrying a small cell. */
export const LAMP_X = -4.4;
export const SMALL_CELL_LAMPS = [-16, 28];

/**
 * Underground fibre route, sidewalk level: NRO -> south sidewalk -> under the
 * crossing -> up the Rue des Antennes to the second cabinet.
 */
export const FIBRE_ROUTE: [number, number][] = [
  [-38, 10.5],
  [-38, 6.1],
  [5.3, 6.1],
  [5.3, -24],
];
/** Branch from the route to the first cabinet. */
export const FIBRE_BRANCH: [number, number][] = [
  [-16, 6.1],
  [-16, 6.8],
];

/**
 * Parked cars along the kerbs: [x, z, heading, colour]. Heading follows the
 * Player convention: 0 faces +z (south), PI/2 faces +x (east).
 */
export const PARKED_CARS: [number, number, number, string][] = [
  [14, 31.9, -Math.PI / 2, '#c9c9c4'],
  [24, 31.9, -Math.PI / 2, '#2d4a6b'],
  [52, 36.1, Math.PI / 2, '#8b1e1e'],
  [-30, -4.1, -Math.PI / 2, '#f2c200'],
  [-58, 4.1, Math.PI / 2, '#e8e8e4'],
];
/** Traffic lanes, driving on the right. */
export const LANES = { eastbound: 1.9, westbound: -1.9, southbound: -2, northbound: 2 } as const;
export const CAR_SIZE = { length: 4.3, width: 1.8 };

// -- Equipment ----------------------------------------------------------------

export interface Equipment {
  id: string;
  type: EquipmentType;
  /** Short name shown on its label in the scene. */
  label: string;
  /** Where the equipment stands (x, z). */
  at: [number, number];
  /** Mounting height: ground 0, a roof, a pole. */
  y: number;
  /** Bearing it faces (radians, Player convention), for dishes and cabinets. */
  aim?: number;
  /** The other end of a radio link. */
  link?: string;
  /** Where the student stands to examine it. */
  stand: [number, number];
}

const bearing = (from: [number, number], to: [number, number]) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/** Equipment that does not depend on the generated houses. */
const FIXED: Equipment[] = [
  { id: 'fh-a', type: 'fh', label: 'Pylône FH · 15 GHz', at: FH_TOWER_A, y: 0, aim: bearing(FH_TOWER_A, FH_TOWER_B), link: 'fh-b', stand: [-18, -9.2] },
  { id: 'fh-b', type: 'fh', label: 'Pylône FH · site B', at: FH_TOWER_B, y: 0, aim: bearing(FH_TOWER_B, FH_TOWER_A), link: 'fh-a', stand: [52, -50.5] },
  { id: 'gsm-orion', type: 'gsm', label: 'Relais 2G/4G · Orion', at: [40, 47], y: ORION.height, stand: [40, 39.4] },
  { id: 'nro', type: 'nro', label: 'NRO · central optique', at: [-38, 14.2], y: 0, stand: [-38, 9.3] },
  { id: 'sro-1', type: 'sro', label: 'Armoire de rue (SRO)', at: [-16, 7.2], y: CURB, aim: 0, stand: [-16, 9.8] },
  { id: 'sro-2', type: 'sro', label: 'Armoire de rue (SRO)', at: [5.6, -24], y: CURB, aim: Math.PI / 2, stand: [7.8, -24] },
  { id: 'pbo-16', type: 'pbo', label: 'PBO sur poteau', at: [16, POLE_LINE_Z], y: 0, stand: [16, 9.6] },
  { id: 'pbo-m28', type: 'pbo', label: 'PBO sur poteau', at: [-28, POLE_LINE_Z], y: 0, stand: [-28, 9.6] },
  { id: 'pbo-38', type: 'pbo', label: 'PBO sur poteau', at: [38, POLE_LINE_Z], y: 0, stand: [38, 9.6] },
  { id: 'ch-1', type: 'chambre', label: 'Chambre L2T', at: [-38, 6.1], y: CURB, stand: [-36.6, 6.1] },
  { id: 'ch-2', type: 'chambre', label: 'Chambre L2T', at: [-21, 6.1], y: CURB, stand: [-19.6, 6.1] },
  { id: 'ch-3', type: 'chambre', label: 'Chambre L3T', at: [5.3, 6.1], y: CURB, stand: [6.1, 7.3] },
  { id: 'ch-4', type: 'chambre', label: 'Chambre L2T', at: [5.3, -16], y: CURB, stand: [6.1, -14.6] },
  ...SMALL_CELL_LAMPS.map((z): Equipment => ({
    id: `sc-${z}`,
    type: 'smallcell',
    label: 'Small cell 4G',
    at: [LAMP_X, z],
    y: 0,
    stand: [-5.6, z + 1.6],
  })),
];

// -- Generated blocks -------------------------------------------------------

const PALETTE = ['#e8d9bd', '#d9c7a8', '#c99a6b', '#efe7da', '#d8b28a', '#bfc5c9', '#e3d2b0', '#c9915a'];

/** Deterministic PRNG: the district is the same for every student. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;
}

function grow(r: Rect, by: number): Rect {
  return { minX: r.minX - by, maxX: r.maxX + by, minZ: r.minZ - by, maxZ: r.maxZ + by };
}

const point = (p: [number, number], by: number): Rect => grow({ minX: p[0], maxX: p[0], minZ: p[1], maxZ: p[1] }, by);

/** Distance from a rectangle's centre to the A-B link: houses keep out of its way. */
function onLinkPath(r: Rect): boolean {
  const [ax, az] = FH_TOWER_A;
  const [bx, bz] = FH_TOWER_B;
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(cx - (ax + dx * t), cz - (az + dz * t)) < 9;
}

/** Kept free of houses: streets, landmarks, equipment and where it is examined from. */
const RESERVED: Rect[] = [
  ...STREETS.map((s) => grow(s, SIDEWALK + 1)),
  grow(FH_COMPOUND, 2),
  grow(SIGMA, 2),
  grow(ORION, 2),
  grow(NRO, 2),
  point(FH_TOWER_B, 5),
  ...FIXED.map((e) => point(e.stand, 2.5)),
];

function generateBuildings(): Building[] {
  const random = mulberry32(2026);
  const result: Building[] = [];
  // Walk a grid of lots; each lot gets a house or a small block, or stays a yard.
  for (let x = -EXTENT + 4; x < EXTENT - 8; x += 12) {
    for (let z = -EXTENT + 4; z < EXTENT - 8; z += 12) {
      if (random() < 0.18) continue;
      const w = 6 + random() * 4;
      const d = 6 + random() * 4;
      const lot: Rect = { minX: x, maxX: x + w, minZ: z, maxZ: z + d };
      if (RESERVED.some((r) => overlaps(lot, r)) || onLinkPath(lot)) continue;
      if (result.some((b) => overlaps(lot, b, 1.5))) continue;
      const tall = random() < 0.3;
      result.push({
        ...lot,
        height: tall ? 10 + random() * 7 : 3.5 + random() * 3,
        color: PALETTE[Math.floor(random() * PALETTE.length)],
      });
    }
  }
  return result;
}

export const BUILDINGS: Building[] = [SIGMA, ORION, NRO, ...generateBuildings()];

/**
 * The rest of the city beyond the walkable district: a belt of blocks that
 * fades into the haze, so the horizon is a city and not the edge of a map.
 * Not walkable, not collidable.
 */
function generateBackdrop(): Building[] {
  const random = mulberry32(77);
  const result: Building[] = [];
  for (let ring = 0; ring < 3; ring++) {
    const inner = EXTENT + 8 + ring * 22;
    for (let a = 0; a < Math.PI * 2; a += 0.11 - ring * 0.025) {
      if (random() < 0.2) continue;
      const r = inner + random() * 12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Leave the streets' vanishing points open.
      if (Math.abs(x) < 9 || Math.abs(z) < 10 || (x > 0 && Math.abs(z - 34) < 8)) continue;
      const w = 7 + random() * 9;
      const d = 7 + random() * 9;
      result.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        height: 4 + random() * (ring === 2 ? 26 : 14),
        color: PALETTE[Math.floor(random() * PALETTE.length)],
      });
    }
  }
  return result;
}

export const BACKDROP: Building[] = generateBackdrop();

// -- Collisions -------------------------------------------------------------

function carFootprint(x: number, z: number, heading: number): Rect {
  // Headings are multiples of 90 degrees in this district.
  const along = Math.abs(Math.sin(heading)) > 0.5;
  const hx = (along ? CAR_SIZE.length : CAR_SIZE.width) / 2;
  const hz = (along ? CAR_SIZE.width : CAR_SIZE.length) / 2;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

/** Solid footprints: buildings, the tower compounds, street furniture, parked cars. */
const SOLIDS: Rect[] = [
  ...BUILDINGS,
  FH_COMPOUND,
  point(FH_TOWER_B, 2.2),
  ...FIXED.filter((e) => e.type === 'sro').map((e) => point(e.at, 0.65)),
  ...UTILITY_POLES.map((x) => point([x, POLE_LINE_Z], 0.25)),
  ...PARKED_CARS.map(([x, z, h]) => carFootprint(x, z, h)),
];

/** Moving obstacles (cars in traffic), refreshed by the traffic loop every frame. */
export const MOVING: Rect[] = [];

export function blocked(x: number, z: number): boolean {
  const r = PLAYER_RADIUS;
  if (Math.abs(x) > EXTENT - r || Math.abs(z) > EXTENT - r) return true;
  const hit = (c: Rect) => x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r;
  return SOLIDS.some(hit) || MOVING.some(hit);
}

export { carFootprint };

/** Ground height under (x, z): the sidewalks stand a kerb above the road. */
export function groundAt(x: number, z: number): number {
  const inside = (r: Rect, by = 0) => x > r.minX - by && x < r.maxX + by && z > r.minZ - by && z < r.maxZ + by;
  if (STREETS.some((s) => inside(s))) return 0;
  return STREETS.some((s) => inside(s, SIDEWALK)) ? CURB : 0;
}

// -- Rooftop equipment on the generated blocks ------------------------------------

const centre = (b: Rect): [number, number] => [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];

/** A free spot at the foot of a building, on the side facing `towards`, not already taken. */
function standBeside(b: Rect, towards: [number, number], taken: [number, number][]): [number, number] {
  const [cx, cz] = centre(b);
  const sides: [number, number][] = [
    [cx, b.maxZ + 1.6],
    [cx, b.minZ - 1.6],
    [b.maxX + 1.6, cz],
    [b.minX - 1.6, cz],
  ];
  sides.sort((p, q) => Math.hypot(p[0] - towards[0], p[1] - towards[1]) - Math.hypot(q[0] - towards[0], q[1] - towards[1]));
  return (
    sides.find((p) => !blocked(p[0], p[1]) && taken.every((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) > 3)) ?? sides[0]
  );
}

function rooftopEquipment(): Equipment[] {
  const tall = BUILDINGS.filter((b) => !b.name && b.height >= 10);
  const byDistance = (p: [number, number]) => (a: Building, b: Building) =>
    Math.hypot(centre(a)[0] - p[0], centre(a)[1] - p[1]) - Math.hypot(centre(b)[0] - p[0], centre(b)[1] - p[1]);
  // Two more base stations near the crossing, far enough apart to split the district.
  const first = [...tall].sort(byDistance([14, 18]))[0];
  const second = [...tall].filter((b) => b !== first).sort(byDistance([-24, -40]))[0];
  const taken: [number, number][] = FIXED.map((e) => e.stand);
  const out: Equipment[] = [];
  const roofSpot = (b: Building, towards: [number, number]): [number, number] => {
    const [cx, cz] = centre(b);
    const a = Math.atan2(towards[0] - cx, towards[1] - cz);
    const r = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) / 2 - 1;
    return [cx + Math.sin(a) * r, cz + Math.cos(a) * r];
  };
  const orionCentre = centre(ORION);
  const sigmaCentre = centre(SIGMA);
  for (const [b, name, partner, partnerB, partnerName] of [
    [first, 'gsm-1', orionCentre, ORION, 'orion'],
    [second, 'gsm-2', sigmaCentre, SIGMA, 'sigma'],
  ] as const) {
    if (!b) continue;
    const c = centre(b);
    const stand = standBeside(b, [SPAWN.x, SPAWN.z], taken);
    taken.push(stand);
    out.push({ id: name, type: 'gsm', label: 'Relais 2G/4G sur toit', at: c, y: b.height, stand });
    // Its backhaul: a rooftop microwave hop to a taller building.
    const here = roofSpot(b, partner);
    const there = roofSpot(partnerB, c);
    const standHere = standBeside(b, partner, taken);
    taken.push(standHere);
    const standThere = standBeside(partnerB, c, taken);
    taken.push(standThere);
    out.push({
      id: `fhr-${name}`,
      type: 'fh-roof',
      label: 'FH de collecte · 23 GHz',
      at: here,
      y: b.height,
      aim: bearing(here, there),
      link: `fhr-${partnerName}-${name}`,
      stand: standHere,
    });
    out.push({
      id: `fhr-${partnerName}-${name}`,
      type: 'fh-roof',
      label: 'FH de collecte · 23 GHz',
      at: there,
      y: partnerB.height,
      aim: bearing(there, here),
      link: `fhr-${name}`,
      stand: standThere,
    });
  }
  return out;
}

export const EQUIPMENT: Equipment[] = [...FIXED, ...rooftopEquipment()];

export function equipmentById(id: string | null): Equipment | undefined {
  return id ? EQUIPMENT.find((e) => e.id === id) : undefined;
}
