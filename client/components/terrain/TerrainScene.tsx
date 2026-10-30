'use client';

import { Sky } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';

import { Buildings, Ground, PoleLine, StreetLamps, Streets, Vegetation } from './CityMesh';
import { EquipmentLabels, EquipmentModels, NetworkOverlay } from './Equipment';
import { Pedestrians, Traffic } from './Traffic';
import Player, { type PlayerAppearance, type PlayerInput, type PlayerTracker, type PlayerWorld } from '@/components/world3d/Player';
import { EQUIPMENT, SPAWN, blocked, groundAt, type EquipmentType } from '@/lib/terrain/city';

/** Direction the sunlight comes from: mid-morning, from the east-south-east. */
const SUN = new THREE.Vector3(55, 62, 38).normalize();
const HAZE = '#c7d3da';

const WORLD: PlayerWorld<string> = {
  blocked,
  groundAt,
  points: EQUIPMENT.map((e) => ({ id: e.id, x: e.stand[0], z: e.stand[1] })),
  detectionRadius: 3,
  // Streets are longer than a room: walking pace stays human, running is brisk.
  walk: 2.4,
  run: 6,
  // Pull back over the rooftops and look straight down at the district.
  maxDistance: 75,
  maxPitch: 1.45,
};

/** Push the haze back as the camera climbs, or an aerial view is all fog. */
function HazeFollowsCamera({ tracker }: { tracker: PlayerTracker }) {
  useFrame(({ camera, scene }) => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const d = Math.hypot(camera.position.x - tracker.x, camera.position.y, camera.position.z - tracker.z);
    fog.near = 55 + d * 0.8;
    fog.far = 190 + d * 1.6;
  });
  return null;
}

/**
 * The sun, its shadow box centred on the student: a 2048 px map over 80 m
 * keeps shadows crisp where they are looked at, instead of blurry everywhere.
 */
function Sun({ tracker }: { tracker: PlayerTracker }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    l.position.set(tracker.x + SUN.x * 80, SUN.y * 80, tracker.z + SUN.z * 80);
    l.target.position.set(tracker.x, 0, tracker.z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.6}
      color="#fff1d8"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-55}
      shadow-camera-right={55}
      shadow-camera-top={55}
      shadow-camera-bottom={-55}
      shadow-camera-near={10}
      shadow-camera-far={200}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    />
  );
}

/** A discreet survey mark on the ground where the student stands to examine a site. */
function SurveyMark({ at, near, done }: { at: [number, number]; near: boolean; done: boolean }) {
  const color = near ? '#f2b705' : done ? '#21b36b' : '#f4f1ea';
  return (
    <group position={[at[0], 0.13, at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.55, 0.62, 40]} />
        <meshBasicMaterial color={color} transparent opacity={near ? 0.95 : 0.55} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color={color} transparent opacity={near ? 0.95 : 0.55} />
      </mesh>
    </group>
  );
}

interface TerrainSceneProps {
  input: PlayerInput;
  tracker: PlayerTracker;
  view: 'third' | 'first';
  locked: boolean;
  appearance?: PlayerAppearance;
  near: string | null;
  discovered: Set<EquipmentType>;
  beam: 'unknown' | 'up' | 'down';
  networks: boolean;
  labels: boolean;
  onNear: (id: string | null) => void;
  onInteract: (id: string) => void;
}

/**
 * Labo Terrain: a wired district walked like the lab room. The equipment is
 * the point; streets, traffic and passers-by put it where it really sits.
 * The scene shows; the calculations come from the API.
 */
export default function TerrainScene({
  input,
  tracker,
  view,
  locked,
  appearance,
  near,
  discovered,
  beam,
  networks,
  labels,
  onNear,
  onInteract,
}: TerrainSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 58, near: 0.1, far: 420, position: [6, 3, 16] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.85 }}
    >
      <color attach="background" args={[HAZE]} />
      {/* Abidjan's humid haze: the far end of the boulevard fades out. */}
      <fog attach="fog" args={[HAZE, 55, 190]} />
      <Suspense fallback={null}>
        <Sky distance={380} sunPosition={[SUN.x, SUN.y, SUN.z]} turbidity={9} rayleigh={1.6} mieCoefficient={0.008} mieDirectionalG={0.82} />
        <hemisphereLight args={['#d9e6ef', '#8a6a48', 0.85]} />
        <Sun tracker={tracker} />
        <HazeFollowsCamera tracker={tracker} />
        <Ground />
        <Streets />
        <Buildings />
        <Vegetation />
        <StreetLamps />
        <PoleLine />
        <EquipmentModels />
        {networks && <NetworkOverlay beam={beam} />}
        {labels && <EquipmentLabels discovered={discovered} tracker={tracker} />}
        <Traffic tracker={tracker} />
        <Pedestrians tracker={tracker} />

        {EQUIPMENT.map((e) => (
          <SurveyMark key={e.id} at={e.stand} near={near === e.id} done={discovered.has(e.type)} />
        ))}

        <Player<string>
          input={input}
          world={WORLD}
          tracker={tracker}
          view={view}
          focus={null}
          locked={locked}
          start={SPAWN}
          appearance={appearance}
          near={near}
          onNear={onNear}
          onInteract={onInteract}
          onExit={() => undefined}
          onMove={() => undefined}
        />
      </Suspense>
    </Canvas>
  );
}
