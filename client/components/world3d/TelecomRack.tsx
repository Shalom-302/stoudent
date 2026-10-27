'use client';

import { useMemo } from 'react';
import { cableCurve } from '@/lib/lab3d/geometry';
import { PALETTE, RACK } from '@/lib/lab3d/specs';

const U = RACK.height / RACK.units;

interface RackItem {
  /** Position en U depuis le bas. */
  u: number;
  height: number; // en U
  label: 'patch' | 'switch' | 'router' | 'blank' | 'shelf';
}

const ITEMS: RackItem[] = [
  { u: 38, height: 1, label: 'patch' },
  { u: 36, height: 1, label: 'patch' },
  { u: 34, height: 1, label: 'switch' },
  { u: 32, height: 1, label: 'switch' },
  { u: 29, height: 2, label: 'router' },
  { u: 26, height: 2, label: 'blank' },
  { u: 20, height: 3, label: 'shelf' },
  { u: 14, height: 2, label: 'blank' },
];

function Ports({ count, width, y, z }: { count: number; width: number; y: number; z: number }) {
  const step = width / count;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[-width / 2 + step * (i + 0.5), y, z]}>
          <boxGeometry args={[step * 0.6, 0.012, 0.004]} />
          <meshStandardMaterial color="#15181b" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Item({ item }: { item: RackItem }) {
  const h = item.height * U * 0.92;
  const y = item.u * U + h / 2;
  const w = RACK.width - 0.08;
  const d = item.label === 'router' || item.label === 'switch' ? 0.45 : 0.1;
  const color =
    item.label === 'blank' ? '#4c5257' : item.label === 'shelf' ? '#6a7075' : PALETTE.equipment;

  return (
    <group>
      <mesh position={[0, y, -RACK.depth / 2 + d / 2 + 0.05]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.55} />
      </mesh>

      {(item.label === 'patch' || item.label === 'switch') && (
        <Ports count={12} width={w * 0.8} y={y} z={-RACK.depth / 2 + 0.052} />
      )}

      {item.label === 'switch' && (
        <group>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-w * 0.36 + i * 0.03, y + h * 0.3, -RACK.depth / 2 + 0.053]}>
              <boxGeometry args={[0.006, 0.006, 0.003]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? PALETTE.accent : '#4fd18b'}
                emissive={i % 3 === 0 ? PALETTE.accent : '#4fd18b'}
                emissiveIntensity={2}
              />
            </mesh>
          ))}
        </group>
      )}

      {item.label === 'router' && (
        <group>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[-w * 0.3 + i * 0.05, y + h * 0.2, -RACK.depth / 2 + 0.053]}>
              <boxGeometry args={[0.008, 0.008, 0.003]} />
              <meshStandardMaterial color="#4fd18b" emissive="#4fd18b" emissiveIntensity={1.8} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** Brassage ethernet organise entre deux panneaux. */
function PatchCords() {
  const cords = useMemo(() => {
    const out: { from: [number, number, number]; to: [number, number, number]; color: string }[] = [];
    const colors = ['#2f6fb0', '#2f6fb0', '#3f8f5f', '#c9a227', '#2f6fb0', '#3f8f5f'];
    for (let i = 0; i < 6; i++) {
      const x = -0.2 + i * 0.07;
      out.push({
        from: [x, 38.4 * U, -RACK.depth / 2 + 0.06],
        to: [x + 0.01, 34.4 * U, -RACK.depth / 2 + 0.06],
        color: colors[i],
      });
    }
    return out;
  }, []);

  return (
    <group>
      {cords.map((c, i) => {
        const curve = cableCurve(c.from, c.to, -0.16 - (i % 3) * 0.03);
        return (
          <mesh key={i}>
            <tubeGeometry args={[curve, 24, 0.0035, 6, false]} />
            <meshStandardMaterial color={c.color} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function TelecomRack() {
  const frame = 0.04;
  return (
    <group>
      {/* montants et habillage */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[(s * (RACK.width - frame)) / 2, RACK.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[frame, RACK.height, RACK.depth]} />
          <meshStandardMaterial color="#33383d" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, RACK.height + 0.02, 0]} castShadow>
        <boxGeometry args={[RACK.width, 0.04, RACK.depth]} />
        <meshStandardMaterial color="#33383d" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[RACK.width, 0.06, RACK.depth]} />
        <meshStandardMaterial color="#26292c" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* joue arriere */}
      <mesh position={[0, RACK.height / 2, RACK.depth / 2 - 0.01]}>
        <boxGeometry args={[RACK.width - frame, RACK.height, 0.02]} />
        <meshStandardMaterial color="#2b2f33" roughness={0.7} />
      </mesh>

      {ITEMS.map((item, i) => (
        <Item key={i} item={item} />
      ))}
      <PatchCords />
    </group>
  );
}
