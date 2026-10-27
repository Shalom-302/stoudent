'use client';

import { useMemo } from 'react';
import { cableCurve } from '@/lib/lab3d/geometry';
import { PALETTE } from '@/lib/lab3d/specs';

interface CableProps {
  from: [number, number, number];
  to: [number, number, number];
  sag?: number;
  radius?: number;
  color?: string;
}

/**
 * Un cable ne doit jamais etre rectiligne ni flottant (section 14) :
 * courbe de Catmull-Rom avec affaissement, extrudee en tube.
 */
export function Cable({ from, to, sag = 0.1, radius = 0.006, color = PALETTE.cable }: CableProps) {
  const curve = useMemo(() => cableCurve(from, to, sag), [from, to, sag]);
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 28, radius, 7, false]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

/** Faisceau de plusieurs cables paralleles, legerement decales. */
export function CableBundle({
  from,
  to,
  count = 3,
  spread = 0.02,
  color = PALETTE.cableAlt,
}: {
  from: [number, number, number];
  to: [number, number, number];
  count?: number;
  spread?: number;
  color?: string;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const o = (i - (count - 1) / 2) * spread;
        return (
          <Cable
            key={i}
            from={[from[0] + o, from[1], from[2]]}
            to={[to[0] + o, to[1], to[2] + o * 0.5]}
            sag={0.08 + i * 0.015}
            radius={0.004}
            color={color}
          />
        );
      })}
    </group>
  );
}
