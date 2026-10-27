'use client';

import { RoundedBox } from '@react-three/drei';
import { useCanvasTexture } from '@/lib/lab3d/geometry';
import { drawGenerator, drawPowerSupply, drawScope, drawSpectrum } from '@/lib/lab3d/screens';
import type { SignalSettings } from '@/lib/lab3d/signal';
import { PALETTE } from '@/lib/lab3d/specs';

/* ------------------------------------------------------------------ */
/* Pieces communes                                                      */
/* ------------------------------------------------------------------ */

function Knob({ position, radius = 0.016, depth = 0.018 }: { position: [number, number, number]; radius?: number; depth?: number }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius * 0.92, depth, 16]} />
        <meshStandardMaterial color="#5a6167" metalness={0.5} roughness={0.42} />
      </mesh>
      <mesh position={[0, radius * 0.55, depth / 2 + 0.001]}>
        <boxGeometry args={[radius * 0.22, radius * 0.7, 0.002]} />
        <meshStandardMaterial color="#d7dbde" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Bnc({ position, live = false }: { position: [number, number, number]; live?: boolean }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, 0.018, 12]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.011]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.006, 8]} />
        <meshStandardMaterial color={live ? PALETTE.accent : '#c8cbce'} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Led({ position, color = '#7ee0b0' }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.004, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} />
    </mesh>
  );
}

function Feet({ width, depth }: { width: number; depth: number }) {
  return (
    <group>
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (width - 0.05)) / 2, -0.006, (sz * (depth - 0.04)) / 2]}>
            <cylinderGeometry args={[0.008, 0.009, 0.012, 8]} />
            <meshStandardMaterial color="#1c1f22" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

function LabelPlate({
  position,
  width,
  height,
  lines,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  lines: string[];
}) {
  const map = useCanvasTexture(
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#3a4045';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b6bdc2';
      ctx.font = '500 20px "IBM Plex Mono", monospace';
      lines.forEach((l, i) => ctx.fillText(l, 8, 26 + i * 26));
    },
    [lines.join('|')],
  );
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map} roughness={0.7} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Oscilloscope — 0.30 x 0.18 x 0.15                                    */
/* ------------------------------------------------------------------ */

export function Oscilloscope({ signal }: { signal: SignalSettings }) {
  const W = 0.3;
  const H = 0.18;
  const D = 0.15;
  const map = useCanvasTexture(512, 320, (ctx, w, h) => drawScope(ctx, w, h, signal), [signal]);

  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.008} smoothness={3} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.equipment} roughness={0.55} metalness={0.25} />
      </RoundedBox>
      {/* facade rapportee */}
      <mesh position={[0, H / 2, D / 2 + 0.002]} castShadow>
        <boxGeometry args={[W - 0.008, H - 0.008, 0.006]} />
        <meshStandardMaterial color={PALETTE.equipmentFace} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* cadre + dalle */}
      <mesh position={[-0.055, H / 2 + 0.012, D / 2 + 0.006]}>
        <boxGeometry args={[0.175, 0.115, 0.004]} />
        <meshStandardMaterial color="#14181b" roughness={0.6} />
      </mesh>
      <mesh position={[-0.055, H / 2 + 0.012, D / 2 + 0.009]}>
        <planeGeometry args={[0.16, 0.1]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.35} />
      </mesh>

      {/* commandes : vertical / horizontal / trigger */}
      <Knob position={[0.075, H - 0.042, D / 2 + 0.009]} radius={0.018} />
      <Knob position={[0.122, H - 0.042, D / 2 + 0.009]} radius={0.013} />
      <Knob position={[0.075, H - 0.095, D / 2 + 0.009]} radius={0.013} />
      <Knob position={[0.122, H - 0.095, D / 2 + 0.009]} radius={0.011} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.055 + i * 0.022, 0.032, D / 2 + 0.008]}>
          <boxGeometry args={[0.014, 0.008, 0.004]} />
          <meshStandardMaterial color="#6d757b" roughness={0.6} />
        </mesh>
      ))}

      {/* entrees CH1 / CH2 */}
      <Bnc position={[-0.105, 0.028, D / 2 + 0.008]} live />
      <Bnc position={[-0.07, 0.028, D / 2 + 0.008]} />
      <LabelPlate position={[-0.087, 0.012, D / 2 + 0.006]} width={0.07} height={0.012} lines={['CH1   CH2']} />

      <Led position={[0.142, H - 0.014, D / 2 + 0.008]} />
      <Led position={[0.128, H - 0.014, D / 2 + 0.008]} color="#f2b705" />
      <Feet width={W} depth={D} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Generateur de fonctions — 0.25 x 0.18 x 0.10                         */
/* ------------------------------------------------------------------ */

export function FunctionGenerator({ signal }: { signal: SignalSettings }) {
  const W = 0.25;
  const H = 0.18;
  const D = 0.1;
  const map = useCanvasTexture(384, 128, (ctx, w, h) => drawGenerator(ctx, w, h, signal), [signal]);

  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.006} smoothness={3} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.equipment} roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, H / 2, D / 2 + 0.002]}>
        <boxGeometry args={[W - 0.008, H - 0.008, 0.005]} />
        <meshStandardMaterial color={PALETTE.equipmentFace} roughness={0.6} metalness={0.2} />
      </mesh>

      <mesh position={[-0.04, H - 0.045, D / 2 + 0.006]}>
        <planeGeometry args={[0.14, 0.05]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.35} />
      </mesh>

      <Knob position={[0.082, H - 0.05, D / 2 + 0.006]} radius={0.02} />
      <LabelPlate position={[-0.04, H - 0.095, D / 2 + 0.005]} width={0.14} height={0.016} lines={['SINE  SQR  TRI']} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.088 + i * 0.048, H - 0.125, D / 2 + 0.006]}>
          <boxGeometry args={[0.03, 0.014, 0.005]} />
          <meshStandardMaterial
            color={['sine', 'square', 'triangle'][i] === signal.waveform ? PALETTE.accent : '#6d757b'}
            emissive={['sine', 'square', 'triangle'][i] === signal.waveform ? PALETTE.accent : '#000000'}
            emissiveIntensity={0.5}
            roughness={0.6}
          />
        </mesh>
      ))}

      <Bnc position={[0.085, 0.03, D / 2 + 0.006]} live />
      <LabelPlate position={[0.085, 0.012, D / 2 + 0.005]} width={0.04} height={0.011} lines={['OUT']} />
      <Feet width={W} depth={D} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Alimentation stabilisee — 0.25 x 0.20 x 0.12                         */
/* ------------------------------------------------------------------ */

export function PowerSupply() {
  const W = 0.25;
  const H = 0.2;
  const D = 0.12;
  const map = useCanvasTexture(256, 128, (ctx, w, h) => drawPowerSupply(ctx, w, h), []);

  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.006} smoothness={3} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3b4045" roughness={0.6} metalness={0.25} />
      </RoundedBox>
      <mesh position={[-0.05, H - 0.05, D / 2 + 0.004]}>
        <planeGeometry args={[0.11, 0.06]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      <Knob position={[0.07, H - 0.05, D / 2 + 0.004]} radius={0.017} />
      <Knob position={[0.07, H - 0.105, D / 2 + 0.004]} radius={0.013} />
      {/* bornes + / - */}
      <mesh position={[-0.06, 0.04, D / 2 + 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.014, 10]} />
        <meshStandardMaterial color="#b4342a" roughness={0.5} />
      </mesh>
      <mesh position={[-0.02, 0.04, D / 2 + 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.014, 10]} />
        <meshStandardMaterial color="#1b1e21" roughness={0.6} />
      </mesh>
      <Led position={[0.1, H - 0.016, D / 2 + 0.004]} />
      <Feet width={W} depth={D} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Analyseur de spectre — 0.45 x 0.26 x 0.22                            */
/* ------------------------------------------------------------------ */

export function SpectrumAnalyzer({ signal }: { signal: SignalSettings }) {
  const W = 0.45;
  const H = 0.26;
  const D = 0.22;
  const map = useCanvasTexture(640, 400, (ctx, w, h) => drawSpectrum(ctx, w, h, signal), [signal]);

  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.01} smoothness={3} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.equipment} roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, H / 2, D / 2 + 0.002]}>
        <boxGeometry args={[W - 0.01, H - 0.01, 0.006]} />
        <meshStandardMaterial color={PALETTE.equipmentFace} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[-0.08, H / 2 + 0.015, D / 2 + 0.006]}>
        <boxGeometry args={[0.26, 0.17, 0.004]} />
        <meshStandardMaterial color="#14181b" roughness={0.6} />
      </mesh>
      <mesh position={[-0.08, H / 2 + 0.015, D / 2 + 0.009]}>
        <planeGeometry args={[0.24, 0.15]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.35} />
      </mesh>
      <Knob position={[0.14, H - 0.055, D / 2 + 0.009]} radius={0.022} />
      <Knob position={[0.14, H - 0.12, D / 2 + 0.009]} radius={0.014} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0.095 + (i % 2) * 0.045, 0.055 - Math.floor(i / 2) * 0.022, D / 2 + 0.008]}>
          <boxGeometry args={[0.03, 0.012, 0.004]} />
          <meshStandardMaterial color="#6d757b" roughness={0.6} />
        </mesh>
      ))}
      <Bnc position={[-0.185, 0.03, D / 2 + 0.008]} live />
      <Led position={[0.2, H - 0.018, D / 2 + 0.008]} />
      <Feet width={W} depth={D} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Poste informatique — ecran 27", clavier, souris                      */
/* ------------------------------------------------------------------ */

export function Computer({ signal }: { signal: SignalSettings }) {
  const map = useCanvasTexture(
    640,
    360,
    (ctx, w, h) => {
      ctx.fillStyle = '#101418';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b2127';
      ctx.fillRect(0, 0, w, h * 0.09);
      ctx.fillStyle = '#8d979d';
      ctx.font = '500 20px "IBM Plex Sans", sans-serif';
      ctx.fillText('STOUDENT Lab — poste etudiant', 16, h * 0.062);
      drawSpectrum(ctx, w, h, signal);
    },
    [signal],
  );

  return (
    <group>
      {/* pied */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 0.02, 20]} />
        <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <boxGeometry args={[0.06, 0.24, 0.04]} />
        <meshStandardMaterial color={PALETTE.darkMetal} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* dalle 27" */}
      <group position={[0, 0.44, 0.01]} rotation={[-0.06, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.37, 0.018]} />
          <meshStandardMaterial color="#20242a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.005, 0.011]}>
          <planeGeometry args={[0.595, 0.335]} />
          <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* clavier + souris */}
      <mesh position={[0, 0.008, 0.26]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.016, 0.14]} />
        <meshStandardMaterial color="#2b3035" roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 0.014, 0.26]} scale={[1, 0.5, 1.4]} castShadow>
        <sphereGeometry args={[0.032, 12, 10]} />
        <meshStandardMaterial color="#2b3035" roughness={0.7} />
      </mesh>
    </group>
  );
}
