'use client';

import { CABINET, CENTER_TABLE, CHAIR, DESK, PALETTE, SHELF } from '@/lib/lab3d/specs';

function Leg({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <mesh position={[x, height / 2, z]} castShadow>
      <boxGeometry args={[0.05, height, 0.05]} />
      <meshStandardMaterial color={PALETTE.metal} metalness={0.75} roughness={0.35} />
    </mesh>
  );
}

interface TableProps {
  width: number;
  depth: number;
  height: number;
  /** Goulotte de passage de cables au centre du plateau. */
  cableChannel?: boolean;
}

/** Plateau stratifie sur pietement metallique, avec passage de cables. */
export function Table({ width, depth, height, cableChannel = true }: TableProps) {
  const inset = 0.07;
  const top = 0.04;
  return (
    <group>
      <mesh position={[0, height - top / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, top, depth]} />
        <meshStandardMaterial color={PALETTE.laminate} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* chant */}
      <mesh position={[0, height - top - 0.005, 0]}>
        <boxGeometry args={[width - 0.01, 0.01, depth - 0.01]} />
        <meshStandardMaterial color={PALETTE.darkMetal} roughness={0.6} />
      </mesh>

      <Leg x={-width / 2 + inset} z={-depth / 2 + inset} height={height - top} />
      <Leg x={width / 2 - inset} z={-depth / 2 + inset} height={height - top} />
      <Leg x={-width / 2 + inset} z={depth / 2 - inset} height={height - top} />
      <Leg x={width / 2 - inset} z={depth / 2 - inset} height={height - top} />

      {/* traverses */}
      <mesh position={[0, height - 0.16, -depth / 2 + inset]}>
        <boxGeometry args={[width - inset * 2, 0.04, 0.03]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, height - 0.16, depth / 2 - inset]}>
        <boxGeometry args={[width - inset * 2, 0.04, 0.03]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.7} roughness={0.4} />
      </mesh>

      {cableChannel && (
        <>
          {/* chemin de cables sous plateau */}
          <mesh position={[0, height - 0.13, 0]}>
            <boxGeometry args={[width * 0.6, 0.06, 0.12]} />
            <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.6} roughness={0.5} />
          </mesh>
          {/* passe-cable */}
          <mesh position={[width * 0.25, height - top / 2 + 0.005, -depth / 2 + 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, top + 0.02, 16]} />
            <meshStandardMaterial color={PALETTE.equipment} roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Chaise de laboratoire — assise, dossier, pietement tube. */
export function Chair({ rotation = 0 }: { rotation?: number }) {
  const seatH = 0.46;
  return (
    <group rotation={[0, rotation, 0]}>
      <mesh position={[0, seatH, 0]} castShadow>
        <boxGeometry args={[CHAIR.width, 0.05, CHAIR.depth]} />
        <meshStandardMaterial color={PALETTE.fabric} roughness={0.85} />
      </mesh>
      <mesh position={[0, seatH + 0.22, -CHAIR.depth / 2 + 0.04]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[CHAIR.width - 0.06, 0.38, 0.05]} />
        <meshStandardMaterial color={PALETTE.fabric} roughness={0.85} />
      </mesh>
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[(sx * (CHAIR.width - 0.08)) / 2, seatH / 2, (sz * (CHAIR.depth - 0.08)) / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.018, seatH, 10]} />
            <meshStandardMaterial color={PALETTE.metal} metalness={0.8} roughness={0.3} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[CHAIR.width - 0.08, 0.025, 0.025]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function CenterTable() {
  const [x, z] = CENTER_TABLE.position;
  return (
    <group position={[x, 0, z]}>
      <Table width={CENTER_TABLE.width} depth={CENTER_TABLE.depth} height={CENTER_TABLE.height} />
      {/* goulotte centrale apparente */}
      <mesh position={[0, CENTER_TABLE.height + 0.03, 0]}>
        <boxGeometry args={[CENTER_TABLE.width * 0.7, 0.05, 0.14]} />
        <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.6} roughness={0.45} />
      </mesh>
      {/* platine de montage + breadboard pedagogique */}
      <mesh position={[-0.55, CENTER_TABLE.height + 0.035, 0.28]} castShadow>
        <boxGeometry args={[0.34, 0.025, 0.18]} />
        <meshStandardMaterial color="#e6e3dc" roughness={0.6} />
      </mesh>
      <mesh position={[0.6, CENTER_TABLE.height + 0.05, 0.25]} castShadow>
        <boxGeometry args={[0.26, 0.06, 0.2]} />
        <meshStandardMaterial color={PALETTE.equipment} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* 4 tabourets */}
      {(
        [
          [-0.7, CENTER_TABLE.depth / 2 + 0.42, 0],
          [0.7, CENTER_TABLE.depth / 2 + 0.42, 0],
          [-0.7, -CENTER_TABLE.depth / 2 - 0.42, Math.PI],
          [0.7, -CENTER_TABLE.depth / 2 - 0.42, Math.PI],
        ] as const
      ).map(([sx, sz, r], i) => (
        <group key={i} position={[sx, 0, sz]}>
          <Chair rotation={r} />
        </group>
      ))}
    </group>
  );
}

/** Etagere metallique 4 niveaux, chargee de petit materiel. */
export function Shelf() {
  const levels = SHELF.levels;
  const gap = SHELF.height / levels;
  return (
    <group>
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={i} position={[0, i * gap, 0]} castShadow receiveShadow>
          <boxGeometry args={[SHELF.width, 0.03, SHELF.depth]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[(sx * (SHELF.width - 0.06)) / 2, SHELF.height / 2, (sz * (SHELF.depth - 0.06)) / 2]}
            castShadow
          >
            <boxGeometry args={[0.05, SHELF.height, 0.05]} />
            <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.7} roughness={0.4} />
          </mesh>
        )),
      )}

      {/* bacs, couronnes de cables BNC, breadboards */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`bin-${i}`} position={[-0.95 + i * 0.28, gap + 0.09, 0]} castShadow>
          <boxGeometry args={[0.24, 0.16, 0.3]} />
          <meshStandardMaterial color={i % 2 ? '#8d939a' : '#6f757b'} roughness={0.75} />
        </mesh>
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={`coil-${i}`} position={[-0.8 + i * 0.4, 2 * gap + 0.05, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.11, 0.018, 8, 20]} />
          <meshStandardMaterial color={PALETTE.cable} roughness={0.85} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`bb-${i}`} position={[-1.0 + i * 0.22, 3 * gap + 0.02, -0.02]} rotation={[0, 0.06 * i, 0]} castShadow>
          <boxGeometry args={[0.17, 0.02, 0.11]} />
          <meshStandardMaterial color="#efece4" roughness={0.6} />
        </mesh>
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={`box-${i}`} position={[0.55 + i * 0.35, 4 * gap + 0.11, 0]} castShadow>
          <boxGeometry args={[0.3, 0.22, 0.34]} />
          <meshStandardMaterial color="#c9c4b9" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Armoire de rangement fermee. */
export function Cabinet() {
  return (
    <group>
      <mesh position={[0, CABINET.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[CABINET.width, CABINET.height, CABINET.depth]} />
        <meshStandardMaterial color="#b6babd" metalness={0.45} roughness={0.55} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.03, 1.05, CABINET.depth / 2 + 0.012]}>
          <boxGeometry args={[0.02, 0.26, 0.02]} />
          <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, CABINET.height / 2, CABINET.depth / 2 + 0.006]}>
        <boxGeometry args={[0.01, CABINET.height - 0.1, 0.006]} />
        <meshStandardMaterial color={PALETTE.darkMetal} roughness={0.6} />
      </mesh>
    </group>
  );
}

export { DESK };
