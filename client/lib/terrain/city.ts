/**
 * Labo Terrain: one district, described as data.
 *
 * Streets, buildings and telecom sites are plain records: adding a site or a
 * street is adding an object here, the scene and the colliders follow. Units
 * are metres, x to the east, z to the south, ground at y = 0.
 *
 * The district is invented ("inspiré d'Abidjan"): real infrastructure is not
 * mapped, on purpose.
 */

export type SiteId = 'fh' | 'pc' | 'sro' | 'chambre' | 'gsm';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Half-size of the walkable district. */
export const EXTENT = 70;
export const SIDEWALK = 2.5;
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

export interface Site {
  id: SiteId;
  /** Where the equipment stands. */
  at: [number, number];
  /** Where the student stands to examine it. */
  stand: [number, number];
}

export const SITES: Site[] = [
  // Pylône FH dans son enclos, au nord-ouest; il vise le pylône B au nord-est
  // par-dessus l'immeuble Sigma.
  { id: 'fh', at: [-42, -40], stand: [-42, -31] },
  // Point de concentration sur poteau, trottoir sud du boulevard.
  { id: 'pc', at: [16, 7.2], stand: [16, 9.6] },
  // Armoire de rue (SRO), trottoir sud, côté ouest.
  { id: 'sro', at: [-16, 7.2], stand: [-16, 9.8] },
  // Chambre de tirage dans le trottoir nord.
  { id: 'chambre', at: [26, -6.6], stand: [26, -8.8] },
  // Relais GSM sur le toit de l'immeuble Orion, au bout de la rue du Relais.
  { id: 'gsm', at: [40, 46], stand: [40, 39.5] },
];

/** Second tower of the microwave link, at the edge of the district. */
export const FH_TOWER_B: [number, number] = [52, -58];
/** The building the link has to clear (mission default: 24 m vs 30 m towers). */
export const SIGMA: Building = {
  minX: 2,
  maxX: 14,
  minZ: -54,
  maxZ: -42,
  height: 24,
  color: '#b9c2c9',
  name: 'Immeuble Sigma',
};
export const ORION: Building = {
  minX: 33,
  maxX: 47,
  minZ: 41,
  maxZ: 53,
  height: 18,
  color: '#d6c3a5',
  name: 'Immeuble Orion',
};
export const FH_COMPOUND: Rect = { minX: -48, maxX: -36, minZ: -46, maxZ: -34 };

export const SPAWN = { x: 6, z: 12, rotation: Math.PI };

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

/** Kept free of buildings: streets with their sidewalks, sites, landmarks. */
const RESERVED: Rect[] = [
  ...STREETS.map((s) => grow(s, SIDEWALK + 1)),
  grow(FH_COMPOUND, 2),
  grow(SIGMA, 2),
  grow(ORION, 2),
  ...SITES.map((s) => grow({ minX: s.at[0], maxX: s.at[0], minZ: s.at[1], maxZ: s.at[1] }, 4)),
  // Clear view from the FH tower to tower B, except over Sigma.
  { minX: -40, maxX: 0, minZ: -56, maxZ: -40 },
  { minX: 16, maxX: 56, minZ: -62, maxZ: -46 },
  grow({ minX: FH_TOWER_B[0], maxX: FH_TOWER_B[0], minZ: FH_TOWER_B[1], maxZ: FH_TOWER_B[1] }, 5),
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
      if (RESERVED.some((r) => overlaps(lot, r))) continue;
      if (result.some((b) => overlaps(lot, b, 1.5))) continue;
      const tall = random() < 0.25;
      result.push({
        ...lot,
        height: tall ? 9 + random() * 7 : 3.5 + random() * 3,
        color: PALETTE[Math.floor(random() * PALETTE.length)],
      });
    }
  }
  return result;
}

export const BUILDINGS: Building[] = [SIGMA, ORION, ...generateBuildings()];

// -- Collisions -------------------------------------------------------------

/** Solid footprints: buildings, the FH compound fence, street furniture. */
const SOLIDS: Rect[] = [
  ...BUILDINGS,
  FH_COMPOUND,
  // Poles and cabinets are small but solid.
  ...SITES.filter((s) => s.id === 'pc' || s.id === 'sro').map((s) =>
    grow({ minX: s.at[0], maxX: s.at[0], minZ: s.at[1], maxZ: s.at[1] }, 0.6),
  ),
];

export function blocked(x: number, z: number): boolean {
  const r = PLAYER_RADIUS;
  if (Math.abs(x) > EXTENT - r || Math.abs(z) > EXTENT - r) return true;
  return SOLIDS.some((c) => x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r);
}

export function siteById(id: SiteId | null): Site | undefined {
  return id ? SITES.find((s) => s.id === id) : undefined;
}
