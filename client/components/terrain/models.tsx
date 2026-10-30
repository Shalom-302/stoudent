'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Telecom equipment of the Labo Terrain, built from primitives: light enough
 * for an entry-level Android phone, recognisable enough to learn the parts.
 */

const STEEL = '#a9b0b5';
const CONCRETE = '#b8b2a7';
const ACCENT = '#f2b705';

/** A bar between two points (lattice members, cables). */
function Bar({ from, to, radius = 0.06, color = STEEL }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; radius?: number; color?: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 5]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
    </mesh>
  );
}

/** A bar between two points as raw geometry, coloured, ready to merge. */
function barGeometry(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, radius: number, color: THREE.Color) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius, radius, dir.length(), 5, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Parabolic antenna with its radome and ODU, facing +z of its group. */
export function Dish({ diameter = 1.2 }: { diameter?: number }) {
  const r = diameter / 2;
  return (
    <group>
      {/* radôme blanc */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}>
        <cylinderGeometry args={[r, r, 0.22, 24]} />
        <meshStandardMaterial color="#f4f4f1" roughness={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.24]}>
        <circleGeometry args={[r * 0.98, 24]} />
        <meshStandardMaterial color="#e6e6e1" roughness={0.6} />
      </mesh>
      {/* ODU derrière la parabole */}
      <mesh position={[0, 0, -0.18]}>
        <boxGeometry args={[0.32, 0.32, 0.22]} />
        <meshStandardMaterial color="#d9dcde" />
      </mesh>
      <mesh position={[0, 0, -0.42]}>
        <boxGeometry args={[0.08, 0.08, 0.3]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
    </group>
  );
}

/**
 * Square lattice tower, tapering, painted red and white at the top for
 * aviation. ``aim`` is the bearing (radians, around y) the dishes face.
 */
export function LatticeTower({ height = 30, base = 3.2, top = 1.1, aim = 0, dishes = [26, 21.5] }: {
  height?: number;
  base?: number;
  top?: number;
  aim?: number;
  dishes?: number[];
}) {
  const levels = Math.round(height / 3);
  const half = (y: number) => (base + (top - base) * (y / height)) / 2;
  const corners = (y: number): THREE.Vector3Tuple[] => {
    const h = half(y);
    return [
      [-h, y, -h],
      [h, y, -h],
      [h, y, h],
      [-h, y, h],
    ];
  };

  // Every member merged into one mesh: a tower is one draw call, not 120.
  const lattice = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const steel = new THREE.Color(STEEL);
    const red = new THREE.Color('#c8372a');
    const white = new THREE.Color('#eeebe4');
    for (let i = 0; i < levels; i++) {
      const y0 = (i * height) / levels;
      const y1 = ((i + 1) * height) / levels;
      const lower = corners(y0);
      const upper = corners(y1);
      // Aviation marking: red and white bands on the top third.
      const color = y1 > height - 9 ? (i % 2 ? red : white) : steel;
      for (let c = 0; c < 4; c++) {
        parts.push(barGeometry(lower[c], upper[c], 0.075, color));
        parts.push(barGeometry(upper[c], upper[(c + 1) % 4], 0.035, color));
        parts.push(barGeometry(lower[c], upper[(c + 1) % 4], 0.03, color));
        parts.push(barGeometry(lower[(c + 1) % 4], upper[c], 0.03, color));
      }
    }
    // Cable ladder up one face, and the lightning rod.
    const dark = new THREE.Color('#2b2f33');
    parts.push(barGeometry([half(0) - 0.15, 0.5, half(0) - 0.15], [half(height - 4) - 0.15, height - 4, half(height - 4) - 0.15], 0.05, dark));
    parts.push(barGeometry([0, height, 0], [0, height + 2.5, 0], 0.03, steel));
    return mergeGeometries(parts)!;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pure function of the props
  }, [height, base, top, levels]);

  return (
    <group>
      {/* massif béton */}
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <boxGeometry args={[base + 1, 0.5, base + 1]} />
        <meshStandardMaterial color={CONCRETE} />
      </mesh>
      <mesh geometry={lattice} castShadow>
        <meshStandardMaterial vertexColors metalness={0.55} roughness={0.45} />
      </mesh>
      {/* feu de balisage */}
      <mesh position={[0, height + 0.3, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color="#ff3b2f" emissive="#ff3b2f" emissiveIntensity={1.2} />
      </mesh>
      {dishes.map((y, i) => (
        <group key={y} position={[0, y, 0]} rotation={[0, aim, 0]}>
          <group position={[i % 2 ? -0.5 : 0.5, 0, half(y) + 0.5]}>
            <Dish diameter={i === 0 ? 1.2 : 0.9} />
          </group>
        </group>
      ))}
    </group>
  );
}

/** Fenced compound with the shelter (IDU, batteries) at the tower's foot. */
export function Compound({ size = 12 }: { size?: number }) {
  const h = size / 2;
  const posts = useMemo(() => {
    const out: THREE.Vector3Tuple[] = [];
    for (let t = -h; t <= h; t += 2) {
      out.push([t, 1, -h], [t, 1, h], [-h, 1, t], [h, 1, t]);
    }
    return out;
  }, [h]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#a39d92" />
      </mesh>
      {posts.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.08, 2, 0.08]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
      {/* grillage, semi-transparent */}
      {[
        [0, 1, -h, 0],
        [0, 1, h, 0],
        [-h, 1, 0, Math.PI / 2],
        [h, 1, 0, Math.PI / 2],
      ].map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]}>
          <planeGeometry args={[size, 2]} />
          <meshStandardMaterial color="#c9ced2" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* shelter */}
      <mesh position={[h - 2.2, 1.3, -h + 1.8]} castShadow>
        <boxGeometry args={[3.4, 2.6, 2.6]} />
        <meshStandardMaterial color="#e9ecee" />
      </mesh>
      <mesh position={[h - 2.2, 1.1, -h + 3.12]}>
        <boxGeometry args={[0.9, 2, 0.05]} />
        <meshStandardMaterial color="#7d868c" />
      </mesh>
    </group>
  );
}

/** Concrete pole with the PBO box and drop cables to ``drops`` (local points). */
/** The PBO box on a utility pole (the pole itself belongs to the pole line), with its drops. */
export function FibrePole({ drops }: { drops: THREE.Vector3Tuple[] }) {
  return (
    <group>
      {/* PBO */}
      <mesh position={[0, 5.2, 0.22]} castShadow>
        <boxGeometry args={[0.42, 0.55, 0.18]} />
        <meshStandardMaterial color="#3d4247" />
      </mesh>
      <mesh position={[0, 5.2, 0.32]}>
        <boxGeometry args={[0.3, 0.06, 0.02]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
      {/* câble de distribution qui monte */}
      <Bar from={[0.14, 0.2, 0.12]} to={[0.14, 4.9, 0.18]} radius={0.025} color="#1d2023" />
      {drops.map((to, i) => (
        <Bar key={i} from={[0, 5.4, 0.22]} to={to} radius={0.015} color="#1d2023" />
      ))}
    </group>
  );
}

/** Street cabinet (SRO). */
export function StreetCabinet() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 0.2, 0.7]} />
        <meshStandardMaterial color={CONCRETE} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[1.3, 1.5, 0.55]} />
        <meshStandardMaterial color="#8a9a8c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.95, 0.28]}>
        <boxGeometry args={[0.02, 1.4, 0.01]} />
        <meshStandardMaterial color="#5e6b60" />
      </mesh>
      <mesh position={[0, 1.45, 0.28]}>
        <boxGeometry args={[0.5, 0.12, 0.01]} />
        <meshStandardMaterial color={ACCENT} />
      </mesh>
    </group>
  );
}

/** Manhole cover of a draw pit (chambre L2T), flush with the sidewalk. */
export function DrawPit() {
  return (
    <group position={[0, 0.13, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.7]} />
        <meshStandardMaterial color="#4a4d50" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-0.32, 0, 0.32].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, 0]}>
          <planeGeometry args={[0.02, 0.6]} />
          <meshStandardMaterial color="#2e3134" />
        </mesh>
      ))}
    </group>
  );
}

/** Rooftop mast with three sector panels at 0, 120 and 240 degrees and a backhaul dish. */
export function GsmMast({ height = 6 }: { height?: number }) {
  return (
    <group>
      <Bar from={[0, 0, 0]} to={[0, height, 0]} radius={0.09} />
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((azimuth) => (
        <group key={azimuth} rotation={[0, azimuth, 0]}>
          <Bar from={[0, height - 1.2, 0]} to={[0, height - 1.2, 0.55]} radius={0.03} />
          {/* tilt de quelques degrés vers le sol */}
          <mesh position={[0, height - 1.2, 0.62]} rotation={[0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.32, 1.5, 0.12]} />
            <meshStandardMaterial color="#eef0ef" />
          </mesh>
          {/* RRU */}
          <mesh position={[0, height - 2.4, 0.3]}>
            <boxGeometry args={[0.3, 0.45, 0.16]} />
            <meshStandardMaterial color="#c7cbcd" />
          </mesh>
        </group>
      ))}
      <group position={[0, height - 3, 0]} rotation={[0, -2.2, 0]}>
        <group position={[0, 0, 0.45]}>
          <Dish diameter={0.6} />
        </group>
      </group>
      {/* armoire BBU */}
      <mesh position={[1.6, 0.8, 1.2]} castShadow>
        <boxGeometry args={[0.9, 1.6, 0.7]} />
        <meshStandardMaterial color="#d7dadc" />
      </mesh>
    </group>
  );
}

/** Rooftop backhaul dish on its stand, facing +z of its group. */
export function RoofDish({ diameter = 0.6 }: { diameter?: number }) {
  return (
    <group>
      <Bar from={[0, 0, 0]} to={[0, 2.2, 0]} radius={0.05} />
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.9, 0.16, 0.9]} />
        <meshStandardMaterial color={CONCRETE} />
      </mesh>
      <group position={[0, 1.9, 0.3]}>
        <Dish diameter={diameter} />
      </group>
    </group>
  );
}

/** Small cell canister and radio box on top of a street lamp. */
export function SmallCell() {
  return (
    <group>
      <mesh position={[0, 8.35, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.8, 12]} />
        <meshStandardMaterial color="#d9dcdd" roughness={0.5} />
      </mesh>
      <mesh position={[0.16, 6.2, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.32]} />
        <meshStandardMaterial color="#c4c8ca" />
      </mesh>
      <Bar from={[0.12, 0.3, 0.1]} to={[0.12, 6.0, 0.1]} radius={0.02} color="#e2852c" />
    </group>
  );
}

/** What gives the central office away: generator, air conditioning, sign, fence. */
export function NroDetails({ width, depth, height }: { width: number; depth: number; height: number }) {
  return (
    <group>
      {/* groupe électrogène */}
      <mesh position={[width / 2 + 1.6, 0.8, 0]} castShadow>
        <boxGeometry args={[1.6, 1.6, 3]} />
        <meshStandardMaterial color="#d9c241" roughness={0.6} />
      </mesh>
      {/* climatiseurs en toiture */}
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, height + 0.5, 1]} castShadow>
          <boxGeometry args={[1.2, 1, 1]} />
          <meshStandardMaterial color="#e6e4df" />
        </mesh>
      ))}
      {/* plaque */}
      <mesh position={[0, height - 1.2, -depth / 2 - 0.03]}>
        <boxGeometry args={[3.2, 0.7, 0.04]} />
        <meshStandardMaterial color="#1d2023" />
      </mesh>
      <mesh position={[0, height - 1.2, -depth / 2 - 0.06]}>
        <boxGeometry args={[2.6, 0.12, 0.02]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
