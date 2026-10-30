'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import {
  Compound,
  DrawPit,
  FibrePole,
  GsmMast,
  LatticeTower,
  NroDetails,
  RoofDish,
  SmallCell,
  StreetCabinet,
} from './models';
import type { PlayerTracker } from '@/components/world3d/Player';
import {
  BUILDINGS,
  EQUIPMENT,
  FH_COMPOUND,
  FIBRE_BRANCH,
  FIBRE_ROUTE,
  NRO,
  POLE_LINE_Z,
  TOWER_HEIGHT,
  UTILITY_POLES,
  equipmentById,
  type Equipment,
  type EquipmentType,
} from '@/lib/terrain/city';

const ROOF_MAST = 6;

/** Height of an item's top, where its label floats. */
export function topOf(e: Equipment): number {
  switch (e.type) {
    case 'fh':
      return TOWER_HEIGHT + 3.5;
    case 'gsm':
      return e.y + ROOF_MAST + 1.5;
    case 'fh-roof':
      return e.y + 3.2;
    case 'smallcell':
      return 9.6;
    case 'pbo':
      return 6.6;
    case 'nro':
      return NRO.height + 2.5;
    case 'sro':
      return 2.6;
    case 'chambre':
      return 1.3;
  }
}

/** Drop cables from a PBO to the facades of the three nearest houses south of it. */
function drops(at: [number, number]): THREE.Vector3Tuple[] {
  const [px, pz] = at;
  return BUILDINGS.filter((b) => !b.name && b.minZ > pz)
    .map((b) => {
      const x = Math.min(Math.max(px, b.minX + 1), b.maxX - 1);
      return { b, x, d: Math.hypot(x - px, b.minZ - pz) };
    })
    .sort((a, c) => a.d - c.d)
    .slice(0, 3)
    .map(({ b, x }): THREE.Vector3Tuple => [x - px, Math.min(b.height - 0.4, 3.2), b.minZ - pz]);
}

function Model({ e }: { e: Equipment }) {
  const pboDrops = useMemo(() => (e.type === 'pbo' ? drops(e.at) : []), [e]);
  switch (e.type) {
    case 'fh':
      return <LatticeTower height={TOWER_HEIGHT} aim={e.aim ?? 0} dishes={e.id === 'fh-a' ? [26, 21.5] : [26]} />;
    case 'gsm':
      return <GsmMast height={ROOF_MAST} />;
    case 'fh-roof':
      return (
        <group rotation={[0, e.aim ?? 0, 0]}>
          <RoofDish />
        </group>
      );
    case 'smallcell':
      return <SmallCell />;
    case 'pbo':
      return <FibrePole drops={pboDrops} />;
    case 'sro':
      return (
        <group rotation={[0, e.aim ?? 0, 0]}>
          <StreetCabinet />
        </group>
      );
    case 'chambre':
      return <DrawPit />;
    case 'nro':
      return <NroDetails width={NRO.maxX - NRO.minX} depth={NRO.maxZ - NRO.minZ} height={NRO.height} />;
  }
}

export function EquipmentModels() {
  return (
    <group>
      <group position={[(FH_COMPOUND.minX + FH_COMPOUND.maxX) / 2, 0, (FH_COMPOUND.minZ + FH_COMPOUND.maxZ) / 2]}>
        <Compound size={FH_COMPOUND.maxX - FH_COMPOUND.minX} />
      </group>
      {EQUIPMENT.map((e) => (
        <group key={e.id} position={[e.at[0], e.type === 'chambre' ? 0 : e.y, e.at[1]]}>
          <Model e={e} />
        </group>
      ))}
    </group>
  );
}

// -- Labels ---------------------------------------------------------------------

/** A text label drawn once on a canvas, shown as a sprite: it faces the camera and buildings hide it. */
function labelTexture(text: string, discovered: boolean) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 34px system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = w;
  canvas.height = 60;
  ctx.font = font;
  ctx.fillStyle = 'rgba(20,22,25,0.86)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 60, 30);
  ctx.fill();
  ctx.fillStyle = discovered ? '#21b36b' : '#f2b705';
  ctx.beginPath();
  ctx.arc(26, 30, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 44, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: w / 60 };
}

function Label({ e, discovered, tracker }: { e: Equipment; discovered: boolean; tracker: PlayerTracker }) {
  const sprite = useRef<THREE.Sprite>(null);
  const { texture, aspect } = useMemo(() => labelTexture(e.label, discovered), [e.label, discovered]);
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  // Big equipment is labelled from afar, a draw pit only when close.
  const range = e.type === 'fh' || e.type === 'gsm' || e.type === 'nro' ? 90 : e.type === 'chambre' ? 22 : 45;
  useFrame(() => {
    if (sprite.current) sprite.current.visible = Math.hypot(tracker.x - e.at[0], tracker.z - e.at[1]) < range;
  });
  const h = e.type === 'fh' || e.type === 'gsm' ? 1.6 : e.type === 'chambre' || e.type === 'sro' ? 0.4 : 0.7;
  return (
    <sprite ref={sprite} position={[e.at[0], topOf(e), e.at[1]]} scale={[h * aspect, h, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

export function EquipmentLabels({ discovered, tracker }: { discovered: Set<EquipmentType>; tracker: PlayerTracker }) {
  return (
    <group>
      {EQUIPMENT.map((e) => (
        <Label key={e.id} e={e} discovered={discovered.has(e.type)} tracker={tracker} />
      ))}
    </group>
  );
}

// -- Networks made visible ----------------------------------------------------

function tube(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0), Math.max(8, points.length * 6), radius, 6, false);
}

/**
 * What a technician knows is there and a passer-by never sees: the radio
 * links between dishes, the fibre under the sidewalk, the aerial fibre on the
 * poles. Shown on purpose: this is a lab.
 */
export function NetworkOverlay({ beam }: { beam: 'unknown' | 'up' | 'down' }) {
  const { links, underground, aerial } = useMemo(() => {
    const linkLines: { from: THREE.Vector3; to: THREE.Vector3; main: boolean }[] = [];
    const done = new Set<string>();
    for (const e of EQUIPMENT) {
      if (!e.link || done.has(e.id)) continue;
      const other = equipmentById(e.link);
      if (!other) continue;
      done.add(e.id);
      done.add(other.id);
      const main = e.type === 'fh';
      const yA = main ? 26 : e.y + 1.9;
      const yB = main ? 26 : other.y + 1.9;
      linkLines.push({ from: new THREE.Vector3(e.at[0], yA, e.at[1]), to: new THREE.Vector3(other.at[0], yB, other.at[1]), main });
    }
    const route = (pts: [number, number][]) => pts.map(([x, z]) => new THREE.Vector3(x, 0.16, z));
    const under = [tube(route(FIBRE_ROUTE), 0.07), tube(route(FIBRE_BRANCH), 0.07)];
    const aerialParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < UTILITY_POLES.length - 1; i++) {
      const a = UTILITY_POLES[i];
      const b = UTILITY_POLES[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1.0001; t += 0.125) pts.push(new THREE.Vector3(a + (b - a) * t, 7.4 - 0.6 * 4 * t * (1 - t), POLE_LINE_Z + 0.15));
      aerialParts.push(tube(pts, 0.05));
    }
    return { links: linkLines, underground: under, aerial: aerialParts };
  }, []);

  const mainColor = beam === 'up' ? '#21b36b' : beam === 'down' ? '#e0442c' : '#38bdf8';

  return (
    <group>
      {links.map((l, i) => {
        const mid = l.from.clone().add(l.to).multiplyScalar(0.5);
        const length = l.from.distanceTo(l.to);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), l.to.clone().sub(l.from).normalize());
        return (
          <mesh key={i} position={mid} quaternion={q}>
            {/* The beam, drawn as a slim glowing rod from dish to dish. */}
            <cylinderGeometry args={[l.main ? 0.12 : 0.07, l.main ? 0.12 : 0.07, length, 8, 1, true]} />
            <meshBasicMaterial color={l.main ? mainColor : '#38bdf8'} transparent opacity={0.55} depthWrite={false} />
          </mesh>
        );
      })}
      {underground.map((g, i) => (
        <mesh key={`u${i}`} geometry={g}>
          <meshBasicMaterial color="#ff8a1f" transparent opacity={0.85} />
        </mesh>
      ))}
      {aerial.map((g, i) => (
        <mesh key={`a${i}`} geometry={g}>
          <meshBasicMaterial color="#ff8a1f" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}
