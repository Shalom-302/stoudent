'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import Avatar from '@/components/world3d/Avatar';
import type { PlayerTracker } from '@/components/world3d/Player';
import { CURB, EXTENT, LANES, MOVING, PARKED_CARS, carFootprint } from '@/lib/terrain/city';

/**
 * Street life: cars driving on the right and passers-by on the sidewalks.
 * Simple rules, enough to read as a street: cars keep their distance, stop
 * for the student, and the side street gives way to the boulevard.
 */

type Dir = 'E' | 'W' | 'S' | 'N';
const HEADING: Record<Dir, number> = { E: Math.PI / 2, W: -Math.PI / 2, S: 0, N: Math.PI };
const VEL: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
const WRAP = EXTENT + 25;
const CRUISE = 9; // m/s, about 32 km/h in a district
const GAP = 5.5; // bumper-to-bumper distance kept, m

interface Car {
  dir: Dir;
  /** Position along the lane. */
  s: number;
  speed: number;
  color: string;
}

function laneXZ(car: Car): [number, number] {
  switch (car.dir) {
    case 'E':
      return [car.s, LANES.eastbound];
    case 'W':
      return [car.s, LANES.westbound];
    case 'S':
      return [LANES.southbound, car.s];
    case 'N':
      return [LANES.northbound, car.s];
  }
}

/** Body, cabin with glass, wheels and lights, merged; white parts take the paint colour. */
function carGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, rgb: [number, number, number]) => {
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set(rgb, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(g.toNonIndexed());
  };
  const paint: [number, number, number] = [1, 1, 1];
  add(new THREE.BoxGeometry(1.78, 0.62, 4.3).translate(0, 0.62, 0), paint);
  add(new THREE.BoxGeometry(1.6, 0.18, 1.0).translate(0, 0.98, 1.45), paint); // capot
  add(new THREE.BoxGeometry(1.62, 0.55, 2.1).translate(0, 1.2, -0.25), [0.1, 0.12, 0.14]); // vitres
  add(new THREE.BoxGeometry(1.58, 0.07, 1.9).translate(0, 1.5, -0.3), paint); // toit
  for (const [x, z] of [
    [-0.82, 1.35],
    [0.82, 1.35],
    [-0.82, -1.35],
    [0.82, -1.35],
  ]) {
    add(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2).translate(x, 0.33, z), [0.05, 0.05, 0.05]);
  }
  add(new THREE.BoxGeometry(1.5, 0.12, 0.05).translate(0, 0.78, 2.16), [1, 0.97, 0.85]); // phares
  add(new THREE.BoxGeometry(1.5, 0.12, 0.05).translate(0, 0.8, -2.16), [0.8, 0.08, 0.06]); // feux
  return mergeGeometries(parts)!;
}

// Orange: the taxis compteurs; blue: Yopougon's woro-woro.
const COLORS = ['#e8731a', '#e6e6e2', '#2f6fb3', '#9ea3a7', '#1c1e21', '#e8731a', '#7a1f1f', '#2f6fb3', '#d9d6cc', '#e8731a'];

function initialCars(): Car[] {
  const spawn: [Dir, number][] = [
    ['E', -60], ['E', -15], ['E', 35],
    ['W', 55], ['W', 10], ['W', -40],
    ['S', -50], ['S', 30],
    ['N', 50], ['N', -25],
  ];
  return spawn.map(([dir, s], i) => ({ dir, s, speed: CRUISE * 0.8, color: COLORS[i % COLORS.length] }));
}

/** Distance along `car`'s lane to the nearest thing it must not hit, or Infinity. */
function obstacleAhead(car: Car, cars: Car[], player: PlayerTracker): number {
  const [x, z] = laneXZ(car);
  const [vx, vz] = VEL[car.dir];
  let nearest = Infinity;
  const consider = (ox: number, oz: number, halfWidth: number, shift: number) => {
    const ahead = (ox - x) * vx + (oz - z) * vz;
    const lateral = Math.abs((ox - x) * vz - (oz - z) * vx);
    if (ahead > 0 && lateral < halfWidth) nearest = Math.min(nearest, ahead - shift);
  };
  consider(player.x, player.z, 1.4, 2.6);
  for (const other of cars) {
    if (other === car) continue;
    const [ox, oz] = laneXZ(other);
    consider(ox, oz, 1.5, 4.3);
  }
  // The side street gives way: hold at the stop line while the boulevard is busy.
  if (car.dir === 'S' || car.dir === 'N') {
    const line = car.dir === 'S' ? -6.5 : 6.5;
    const before = car.dir === 'S' ? z < line && z > line - 14 : z > line && z < line + 14;
    // Busy = a boulevard car about to cross, or crossing (distance to the
    // crossing centre, along its own direction, between -4 and 12 m).
    const busy = cars.some((o) => {
      if (o.dir !== 'E' && o.dir !== 'W') return false;
      const toCrossing = o.dir === 'E' ? -laneXZ(o)[0] : laneXZ(o)[0];
      return toCrossing > -4 && toCrossing < 12;
    });
    if (before && busy) nearest = Math.min(nearest, Math.abs(line - z) - 2.2);
  } else {
    // The boulevard waits only for a car already inside the crossing.
    const boxed = cars.some((o) => {
      if (o.dir !== 'S' && o.dir !== 'N') return false;
      const [ox, oz] = laneXZ(o);
      return Math.abs(ox) < 5 && Math.abs(oz) < 6;
    });
    const toBox = car.dir === 'E' ? -5 - x : x - 5;
    if (boxed && toBox > 0 && toBox < 12) nearest = Math.min(nearest, toBox - 2.2);
  }
  return nearest;
}

export function Traffic({ tracker }: { tracker: PlayerTracker }) {
  const geometry = useMemo(carGeometry, []);
  const cars = useMemo(initialCars, []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    MOVING.length = 0;
    for (const car of cars) {
      const gap = obstacleAhead(car, cars, tracker);
      const target = gap < Infinity ? Math.min(CRUISE, Math.max(0, (gap - GAP) * 1.6)) : CRUISE;
      const rate = target < car.speed ? 9 : 2.5; // brakes harder than it accelerates
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);
      const sign = car.dir === 'E' || car.dir === 'S' ? 1 : -1;
      car.s += sign * car.speed * dt;
      if (car.s > WRAP) car.s = -WRAP;
      if (car.s < -WRAP) car.s = WRAP;
      const [x, z] = laneXZ(car);
      MOVING.push(carFootprint(x, z, HEADING[car.dir]));
    }
    cars.forEach((car, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const [x, z] = laneXZ(car);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = HEADING[car.dir];
    });
  });

  return (
    <group>
      {cars.map((car, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={geometry}
          castShadow
        >
          <meshStandardMaterial color={car.color} vertexColors metalness={0.35} roughness={0.4} />
        </mesh>
      ))}
      {PARKED_CARS.map(([x, z, heading, color]) => (
        <mesh key={`${x}:${z}`} geometry={geometry} position={[x, 0, z]} rotation={[0, heading, 0]} castShadow>
          <meshStandardMaterial color={color} vertexColors metalness={0.35} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

// -- Passers-by -----------------------------------------------------------------

const PATHS: { from: [number, number]; to: [number, number] }[] = [
  { from: [-60, -6.1], to: [-12, -6.1] },
  { from: [14, -6.1], to: [62, -6.1] },
  { from: [-44, 6.0], to: [-9, 6.0] },
  { from: [5.6, 14], to: [5.6, 60] },
  { from: [-5.6, -60], to: [-5.6, -13] },
  { from: [10, 38.2], to: [60, 38.2] },
];
const LOOKS = [
  { outfit: '#c2402a', outfitLight: '#d4573f', skin: '#7d4f33', hair: '#1d1a17' },
  { outfit: '#f2f0ea', outfitLight: '#ffffff', skin: '#5e3b26', hair: '#141210' },
  { outfit: '#2c6e49', outfitLight: '#3d8a5e', skin: '#8a5a3b', hair: '#1d1a17' },
  { outfit: '#e2b23a', outfitLight: '#efc65a', skin: '#6b4329', hair: '#141210' },
  { outfit: '#3a3f6b', outfitLight: '#4e5486', skin: '#a9784f', hair: '#2c2620' },
  { outfit: '#8e3b74', outfitLight: '#a54f8a', skin: '#5e3b26', hair: '#141210' },
];
/** Beyond this distance a passer-by is not drawn: each one is ~20 parts. */
const DRAW_DISTANCE = 45;

function Walker({ index, tracker }: { index: number; tracker: PlayerTracker }) {
  const path = PATHS[index];
  const group = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
  const state = useRef({ t: (index * 0.37) % 1, forward: index % 2 === 0, pace: 1.15 + (index % 3) * 0.15 });
  const length = Math.hypot(path.to[0] - path.from[0], path.to[1] - path.from[1]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const x = path.from[0] + (path.to[0] - path.from[0]) * s.t;
    const z = path.from[1] + (path.to[1] - path.from[1]) * s.t;
    const dx = (path.to[0] - path.from[0]) / length;
    const dz = (path.to[1] - path.from[1]) / length;
    const sign = s.forward ? 1 : -1;
    // Stop rather than walk through the student.
    const ahead = ((tracker.x - x) * dx + (tracker.z - z) * dz) * sign;
    const side = Math.abs((tracker.x - x) * dz - (tracker.z - z) * dx);
    const yielding = ahead > 0 && ahead < 1.6 && side < 0.8;
    speedRef.current = yielding ? 0 : s.pace;
    s.t += (sign * speedRef.current * Math.min(delta, 0.1)) / length;
    if (s.t > 1 || s.t < 0) {
      s.t = Math.min(1, Math.max(0, s.t));
      s.forward = !s.forward;
    }
    g.position.set(x, CURB, z);
    g.rotation.y = Math.atan2(dx * sign, dz * sign);
    g.visible = Math.hypot(tracker.x - x, tracker.z - z) < DRAW_DISTANCE;
  });

  return (
    <group ref={group}>
      <Avatar speedRef={speedRef} {...LOOKS[index % LOOKS.length]} />
    </group>
  );
}

export function Pedestrians({ tracker }: { tracker: PlayerTracker }) {
  return (
    <group>
      {PATHS.map((_, i) => (
        <Walker key={i} index={i} tracker={tracker} />
      ))}
    </group>
  );
}
