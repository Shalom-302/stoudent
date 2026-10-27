'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  BOUNDS,
  CEILING_PANELS,
  DOOR,
  FRONT_WINDOWS,
  LEFT_WINDOWS,
  PALETTE,
  ROOM,
  WINDOW,
} from '@/lib/lab3d/specs';
import { useCanvasTexture, wallSegments, type Opening } from '@/lib/lab3d/geometry';

const T = ROOM.wallThickness;

/** Dalle : joints de 2 m, gris clair mat, pas de blanc pur. */
function Floor() {
  const base = useCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = PALETTE.floor;
      ctx.fillRect(0, 0, w, h);
      // grain discret
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      ctx.strokeStyle = PALETTE.floorLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    },
    [],
  );

  const map = useMemo(() => {
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.repeat.set(ROOM.width / 2, ROOM.depth / 2);
    return base;
  }, [base]);

  return (
    <mesh receiveShadow position={[0, -ROOM.slabThickness / 2, 0]}>
      <boxGeometry args={[ROOM.width, ROOM.slabThickness, ROOM.depth]} />
      <meshStandardMaterial map={map} roughness={0.88} metalness={0.02} />
    </mesh>
  );
}

function Ceiling() {
  return (
    <mesh position={[0, ROOM.height + 0.05, 0]} receiveShadow>
      <boxGeometry args={[ROOM.width + T * 2, 0.1, ROOM.depth + T * 2]} />
      <meshStandardMaterial color={PALETTE.ceiling} roughness={0.95} />
    </mesh>
  );
}

interface WallProps {
  axis: 'x' | 'z';
  /** Position du plan du mur sur l'axe oppose. */
  offset: number;
  length: number;
  openings?: Opening[];
}

function Wall({ axis, offset, length, openings = [] }: WallProps) {
  const segments = useMemo(() => wallSegments(length, ROOM.height, openings), [length, openings]);

  return (
    <group>
      {segments.map((s, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={axis === 'x' ? [s.u, s.y, offset] : [offset, s.y, s.u]}
        >
          <boxGeometry
            args={axis === 'x' ? [s.width, s.height, T] : [T, s.height, s.width]}
          />
          <meshStandardMaterial color={PALETTE.wall} roughness={0.92} />
        </mesh>
      ))}
      {/* plinthe */}
      <mesh position={axis === 'x' ? [0, 0.06, offset + (offset < 0 ? T / 2 : -T / 2)] : [offset + (offset < 0 ? T / 2 : -T / 2), 0.06, 0]}>
        <boxGeometry args={axis === 'x' ? [length, 0.12, 0.02] : [0.02, 0.12, length]} />
        <meshStandardMaterial color={PALETTE.skirting} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Menuiserie + vitrage d'une baie. */
function WindowUnit({ axis, offset, u }: { axis: 'x' | 'z'; offset: number; u: number }) {
  const { width, height, sill } = WINDOW;
  const y = sill + height / 2;
  const frame = 0.06;

  const pos = (du: number, dy: number): [number, number, number] =>
    axis === 'x' ? [u + du, y + dy, offset] : [offset, y + dy, u + du];
  const size = (w: number, h: number, d: number): [number, number, number] =>
    axis === 'x' ? [w, h, d] : [d, h, w];

  return (
    <group>
      {/* dormant */}
      {(
        [
          [0, height / 2, width, frame],
          [0, -height / 2, width, frame],
          [-width / 2, 0, frame, height],
          [width / 2, 0, frame, height],
          [0, 0, frame * 0.7, height], // meneau central
        ] as const
      ).map(([du, dy, w, h], i) => (
        <mesh key={i} position={pos(du, dy)} castShadow>
          <boxGeometry args={size(w, h, T * 1.05)} />
          <meshStandardMaterial color="#d9d7d2" roughness={0.5} metalness={0.25} />
        </mesh>
      ))}
      {/* vitrage legerement reflechissant */}
      <mesh position={pos(0, 0)}>
        <boxGeometry args={size(width - frame, height - frame, 0.02)} />
        <meshPhysicalMaterial
          color="#cfe0e6"
          transparent
          opacity={0.28}
          roughness={0.06}
          metalness={0.1}
          transmission={0.6}
        />
      </mesh>
      {/* appui */}
      <mesh position={pos(0, -height / 2 - 0.06)}>
        <boxGeometry args={size(width + 0.1, 0.04, T + 0.06)} />
        <meshStandardMaterial color={PALETTE.skirting} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Door() {
  const z = BOUNDS.maxZ + T / 2;
  return (
    <group position={[DOOR.x, 0, z]}>
      {/* huisserie */}
      {(
        [
          [-DOOR.width / 2 - 0.04, DOOR.height / 2, 0.08, DOOR.height],
          [DOOR.width / 2 + 0.04, DOOR.height / 2, 0.08, DOOR.height],
          [0, DOOR.height + 0.04, DOOR.width + 0.16, 0.08],
        ] as const
      ).map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]} castShadow>
          <boxGeometry args={[w, h, T * 1.1]} />
          <meshStandardMaterial color="#cfccc6" roughness={0.6} />
        </mesh>
      ))}
      {/* vantail entrouvert */}
      <group position={[-DOOR.width / 2, 0, 0]} rotation={[0, -0.35, 0]}>
        <mesh position={[DOOR.width / 2, DOOR.height / 2, 0]} castShadow>
          <boxGeometry args={[DOOR.width, DOOR.height, 0.045]} />
          <meshStandardMaterial color="#b9b4ab" roughness={0.65} />
        </mesh>
        <mesh position={[DOOR.width - 0.09, 1.05, -0.05]}>
          <boxGeometry args={[0.12, 0.025, 0.025]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** Panneaux LED 1.20 x 0.30 encastres. */
function CeilingPanels() {
  return (
    <group>
      {CEILING_PANELS.map(([x, z], i) => (
        <group key={i} position={[x, ROOM.height - 0.01, z]}>
          <mesh>
            <boxGeometry args={[1.2, 0.02, 0.3]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fdf6e6"
              emissiveIntensity={1.6}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[1.26, 0.03, 0.36]} />
            <meshStandardMaterial color="#e2e0dc" roughness={0.6} metalness={0.3} />
          </mesh>
          {i % 2 === 0 && (
            <pointLight position={[0, -0.4, 0]} intensity={7} distance={9} decay={2} color="#fff6e3" />
          )}
        </group>
      ))}
    </group>
  );
}

/** Panneau institutionnel (section 4.2). */
function WallSign() {
  const map = useCanvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f6f3';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(0, 0, 10, h);
      ctx.fillStyle = '#20252a';
      ctx.font = '600 46px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillText('Signal Lab', 34, 62);
      ctx.fillStyle = '#6d7479';
      ctx.font = '400 24px "IBM Plex Mono", monospace';
      ctx.fillText('Traitement du signal — salle 1', 34, 98);
    },
    [],
  );

  return (
    <mesh position={[BOUNDS.minX + 0.011, 2.35, 3.2]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[1.6, 0.4]} />
      <meshStandardMaterial map={map} roughness={0.7} />
    </mesh>
  );
}

export default function Room() {
  const frontOpenings: Opening[] = useMemo(
    () => FRONT_WINDOWS.map((x) => ({ center: x, width: WINDOW.width, bottom: WINDOW.sill, height: WINDOW.height })),
    [],
  );
  const leftOpenings: Opening[] = useMemo(
    () => LEFT_WINDOWS.map((z) => ({ center: z, width: WINDOW.width, bottom: WINDOW.sill, height: WINDOW.height })),
    [],
  );
  const backOpenings: Opening[] = useMemo(
    () => [{ center: DOOR.x, width: DOOR.width, bottom: 0, height: DOOR.height }],
    [],
  );

  return (
    <group>
      <Floor />
      <Ceiling />

      <Wall axis="x" offset={BOUNDS.minZ - T / 2} length={ROOM.width} openings={frontOpenings} />
      <Wall axis="x" offset={BOUNDS.maxZ + T / 2} length={ROOM.width} openings={backOpenings} />
      <Wall axis="z" offset={BOUNDS.minX - T / 2} length={ROOM.depth} openings={leftOpenings} />
      <Wall axis="z" offset={BOUNDS.maxX + T / 2} length={ROOM.depth} />

      {FRONT_WINDOWS.map((x) => (
        <WindowUnit key={`fw-${x}`} axis="x" offset={BOUNDS.minZ - T / 2} u={x} />
      ))}
      {LEFT_WINDOWS.map((z) => (
        <WindowUnit key={`lw-${z}`} axis="z" offset={BOUNDS.minX - T / 2} u={z} />
      ))}

      <Door />
      <CeilingPanels />
      <WallSign />
    </group>
  );
}
