'use client';

import { useCanvasTexture } from '@/lib/lab3d/geometry';
import { drawLesson, type LessonContext } from '@/lib/lab3d/screens';
import type { SignalSettings } from '@/lib/lab3d/signal';
import { BIG_SCREEN, BOUNDS, PALETTE } from '@/lib/lab3d/specs';

export default function BigScreen({
  signal,
  lesson,
}: {
  signal: SignalSettings;
  lesson?: LessonContext;
}) {
  const map = useCanvasTexture(
    1280,
    704,
    (ctx, w, h) => drawLesson(ctx, w, h, signal, lesson),
    [signal, lesson],
  );
  const y = BIG_SCREEN.bottom + BIG_SCREEN.height / 2;
  const z = BOUNDS.minZ + 0.06;

  return (
    <group position={[0, y, z]}>
      {/* chassis */}
      <mesh castShadow>
        <boxGeometry args={[BIG_SCREEN.width + 0.08, BIG_SCREEN.height + 0.08, 0.09]} />
        <meshStandardMaterial color="#1c2024" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[BIG_SCREEN.width, BIG_SCREEN.height]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ffffff"
          emissiveIntensity={0.7}
          roughness={0.32}
        />
      </mesh>
      {/* halo doux de la dalle sur la salle */}
      <pointLight position={[0, 0, 1.2]} intensity={3.5} distance={5} decay={2} color="#cfd8de" />
      {/* liseré d'accent, unique repere colore du mur avant */}
      <mesh position={[0, -BIG_SCREEN.height / 2 - 0.06, 0.02]}>
        <boxGeometry args={[BIG_SCREEN.width + 0.08, 0.012, 0.05]} />
        <meshStandardMaterial color={PALETTE.accent} emissive={PALETTE.accent} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
