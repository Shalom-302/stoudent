'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

import BigScreen from './BigScreen';
import { CableBundle } from './Cables';
import { Cabinet, CenterTable, Shelf } from './Furniture';
import Player, { type PlayerAppearance, type PlayerInput } from './Player';
import Room from './Room';
import TelecomRack from './TelecomRack';
import Whiteboard from './Whiteboard';
import Workstation from './Workstation';
import type { LessonContext } from '@/lib/lab3d/screens';
import type { SignalSettings } from '@/lib/lab3d/signal';
import { PALETTE, PROPS, RACK, STATIONS } from '@/lib/lab3d/specs';
import { LAB_POINTS, type PointId } from '@/lib/lab3d/stations';

/** Floor rings under each interaction point — the only yellow in the room. */
function InteractionMarkers({ near }: { near: PointId | null }) {
  return (
    <group>
      {LAB_POINTS.map((point) => {
        const [x, , z] = point.anchors.interactionPoint;
        const on = near === point.id;
        return (
          <mesh key={point.id} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.33, 40]} />
            <meshBasicMaterial color={PALETTE.accent} transparent opacity={on ? 0.9 : 0.22} />
          </mesh>
        );
      })}
    </group>
  );
}

function Lighting() {
  return (
    <group>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#eef3f6', '#9a9489', 0.7]} />
      {/* apport des baies du mur avant */}
      <directionalLight
        position={[-3, 4.5, -9]}
        intensity={1.5}
        color="#fbf6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-bias={-0.0006}
      />
      {/* rebond doux cote porte, pour eviter un fond ecrase */}
      <directionalLight position={[5, 3.5, 8]} intensity={0.35} color="#e9eef2" />
    </group>
  );
}

interface LabSceneProps {
  signal: SignalSettings;
  input: PlayerInput;
  view: 'third' | 'first';
  /** Bench the student is working at, if any. */
  focus: PointId | null;
  /** What the wall screens teach right now; undefined = idle room. */
  lesson?: LessonContext;
  locked: boolean;
  start: { x: number; z: number; rotation: number };
  appearance?: PlayerAppearance;
  near: PointId | null;
  onNear: (id: PointId | null) => void;
  onInteract: (id: PointId) => void;
  onExit: () => void;
  onMove: (transform: { x: number; z: number; rotation: number }) => void;
}

/**
 * The lab room.
 *
 * Geometry is built procedurally from `lib/lab3d/specs.ts`, which holds every
 * dimension of the 3D specification. Swapping in a Blender GLB later replaces
 * Room/Furniture/Instruments and nothing else: the anchors, the colliders and
 * the player all read from the same spec.
 */
export default function LabScene({
  signal,
  input,
  view,
  focus,
  lesson,
  locked,
  start,
  appearance,
  near,
  onNear,
  onInteract,
  onExit,
  onMove,
}: LabSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 62, near: 0.05, far: 60, position: [start.x, 2.6, start.z + 3.2] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#c6d2d8']} />
      <Suspense fallback={null}>
        <Lighting />
        <Room />

        {STATIONS.map((station) => (
          <Workstation key={station.id} station={station} signal={signal} />
        ))}

        <CenterTable />

        <group position={[PROPS.shelf.x, 0, PROPS.shelf.z]}>
          <Shelf />
        </group>
        <group position={[PROPS.rack.x, 0, PROPS.rack.z]}>
          <TelecomRack />
        </group>
        <group position={[PROPS.cabinet.x, 0, PROPS.cabinet.z]} rotation={[0, Math.PI, 0]}>
          <Cabinet />
        </group>

        <BigScreen signal={signal} lesson={lesson} />
        <Whiteboard lesson={lesson} />

        {/* ordinateurs des postes C et D vers la baie telecom */}
        <CableBundle
          from={[-3.0, 0.02, 2.3]}
          to={[PROPS.rack.x - 0.15, 0.06, PROPS.rack.z - RACK.depth / 2 + 0.1]}
          count={3}
        />
        <CableBundle
          from={[3.0, 0.02, 2.3]}
          to={[PROPS.rack.x + 0.15, 0.06, PROPS.rack.z - RACK.depth / 2 + 0.1]}
          count={3}
        />

        <InteractionMarkers near={near} />

        <Player
          input={input}
          view={view}
          focus={focus}
          locked={locked}
          start={start}
          appearance={appearance}
          near={near}
          onNear={onNear}
          onInteract={onInteract}
          onExit={onExit}
          onMove={onMove}
        />
      </Suspense>
    </Canvas>
  );
}
