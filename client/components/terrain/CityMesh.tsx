'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  BACKDROP,
  BUILDINGS,
  CURB,
  EXTENT,
  POLE_LINE_Z,
  EQUIPMENT,
  SIDEWALK,
  STREETS,
  UTILITY_POLES,
  blocked,
  type Rect,
} from '@/lib/terrain/city';
import { asphalt, facade, laterite, pavers, roofSlab, tinRoof, zebra } from '@/lib/terrain/textures';

/**
 * The district's static geometry, merged into a handful of meshes: walls,
 * roofs, roads, sidewalks, markings. One draw call each keeps an entry-level
 * phone at a usable frame rate.
 *
 * UVs are in world metres divided by the tile size of the texture, so a window
 * is the size of a window on every building and asphalt grain never stretches.
 */

const BAY = 3.2; // facade tile width, m
const FLOOR = 3.0; // facade tile height, m

/** Accumulates quads into one indexed BufferGeometry with vertex colours. */
class Builder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  quad(corners: THREE.Vector3Tuple[], normal: THREE.Vector3Tuple, uv: [number, number][], color: THREE.Color) {
    const base = this.positions.length / 3;
    corners.forEach((c, i) => {
      this.positions.push(...c);
      this.normals.push(...normal);
      this.uvs.push(...uv[i]);
      this.colors.push(color.r, color.g, color.b);
    });
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Horizontal rectangle at height y, UVs in tiles of `tile` metres. */
  floor(r: Rect, y: number, tile: number, color: THREE.Color) {
    this.quad(
      [
        [r.minX, y, r.maxZ],
        [r.maxX, y, r.maxZ],
        [r.maxX, y, r.minZ],
        [r.minX, y, r.minZ],
      ],
      [0, 1, 0],
      [
        [r.minX / tile, -r.maxZ / tile],
        [r.maxX / tile, -r.maxZ / tile],
        [r.maxX / tile, -r.minZ / tile],
        [r.minX / tile, -r.minZ / tile],
      ],
      color,
    );
  }

  /** Four vertical sides of a box from y0 to y1, facade UVs. */
  walls(r: Rect, y0: number, y1: number, color: THREE.Color, tileW = BAY, tileH = FLOOR, inward = false) {
    const v0 = y0 / tileH;
    const v1 = y1 / tileH;
    const side = (from: [number, number], to: [number, number], normal: THREE.Vector3Tuple) => {
      // Facing in (the inside of a parapet): reverse the winding and the normal.
      const [a, b] = inward ? [to, from] : [from, to];
      const n: THREE.Vector3Tuple = inward ? [-normal[0], -normal[1], -normal[2]] : normal;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // Start each wall on a whole bay so windows sit centred, not cut.
      const u1 = Math.max(1, Math.round(len / tileW));
      this.quad(
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        n,
        [
          [0, v0],
          [u1, v0],
          [u1, v1],
          [0, v1],
        ],
        color,
      );
    };
    side([r.minX, r.maxZ], [r.maxX, r.maxZ], [0, 0, 1]);
    side([r.maxX, r.maxZ], [r.maxX, r.minZ], [1, 0, 0]);
    side([r.maxX, r.minZ], [r.minX, r.minZ], [0, 0, -1]);
    side([r.minX, r.minZ], [r.minX, r.maxZ], [-1, 0, 0]);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

/** Splits a strip along its long axis around the carriageways it crosses. */
function cut(strip: Rect, holes: Rect[]): Rect[] {
  const alongX = strip.maxX - strip.minX >= strip.maxZ - strip.minZ;
  let pieces = [strip];
  for (const h of holes) {
    const next: Rect[] = [];
    for (const p of pieces) {
      const overlaps = p.minX < h.maxX && p.maxX > h.minX && p.minZ < h.maxZ && p.maxZ > h.minZ;
      if (!overlaps) {
        next.push(p);
        continue;
      }
      if (alongX) {
        if (h.minX > p.minX) next.push({ ...p, maxX: h.minX });
        if (h.maxX < p.maxX) next.push({ ...p, minX: h.maxX });
      } else {
        if (h.minZ > p.minZ) next.push({ ...p, maxZ: h.minZ });
        if (h.maxZ < p.maxZ) next.push({ ...p, minZ: h.maxZ });
      }
    }
    pieces = next;
  }
  return pieces;
}

function sidewalkStrips(): Rect[] {
  const strips: Rect[] = [];
  for (const s of STREETS) {
    const alongX = s.maxX - s.minX > s.maxZ - s.minZ;
    const others = STREETS.filter((o) => o !== s);
    const sides: Rect[] = alongX
      ? [
          { ...s, minZ: s.minZ - SIDEWALK, maxZ: s.minZ },
          { ...s, minZ: s.maxZ, maxZ: s.maxZ + SIDEWALK },
        ]
      : [
          { ...s, minX: s.minX - SIDEWALK, maxX: s.minX },
          { ...s, minX: s.maxX, maxX: s.maxX + SIDEWALK },
        ];
    for (const side of sides) strips.push(...cut(side, others));
  }
  return strips;
}

function useStreetGeometry() {
  return useMemo(() => {
    const road = new Builder();
    const walk = new Builder();
    const marks = new Builder();
    const crossings = new Builder();
    const grey = new THREE.Color('#ffffff');
    const kerb = new THREE.Color('#d8d3c8');
    const paint = new THREE.Color('#ece8dc');

    for (const s of STREETS) road.floor(s, 0.01, 8, grey);

    for (const strip of sidewalkStrips()) {
      walk.floor(strip, CURB, 2, grey);
      // Kerb faces, lighter stone, all four sides (ends meet the crossings).
      walk.walls(strip, 0, CURB, kerb, 2, 2);
    }

    // Centre dashes and edge lines, skipped inside the other carriageways.
    for (const s of STREETS) {
      const alongX = s.maxX - s.minX > s.maxZ - s.minZ;
      const others = STREETS.filter((o) => o !== s);
      const inside = (x: number, z: number) => others.some((o) => x > o.minX - 1 && x < o.maxX + 1 && z > o.minZ - 1 && z < o.maxZ + 1);
      const mid = alongX ? (s.minZ + s.maxZ) / 2 : (s.minX + s.maxX) / 2;
      const [from, to] = alongX ? [s.minX, s.maxX] : [s.minZ, s.maxZ];
      for (let t = from + 1; t < to - 3; t += 6) {
        const c = alongX ? ([t + 1.5, mid] as const) : ([mid, t + 1.5] as const);
        if (inside(c[0], c[1])) continue;
        const r: Rect = alongX
          ? { minX: t, maxX: t + 3, minZ: mid - 0.07, maxZ: mid + 0.07 }
          : { minX: mid - 0.07, maxX: mid + 0.07, minZ: t, maxZ: t + 3 };
        marks.floor(r, 0.02, 1, paint);
      }
      // Zebra crossings where this street meets another.
      for (const o of others) {
        const meets = s.minX < o.maxX && s.maxX > o.minX && s.minZ < o.maxZ && s.maxZ > o.minZ;
        if (!meets) continue;
        if (alongX) {
          for (const x of [o.minX - 4, o.maxX + 1]) {
            if (x < s.minX || x + 3 > s.maxX) continue;
            crossings.floor({ minX: x, maxX: x + 3, minZ: s.minZ, maxZ: s.maxZ }, 0.021, 3, paint);
          }
        } else {
          for (const z of [o.minZ - 4, o.maxZ + 1]) {
            if (z < s.minZ || z + 3 > s.maxZ) continue;
            crossings.floor({ minX: s.minX, maxX: s.maxX, minZ: z, maxZ: z + 3 }, 0.021, 3, paint);
          }
        }
      }
    }
    return { road: road.build(), walk: walk.build(), marks: marks.build(), crossings: crossings.build() };
  }, []);
}

export function Streets() {
  const g = useStreetGeometry();
  const zebraTex = useMemo(() => {
    const t = zebra().clone();
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      <mesh geometry={g.road} receiveShadow>
        <meshStandardMaterial map={asphalt()} roughness={0.95} />
      </mesh>
      <mesh geometry={g.walk} receiveShadow castShadow>
        <meshStandardMaterial map={pavers()} vertexColors roughness={0.9} />
      </mesh>
      <mesh geometry={g.marks} receiveShadow>
        <meshStandardMaterial color="#ece8dc" roughness={0.8} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={g.crossings} receiveShadow>
        <meshStandardMaterial map={zebraTex} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  );
}

export function Ground() {
  const g = useMemo(() => {
    const b = new Builder();
    const size = EXTENT + 80;
    b.floor({ minX: -size, maxX: size, minZ: -size, maxZ: size }, 0, 10, new THREE.Color('#ffffff'));
    return b.build();
  }, []);
  return (
    <mesh geometry={g} receiveShadow>
      <meshStandardMaterial map={laterite()} roughness={1} />
    </mesh>
  );
}

/** Rough tint so neighbouring buildings never share the exact paint. */
function tint(hex: string, seed: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const k = Math.sin(seed * 12.9898) * 43758.5453;
  const jitter = k - Math.floor(k) - 0.5;
  return c.setHSL(hsl.h, Math.min(1, hsl.s * (0.9 + jitter * 0.3)), Math.min(0.92, hsl.l * (1 + jitter * 0.08)));
}

export function Buildings() {
  const { walls, slabs, tins, tanks, units } = useMemo(() => {
    const wallsB = new Builder();
    const slabB = new Builder();
    const tinB = new Builder();
    const white = new THREE.Color('#ffffff');
    const tanksAt: THREE.Vector3Tuple[] = [];
    const unitsAt: { p: THREE.Vector3Tuple; ry: number }[] = [];

    [...BUILDINGS, ...BACKDROP].forEach((b, i) => {
      const backdrop = i >= BUILDINGS.length;
      const color = tint(b.color, i + 1);
      const low = b.height < 7;
      const parapet = low ? 0.25 : 0.9;
      wallsB.walls(b, 0, b.height + parapet, color);
      const roofY = b.height;
      (low ? tinB : slabB).floor(b, roofY, low ? 3 : 4, white);
      // Inside of the parapet, so the roof does not look hollow from above.
      const inner: Rect = { minX: b.minX + 0.15, maxX: b.maxX - 0.15, minZ: b.minZ + 0.15, maxZ: b.maxZ - 0.15 };
      wallsB.walls(inner, roofY, roofY + parapet, color.clone().multiplyScalar(0.85), BAY, FLOOR, true);
      // Parapet top.
      slabB.floor({ ...b, maxZ: b.minZ + 0.15 }, roofY + parapet, 4, white);
      slabB.floor({ ...b, minZ: b.maxZ - 0.15 }, roofY + parapet, 4, white);
      slabB.floor({ ...b, maxX: b.minX + 0.15 }, roofY + parapet, 4, white);
      slabB.floor({ ...b, minX: b.maxX - 0.15 }, roofY + parapet, 4, white);

      // The black water tank on the roof, a fixture of Abidjan rooftops.
      if (backdrop) return;
      if (!b.name && i % 3 !== 0) tanksAt.push([b.maxX - 1.4, roofY, b.minZ + 1.4]);
      // Split air-conditioning units hung on the facades.
      if (!low || i % 2 === 0) {
        const floors = Math.max(1, Math.floor(b.height / FLOOR));
        for (let f = 0; f < floors; f += 2) {
          unitsAt.push({ p: [b.minX + 1.6 + (f % 3), f * FLOOR + 1.0, b.maxZ + 0.2], ry: 0 });
          unitsAt.push({ p: [b.maxX + 0.2, f * FLOOR + 1.0, b.minZ + 2 + (f % 2)], ry: Math.PI / 2 });
        }
      }
    });
    return { walls: wallsB.build(), slabs: slabB.build(), tins: tinB.build(), tanks: tanksAt, units: unitsAt };
  }, []);

  const tankRef = useRef<THREE.InstancedMesh>(null);
  const unitRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    tanks.forEach((p, i) => tankRef.current?.setMatrixAt(i, m.makeTranslation(p[0], p[1] + 0.75, p[2])));
    units.forEach(({ p, ry }, i) => {
      m.makeRotationY(ry).setPosition(p[0], p[1], p[2]);
      unitRef.current?.setMatrixAt(i, m);
    });
    if (tankRef.current) tankRef.current.instanceMatrix.needsUpdate = true;
    if (unitRef.current) unitRef.current.instanceMatrix.needsUpdate = true;
  }, [tanks, units]);

  return (
    <group>
      <mesh geometry={walls} castShadow receiveShadow>
        <meshStandardMaterial map={facade()} vertexColors roughness={0.92} />
      </mesh>
      <mesh geometry={slabs} receiveShadow>
        <meshStandardMaterial map={roofSlab()} roughness={0.95} />
      </mesh>
      <mesh geometry={tins} receiveShadow castShadow>
        <meshStandardMaterial map={tinRoof()} roughness={0.55} metalness={0.35} />
      </mesh>
      <instancedMesh ref={tankRef} args={[undefined, undefined, tanks.length]} castShadow>
        <cylinderGeometry args={[0.65, 0.65, 1.5, 14]} />
        <meshStandardMaterial color="#1f2124" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={unitRef} args={[undefined, undefined, units.length]} castShadow>
        <boxGeometry args={[0.85, 0.55, 0.3]} />
        <meshStandardMaterial color="#e6e4df" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

// -- Vegetation ---------------------------------------------------------------

function vegetationSpots() {
  const trees: [number, number][] = [];
  const palms: [number, number][] = [];
  const clear = (x: number, z: number) =>
    !blocked(x, z) &&
    EQUIPMENT.every((e) => Math.hypot(e.at[0] - x, e.at[1] - z) > 4 && Math.hypot(e.stand[0] - x, e.stand[1] - z) > 3) &&
    UTILITY_POLES.every((p) => Math.hypot(p - x, POLE_LINE_Z - z) > 3);
  let k = 0;
  for (let x = -EXTENT + 6; x < EXTENT - 4; x += 13) {
    for (const z of [-6.6, 6.6]) {
      if (Math.abs(x) > 10 && clear(x, z)) (k++ % 3 === 0 ? palms : trees).push([x, z]);
    }
  }
  for (let z = -EXTENT + 8; z < EXTENT - 4; z += 13) {
    for (const x of [-5.4, 5.4]) {
      if (Math.abs(z) > 11 && clear(x, z)) (k++ % 3 === 0 ? palms : trees).push([x, z]);
    }
  }
  // Yards between houses.
  for (let x = -EXTENT + 10; x < EXTENT - 10; x += 17) {
    for (let z = -EXTENT + 12; z < EXTENT - 10; z += 19) {
      const px = x + ((z * 7) % 5);
      const pz = z + ((x * 3) % 4);
      if (clear(px, pz) && clear(px + 2, pz) && clear(px, pz + 2) && STREETS.every((s) => px < s.minX - 6 || px > s.maxX + 6 || pz < s.minZ - 6 || pz > s.maxZ + 6)) {
        (k++ % 2 === 0 ? palms : trees).push([px, pz]);
      }
    }
  }
  return { trees, palms };
}

export function Vegetation() {
  const { trees, palms } = useMemo(vegetationSpots, []);
  const FRONDS = 12;
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const palmTrunk = useRef<THREE.InstancedMesh>(null);
  const frond = useRef<THREE.InstancedMesh>(null);

  // A lumpy, smooth-shaded clump: a sphere with its vertices pushed in and out.
  const clumpGeometry = useMemo(() => {
    // Shared vertices, or the normals stay per-face and the crown stays faceted.
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3) * Math.sin(v.z * 3.7);
      v.multiplyScalar(1 + n * 0.18);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const frondGeometry = useMemo(() => {
    // A drooping leaf: a flattened cone, base at the origin, pointing +y.
    const g = new THREE.ConeGeometry(0.62, 3.8, 4, 3);
    g.translate(0, 1.9, 0);
    g.scale(1, 1, 0.08);
    return g;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const color = new THREE.Color();
    trees.forEach(([x, z], i) => {
      const s = 0.85 + ((i * 37) % 10) / 25;
      trunk.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, 1.4 * s, z), q.identity(), new THREE.Vector3(s, s, s)));
      // Two clumps per crown, offset and turned: no two trees share a silhouette.
      for (let c = 0; c < 2; c++) {
        const k = i * 2 + c;
        const off = c === 0 ? [0, 0] : [Math.sin(i) * 0.9, Math.cos(i) * 0.9];
        crown.current?.setMatrixAt(
          k,
          m.compose(
            new THREE.Vector3(x + off[0] * s, (c === 0 ? 3.8 : 4.5) * s, z + off[1] * s),
            q.setFromEuler(e.set(0, i + c, 0)),
            new THREE.Vector3((c === 0 ? 2.2 : 1.6) * s, (c === 0 ? 1.6 : 1.3) * s, (c === 0 ? 2.2 : 1.6) * s),
          ),
        );
        crown.current?.setColorAt(k, color.setHSL(0.26 + ((k * 13) % 7) / 100, 0.42, 0.2 + ((k * 7) % 5) / 55));
      }
    });
    palms.forEach(([x, z], i) => {
      const h = 7 + ((i * 29) % 30) / 10;
      const lean = (((i * 17) % 10) - 5) / 40;
      palmTrunk.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), q.setFromEuler(e.set(lean, 0, lean / 2)), new THREE.Vector3(1, h, 1)));
      const top = new THREE.Vector3(x + Math.sin(lean / 2) * h * 0.5, h, z + Math.sin(lean) * h * 0.5);
      for (let f = 0; f < FRONDS; f++) {
        const yaw = (f / FRONDS) * Math.PI * 2 + i;
        // Young fronds stand up, old ones hang down.
        const droop = f % 3 === 0 ? 0.7 : 1.2 + ((f * 3) % 4) / 8;
        q.setFromEuler(e.set(droop, yaw, 0, 'YXZ'));
        frond.current?.setMatrixAt(i * FRONDS + f, m.compose(top, q, new THREE.Vector3(1, 1, 1)));
        frond.current?.setColorAt(i * FRONDS + f, color.setHSL(0.2 + (f % 3) / 50, 0.45, 0.3 + (f % 2) / 14));
      }
    });
    for (const r of [trunk, crown, palmTrunk, frond]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    }
  }, [trees, palms]);

  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 2.8, 7]} />
        <meshStandardMaterial color="#5b4330" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[clumpGeometry, undefined, trees.length * 2]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={palmTrunk} args={[undefined, undefined, palms.length]} castShadow>
        <cylinderGeometry args={[0.13, 0.2, 1, 7]} />
        <meshStandardMaterial color="#8a7a63" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={frond} args={[frondGeometry, undefined, palms.length * FRONDS]} castShadow>
        <meshStandardMaterial roughness={0.85} side={THREE.DoubleSide} flatShading />
      </instancedMesh>
    </group>
  );
}

// -- Street furniture ---------------------------------------------------------

/** Pole + arm + luminaire merged once, then instanced along the streets. */
function lampGeometry() {
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 8, 6).translate(0, 4, 0);
  const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5).rotateZ(Math.PI / 2).translate(0.75, 7.9, 0);
  const head = new THREE.BoxGeometry(0.7, 0.16, 0.3).translate(1.5, 7.85, 0);
  return mergeGeometries([pole, arm, head])!;
}

export function StreetLamps() {
  const spots = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = [];
    // North side of the boulevard, arm over the road.
    for (let x = -EXTENT + 8; x < EXTENT - 4; x += 22) if (Math.abs(x) > 8) out.push({ x, z: -5.4, ry: -Math.PI / 2 });
    for (let z = -EXTENT + 10; z < EXTENT - 4; z += 22) if (Math.abs(z) > 9) out.push({ x: -4.4, z, ry: 0 });
    return out.filter((p) => !blocked(p.x, p.z));
  }, []);
  const geometry = useMemo(lampGeometry, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach((p, i) => {
      m.makeRotationY(p.ry).setPosition(p.x, 0, p.z);
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, spots.length]} castShadow>
      <meshStandardMaterial color="#6f767b" metalness={0.5} roughness={0.5} />
    </instancedMesh>
  );
}

/**
 * Utility poles with their sagging cables: power on top, telecom (copper and
 * aerial fibre) lower down, the line the PBO on its pole hangs from.
 */
export function PoleLine() {
  const { poles, cables } = useMemo(() => {
    const poleParts: THREE.BufferGeometry[] = [];
    const cableParts: THREE.BufferGeometry[] = [];
    const heights = [8.6, 8.6, 7.4, 6.9];
    const offsets = [-0.6, 0.6, 0.15, -0.15];
    UTILITY_POLES.forEach((x) => {
      poleParts.push(new THREE.CylinderGeometry(0.11, 0.17, 9, 7).translate(x, 4.5, POLE_LINE_Z));
      poleParts.push(new THREE.BoxGeometry(0.1, 0.1, 1.5).translate(x, 8.7, POLE_LINE_Z));
    });
    for (let i = 0; i < UTILITY_POLES.length - 1; i++) {
      const a = UTILITY_POLES[i];
      const b = UTILITY_POLES[i + 1];
      heights.forEach((h, k) => {
        const points: THREE.Vector3[] = [];
        for (let t = 0; t <= 1.0001; t += 0.125) {
          // Parabolic sag, deeper for the heavier power conductors.
          const sag = (k < 2 ? 0.9 : 0.6) * 4 * t * (1 - t);
          points.push(new THREE.Vector3(a + (b - a) * t, h - sag, POLE_LINE_Z + offsets[k]));
        }
        cableParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, k < 2 ? 0.018 : 0.025, 3, false));
      });
    }
    return { poles: mergeGeometries(poleParts)!, cables: mergeGeometries(cableParts)! };
  }, []);
  return (
    <group>
      <mesh geometry={poles} castShadow>
        <meshStandardMaterial color="#a7a196" roughness={0.95} />
      </mesh>
      <mesh geometry={cables}>
        <meshStandardMaterial color="#141516" roughness={0.6} />
      </mesh>
    </group>
  );
}
