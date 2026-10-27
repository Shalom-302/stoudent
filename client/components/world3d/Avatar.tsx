'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Group } from 'three';

import { AVATAR, PALETTE } from '@/lib/lab3d/specs';

const CLOTH = '#46525c';
const CLOTH_LIGHT = '#5d6b76';

export interface AvatarLook {
  outfit?: string;
  outfitLight?: string;
  skin?: string;
  hair?: string;
}

interface AvatarProps extends AvatarLook {
  position?: [number, number, number];
  rotation?: number;
  /**
   * Current ground speed in m/s, read every frame.
   *
   * A ref rather than a prop: the walk cycle has to follow the controller at
   * 60 Hz, and re-rendering the whole rig on every speed change would be
   * absurd for what is ultimately a sine wave.
   */
  speedRef?: RefObject<number>;
}

/**
 * Reference avatar (spec section 15), 1.75 m.
 *
 * The group hierarchy follows the rig expected at export:
 * Root > Hips > Spine > Neck > Head, plus arms and legs. Heights come straight
 * from the landmark table, so swapping this for a rigged GLB is a drop-in.
 */
export default function Avatar({
  position = [0, 0, 0],
  rotation = 0,
  outfit = CLOTH,
  outfitLight = CLOTH_LIGHT,
  skin = PALETTE.skin,
  hair = '#2c2620',
  speedRef,
}: AvatarProps) {
  const root = useRef<Group>(null);
  const chest = useRef<Group>(null);
  const legLeft = useRef<Group>(null);
  const legRight = useRef<Group>(null);
  const armLeft = useRef<Group>(null);
  const armRight = useRef<Group>(null);
  const cycle = useRef(0);

  useFrame((frameState, delta) => {
    const t = frameState.clock.elapsedTime;
    const speed = speedRef?.current ?? 0;
    const moving = speed > 0.1;

    // Stride frequency tracks speed, so a run does not look like a fast walk
    // played at the wrong tempo.
    cycle.current += delta * (moving ? 2.2 + speed * 1.5 : 0);
    const swing = moving ? Math.sin(cycle.current) * Math.min(0.35 + speed * 0.12, 0.72) : 0;
    const bounce = moving ? Math.abs(Math.sin(cycle.current)) * 0.035 : 0;

    if (legLeft.current) legLeft.current.rotation.x = swing;
    if (legRight.current) legRight.current.rotation.x = -swing;
    // Arms counter-swing, which is what reads as "walking" rather than "sliding".
    if (armLeft.current) armLeft.current.rotation.x = -swing * 0.8;
    if (armRight.current) armRight.current.rotation.x = swing * 0.8;

    if (chest.current) {
      chest.current.rotation.y = moving
        ? Math.sin(cycle.current) * 0.06
        : Math.sin(t * 0.5) * 0.045;
    }
    if (root.current) {
      // Idle breathing when still, gait bounce when moving.
      root.current.position.y =
        position[1] + (moving ? bounce : Math.sin(t * 1.1) * 0.006);
    }
  });

  const { hips, knees, shoulders, shoulderWidth } = AVATAR;

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]} name="Root">
      <group name="Hips" position={[0, hips, 0]}>
        {/* bassin */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <capsuleGeometry args={[0.125, 0.1, 4, 12]} />
          <meshStandardMaterial color={outfit} roughness={0.85} />
        </mesh>

        <group ref={chest} name="Spine">
          {/* torse : bassin -> epaules */}
          <mesh position={[0, (shoulders - hips) / 2, 0]} castShadow>
            <capsuleGeometry args={[0.14, shoulders - hips - 0.18, 4, 14]} />
            <meshStandardMaterial color={outfitLight} roughness={0.85} />
          </mesh>

          <group name="Neck" position={[0, shoulders - hips + 0.06, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.045, 0.06, 4, 10]} />
              <meshStandardMaterial color={skin} roughness={0.75} />
            </mesh>
            <group name="Head" position={[0, 0.155, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.115, 20, 16]} />
                <meshStandardMaterial color={skin} roughness={0.75} />
              </mesh>
              {/* cheveux, volume simple */}
              <mesh position={[0, 0.035, -0.012]} castShadow>
                <sphereGeometry args={[0.116, 16, 12]} />
                <meshStandardMaterial color={hair} roughness={0.9} />
              </mesh>
            </group>
          </group>

          {/* bras */}
          {([-1, 1] as const).map((s) => (
            <group
              key={s}
              ref={s < 0 ? armLeft : armRight}
              name={s < 0 ? 'LeftShoulder' : 'RightShoulder'}
              position={[(s * shoulderWidth) / 2, shoulders - hips - 0.06, 0]}
            >
              <mesh position={[0, -0.14, 0]} rotation={[0, 0, s * 0.06]} castShadow>
                <capsuleGeometry args={[0.048, 0.2, 4, 10]} />
                <meshStandardMaterial color={outfitLight} roughness={0.85} />
              </mesh>
              <group name={s < 0 ? 'LeftForeArm' : 'RightForeArm'} position={[s * 0.02, -0.33, 0.02]}>
                <mesh position={[0, -0.12, 0]} rotation={[0.18, 0, 0]} castShadow>
                  <capsuleGeometry args={[0.042, 0.18, 4, 10]} />
                  <meshStandardMaterial color={skin} roughness={0.8} />
                </mesh>
                <mesh name={s < 0 ? 'LeftHand' : 'RightHand'} position={[0, -0.26, 0.04]} castShadow>
                  <capsuleGeometry args={[0.038, 0.05, 4, 8]} />
                  <meshStandardMaterial color={skin} roughness={0.8} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>

      {/* jambes : pivotees depuis la hanche pour le cycle de marche */}
      {([-1, 1] as const).map((s) => (
        <group
          key={s}
          ref={s < 0 ? legLeft : legRight}
          name={s < 0 ? 'LeftUpLeg' : 'RightUpLeg'}
          position={[s * 0.1, hips, 0]}
        >
          <mesh position={[0, -(hips - knees) / 2, 0]} castShadow>
            <capsuleGeometry args={[0.062, hips - knees - 0.12, 4, 10]} />
            <meshStandardMaterial color="#39414a" roughness={0.88} />
          </mesh>
          <mesh position={[0, -hips + knees / 2 + 0.03, 0]} castShadow>
            <capsuleGeometry args={[0.054, knees - 0.14, 4, 10]} />
            <meshStandardMaterial color="#39414a" roughness={0.88} />
          </mesh>
          <mesh name={s < 0 ? 'LeftFoot' : 'RightFoot'} position={[0, -hips + 0.032, 0.05]} castShadow>
            <boxGeometry args={[0.09, 0.064, 0.22]} />
            <meshStandardMaterial color="#22262a" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
