'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { Compound, DrawPit, FibrePole, GsmMast, LatticeTower, SitePin, StreetCabinet } from './models';
import Player, { type PlayerAppearance, type PlayerInput, type PlayerTracker, type PlayerWorld } from '@/components/world3d/Player';
import {
  BUILDINGS,
  EXTENT,
  FH_COMPOUND,
  FH_TOWER_B,
  ORION,
  SIDEWALK,
  SITES,
  SPAWN,
  STREETS,
  blocked,
  siteById,
  type SiteId,
} from '@/lib/terrain/city';

const TOWER_HEIGHT = 30;
const ROOF_MAST = 6;

const WORLD: PlayerWorld<SiteId> = {
  blocked,
  points: SITES.map((s) => ({ id: s.id, x: s.stand[0], z: s.stand[1] })),
  detectionRadius: 2.6,
  // Streets are longer than a room: walking pace stays human, running is brisk.
  walk: 2.4,
  run: 6,
};

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[EXTENT * 2 + 120, EXTENT * 2 + 120]} />
        <meshStandardMaterial color="#b98f5e" roughness={1} />
      </mesh>
      {STREETS.map((s) => {
        const w = s.maxX - s.minX;
        const d = s.maxZ - s.minZ;
        const along = w > d;
        return (
          <group key={s.name}>
            {/* trottoirs */}
            <mesh position={[(s.minX + s.maxX) / 2, 0.08, (s.minZ + s.maxZ) / 2]} receiveShadow>
              <boxGeometry args={[w + (along ? 0 : SIDEWALK * 2), 0.16, d + (along ? SIDEWALK * 2 : 0)]} />
              <meshStandardMaterial color="#cfc8bb" roughness={0.95} />
            </mesh>
            {/* chaussée */}
            <mesh position={[(s.minX + s.maxX) / 2, 0.165, (s.minZ + s.maxZ) / 2]} receiveShadow>
              <boxGeometry args={[w, 0.02, d]} />
              <meshStandardMaterial color="#45484b" roughness={0.9} />
            </mesh>
            {/* ligne médiane en tirets */}
            {Array.from({ length: Math.floor((along ? w : d) / 6) }).map((_, i) => {
              const t = (along ? s.minX : s.minZ) + 3 + i * 6;
              return (
                <mesh
                  key={i}
                  rotation={[-Math.PI / 2, 0, along ? 0 : Math.PI / 2]}
                  position={along ? [t, 0.177, (s.minZ + s.maxZ) / 2] : [(s.minX + s.maxX) / 2, 0.177, t]}
                >
                  <planeGeometry args={[2.6, 0.15]} />
                  <meshBasicMaterial color="#e9e4d6" />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/** Every generated building in one draw call. */
function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const plain = useMemo(() => BUILDINGS.filter((b) => !b.name), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    plain.forEach((b, i) => {
      m.compose(
        new THREE.Vector3((b.minX + b.maxX) / 2, b.height / 2, (b.minZ + b.maxZ) / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(b.maxX - b.minX, b.height, b.maxZ - b.minZ),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plain]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, plain.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

function Landmark({ name }: { name: string }) {
  const b = BUILDINGS.find((x) => x.name === name)!;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  // Window bands drawn once on a canvas: a tower reads as a tower, not a box.
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = b.color;
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#4d5a66';
    for (let y = 6; y < 128; y += 16) for (let x = 4; x < 64; x += 15) ctx.fillRect(x, y, 9, 8);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(b.height / 6)));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [b.color, b.height, w]);
  return (
    <group position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <mesh position={[0, b.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, b.height, d]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Low trees along the sidewalks, instanced: trunk + crown. */
function Trees() {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -EXTENT + 6; x < EXTENT - 4; x += 14) {
      for (const z of [-8.8, 8.8]) if (!blocked(x, z) && Math.abs(x) > 9) out.push([x, z]);
    }
    for (let z = -EXTENT + 8; z < EXTENT - 4; z += 14) {
      for (const x of [-7.6, 7.6]) if (!blocked(x, z) && Math.abs(z) > 10) out.push([x, z]);
    }
    return out.filter(([x, z]) => SITES.every((s) => Math.hypot(s.at[0] - x, s.at[1] - z) > 5));
  }, []);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      trunks.current?.setMatrixAt(i, m.makeTranslation(x, 1.2, z));
      crowns.current?.setMatrixAt(i, m.makeTranslation(x, 3.4, z));
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[0.15, 0.22, 2.4, 6]} />
        <meshStandardMaterial color="#6b4a2f" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, spots.length]} castShadow>
        <icosahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial color="#4f7d3a" flatShading />
      </instancedMesh>
    </group>
  );
}

/** Line of sight between the two dishes; green when the last calculation says the link is up. */
function MicrowaveBeam({ status }: { status: 'unknown' | 'up' | 'down' }) {
  const line = useMemo(() => {
    const a = siteById('fh')!.at;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a[0], 26, a[1]),
      new THREE.Vector3(FH_TOWER_B[0], 26, FH_TOWER_B[1]),
    ]);
    const material = new THREE.LineDashedMaterial({ dashSize: 1.5, gapSize: 1, transparent: true, opacity: 0.85 });
    const object = new THREE.Line(geometry, material);
    object.computeLineDistances();
    return object;
  }, []);
  useLayoutEffect(() => {
    (line.material as THREE.LineDashedMaterial).color.set(
      status === 'up' ? '#21b36b' : status === 'down' ? '#e0442c' : '#f2b705',
    );
  }, [line, status]);
  return <primitive object={line} />;
}

function Lighting() {
  return (
    <group>
      <hemisphereLight args={['#dfeefa', '#a58358', 0.9]} />
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.8}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={200}
        shadow-bias={-0.0008}
      />
    </group>
  );
}

interface TerrainSceneProps {
  input: PlayerInput;
  tracker: PlayerTracker;
  view: 'third' | 'first';
  locked: boolean;
  appearance?: PlayerAppearance;
  near: SiteId | null;
  discovered: Set<SiteId>;
  beam: 'unknown' | 'up' | 'down';
  onNear: (id: SiteId | null) => void;
  onInteract: (id: SiteId) => void;
}

/**
 * Labo Terrain: a district with its telecom infrastructure, walked like the
 * lab room. The scene shows; the calculations come from the API.
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
  onNear,
  onInteract,
}: TerrainSceneProps) {
  const fh = siteById('fh')!;
  const aim = Math.atan2(FH_TOWER_B[0] - fh.at[0], FH_TOWER_B[1] - fh.at[1]);
  const pc = siteById('pc')!;
  const roofY = ORION.height;

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 62, near: 0.1, far: 400, position: [6, 3, 16] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#cfe3f1']} />
      <fog attach="fog" args={['#cfe3f1', 90, 220]} />
      <Suspense fallback={null}>
        <Lighting />
        <Ground />
        <Buildings />
        <Landmark name="Immeuble Sigma" />
        <Landmark name="Immeuble Orion" />
        <Trees />

        {/* Pylône A dans son enclos, pylône B au loin */}
        <group position={[(FH_COMPOUND.minX + FH_COMPOUND.maxX) / 2, 0, (FH_COMPOUND.minZ + FH_COMPOUND.maxZ) / 2]}>
          <Compound size={FH_COMPOUND.maxX - FH_COMPOUND.minX} />
        </group>
        <group position={[fh.at[0], 0, fh.at[1]]}>
          <LatticeTower height={TOWER_HEIGHT} aim={aim} />
        </group>
        <group position={[FH_TOWER_B[0], 0, FH_TOWER_B[1]]}>
          <LatticeTower height={TOWER_HEIGHT} aim={aim + Math.PI} dishes={[26]} />
        </group>
        <MicrowaveBeam status={beam} />

        <group position={[pc.at[0], 0, pc.at[1]]}>
          <FibrePole
            drops={[
              [-3.5, 4.2, 6.5],
              [3.2, 4.2, 6.8],
              [8.5, 4.6, 5],
            ]}
          />
        </group>
        <group position={[siteById('sro')!.at[0], 0.16, siteById('sro')!.at[1]]}>
          <StreetCabinet />
        </group>
        <group position={[siteById('chambre')!.at[0], 0, siteById('chambre')!.at[1]]}>
          <DrawPit />
        </group>
        <group position={[siteById('gsm')!.at[0], roofY, siteById('gsm')!.at[1]]}>
          <GsmMast height={ROOF_MAST} />
        </group>

        {SITES.map((s) => {
          const top =
            s.id === 'fh' ? TOWER_HEIGHT + 4 : s.id === 'gsm' ? roofY + ROOF_MAST + 2 : s.id === 'pc' ? 7.2 : 3.2;
          return (
            <group key={s.id}>
              <group position={[s.at[0], 0, s.at[1]]}>
                <SitePin height={top} done={discovered.has(s.id)} />
              </group>
              <mesh position={[s.stand[0], 0.2, s.stand[1]]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.6, 0.75, 40]} />
                <meshBasicMaterial color="#f2b705" transparent opacity={near === s.id ? 0.95 : 0.35} />
              </mesh>
            </group>
          );
        })}

        <Player<SiteId>
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
