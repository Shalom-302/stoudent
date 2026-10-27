'use client';

import type { SignalSettings } from '@/lib/lab3d/signal';
import { CHAIR_OFFSET, DESK, MAIN_INSTRUMENT_X, PALETTE, type Station } from '@/lib/lab3d/specs';
import { Chair, Table } from './Furniture';
import { Cable } from './Cables';
import { Computer, FunctionGenerator, Oscilloscope, PowerSupply, SpectrumAnalyzer } from './Instruments';

const TOP = DESK.height;
/** Ligne d'instruments, en retrait du bord arriere du plateau. */
const ROW_Z = -DESK.depth / 2 + 0.2;
/** Montage experimental, cote etudiant. */
const RIG: [number, number, number] = [0.2, TOP + 0.02, 0.1];

/**
 * Un poste complet. Le repere local a son origine au centre du plateau, au sol ;
 * l'etudiant se tient en +Z et tous les instruments lui font face.
 */
export default function Workstation({ station, signal }: { station: Station; signal: SignalSettings }) {
  const [x, z] = station.position;
  const main = station.kind;
  const mainX = MAIN_INSTRUMENT_X[main];

  // Points de branchement, en coordonnees locales : ils tombent exactement sur
  // les connecteurs BNC modelises, pour qu'aucun cable ne parte dans le vide.
  const genOut: [number, number, number] = [-0.015, TOP + 0.03, ROW_Z + 0.056];
  const scopeCh1: [number, number, number] = [mainX - 0.105, TOP + 0.028, ROW_Z + 0.083];
  const analyzerIn: [number, number, number] = [mainX - 0.185, TOP + 0.03, ROW_Z + 0.118];
  const psuPlus: [number, number, number] = [0.44, TOP + 0.04, ROW_Z + 0.066];

  return (
    <group position={[x, 0, z]}>
      <Table width={DESK.width} depth={DESK.depth} height={DESK.height} />

      {/* chaise tiree sur le cote : l'acces au poste reste degage */}
      <group position={[CHAIR_OFFSET[0], 0, CHAIR_OFFSET[1]]} rotation={[0, -0.25, 0]}>
        <Chair rotation={Math.PI} />
      </group>

      {/* instrument principal */}
      <group position={[mainX, TOP, ROW_Z]}>
        {main === 'oscilloscope' ? <Oscilloscope signal={signal} /> : <SpectrumAnalyzer signal={signal} />}
      </group>

      {/* generateur de fonctions, a portee de main */}
      <group position={[-0.1, TOP, ROW_Z]}>
        <FunctionGenerator signal={signal} />
      </group>

      {station.computer ? (
        <group position={[0.45, TOP, ROW_Z + 0.05]}>
          <Computer signal={signal} />
        </group>
      ) : (
        <group position={[0.5, TOP, ROW_Z]}>
          <PowerSupply />
        </group>
      )}

      {/* montage experimental sur platine */}
      <group position={RIG}>
        <mesh castShadow>
          <boxGeometry args={[0.26, 0.02, 0.16]} />
          <meshStandardMaterial color="#e9e6df" roughness={0.6} />
        </mesh>
        <mesh position={[-0.05, 0.03, 0]} castShadow>
          <boxGeometry args={[0.05, 0.04, 0.05]} />
          <meshStandardMaterial color={PALETTE.equipment} roughness={0.6} />
        </mesh>
        <mesh position={[0.05, 0.025, 0.02]} rotation={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.03, 10]} />
          <meshStandardMaterial color="#8d6a3f" roughness={0.7} />
        </mesh>
      </group>

      {/* cablage : generateur -> entree de l'instrument, generateur -> montage */}
      <Cable from={genOut} to={main === 'oscilloscope' ? scopeCh1 : analyzerIn} sag={0.07} />
      <Cable from={genOut} to={[RIG[0] - 0.08, RIG[1] + 0.03, RIG[2] - 0.02]} sag={0.09} color="#3a3f44" />
      {!station.computer && <Cable from={psuPlus} to={[RIG[0] + 0.09, RIG[1] + 0.03, RIG[2]]} sag={0.08} color="#7a2f27" />}

      {/* descente vers le passage de cables du plateau */}
      <Cable
        from={[0.4, TOP - 0.01, ROW_Z + 0.02]}
        to={[0.4, TOP - 0.13, -DESK.depth / 2 + 0.12]}
        sag={0.03}
        radius={0.007}
      />
    </group>
  );
}
