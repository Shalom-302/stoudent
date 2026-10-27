'use client';

import { useCanvasTexture } from '@/lib/lab3d/geometry';
import { drawWhiteboard, type LessonContext } from '@/lib/lab3d/screens';
import { BOUNDS, PALETTE, WHITEBOARD } from '@/lib/lab3d/specs';

export default function Whiteboard({ lesson }: { lesson?: LessonContext }) {
  const map = useCanvasTexture(
    1024,
    512,
    (ctx, w, h) => drawWhiteboard(ctx, w, h, lesson),
    [lesson],
  );
  const y = WHITEBOARD.bottom + WHITEBOARD.height / 2;

  return (
    <group position={[BOUNDS.minX + 0.03, y, -3.5]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[WHITEBOARD.width + 0.06, WHITEBOARD.height + 0.06, 0.04]} />
        <meshStandardMaterial color="#b8bcbf" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[WHITEBOARD.width, WHITEBOARD.height]} />
        <meshStandardMaterial map={map} roughness={0.25} metalness={0.05} />
      </mesh>
      {/* tablette a feutres */}
      <mesh position={[0, -WHITEBOARD.height / 2 - 0.06, 0.05]} castShadow>
        <boxGeometry args={[WHITEBOARD.width * 0.9, 0.025, 0.07]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.3, -0.18, -0.06].map((x, i) => (
        <mesh key={i} position={[x, -WHITEBOARD.height / 2 - 0.04, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
          <meshStandardMaterial color={['#2f5fa8', '#1f7a5c', '#b4342a'][i]} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
