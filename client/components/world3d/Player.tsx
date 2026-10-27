'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import Avatar from './Avatar';
import { BOUNDS, COLLIDERS, INTERACTION } from '@/lib/lab3d/specs';
import { EXIT_POINT, LAB_POINTS, pointById, type PointId } from '@/lib/lab3d/stations';

/**
 * Third-person character controller.
 *
 * The mockup moved the camera directly, which is a first-person ghost: there is
 * nothing to guide. Here the *avatar* is the thing that moves, the camera
 * orbits behind it, and the same movement vector drives the keyboard, the
 * on-screen pad and the touch joystick. First person stays one key away.
 */

const RADIUS = 0.32; // player collision radius, from the mockup
const WALK = 1.7; // m/s
const RUN = 3.0;
const TURN_RATE = 9; // how fast the body swings to face the move direction

/** Camera rig, third person. */
const CAM = {
  distance: 2.4,
  height: 1.55,
  lookHeight: 1.3,
  minPitch: -0.3,
  maxPitch: 1.05,
  /** Below this gap the avatar is hidden so it stops blocking the view. */
  hideBelow: 1.2,
};

const FORWARD = new Set(['w', 'z', 'arrowup']);
const BACK = new Set(['s', 'arrowdown']);
const LEFT = new Set(['a', 'q', 'arrowleft']);
const RIGHT = new Set(['d', 'arrowright']);

function blocked(x: number, z: number): boolean {
  if (x < BOUNDS.minX + RADIUS || x > BOUNDS.maxX - RADIUS) return true;
  if (z < BOUNDS.minZ + RADIUS || z > BOUNDS.maxZ - RADIUS) return true;
  return COLLIDERS.some(
    (c) => x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS,
  );
}

/** Movement request, in camera space: x = strafe, y = forward. Length <= 1. */
export interface MoveInput {
  x: number;
  y: number;
  run: boolean;
}

/** Shared, mutable input written by the HUD pad and read by the render loop. */
export interface PlayerInput {
  move: MoveInput;
  /** Look delta accumulated since the last frame, in radians. */
  lookYaw: number;
  lookPitch: number;
  interact: boolean;
}

export function createPlayerInput(): PlayerInput {
  return { move: { x: 0, y: 0, run: false }, lookYaw: 0, lookPitch: 0, interact: false };
}

export interface PlayerAppearance {
  outfit?: string;
  skin?: string;
  hair?: string;
}

interface PlayerProps {
  input: PlayerInput;
  view: 'third' | 'first';
  /**
   * Bench the student is currently working at.
   *
   * Set, the camera walks up to the instrument and holds a reading pose: the
   * TP happens in the room, not on another page.
   */
  focus: PointId | null;
  /** Frozen while a panel is open. */
  locked: boolean;
  start: { x: number; z: number; rotation: number };
  appearance?: PlayerAppearance;
  near: PointId | null;
  onNear: (id: PointId | null) => void;
  onInteract: (id: PointId) => void;
  onExit: () => void;
  onMove: (transform: { x: number; z: number; rotation: number }) => void;
}

export default function Player({
  input,
  view,
  focus,
  locked,
  start,
  appearance,
  near,
  onNear,
  onInteract,
  onExit,
  onMove,
}: PlayerProps) {
  const { camera } = useThree();
  const body = useRef<THREE.Group>(null);

  // Authoritative player state, kept out of React: it changes 60 times a
  // second and no component needs to re-render for it.
  const state = useRef({
    position: new THREE.Vector3(start.x, 0, start.z),
    heading: start.rotation,
    cameraYaw: start.rotation,
    cameraPitch: 0.24,
    lastSave: 0,
  });
  const speedRef = useRef(0);

  const keys = useRef(new Set<string>());
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current.add(key);
      if (key === 'e' || key === 'enter') input.interact = true;
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [input]);

  const desired = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camWanted = useMemo(() => new THREE.Vector3(), []);
  const camPulled = useMemo(() => new THREE.Vector3(), []);
  const focusPose = useMemo(() => new THREE.Vector3(), []);
  const camLook = useMemo(() => new THREE.Vector3(), []);
  const lookMatrix = useMemo(() => new THREE.Matrix4(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = state.current;

    // -- Look ---------------------------------------------------------------
    // Drag right looks right, drag down looks down - the plain mouse-look
    // convention, identical in both views so switching does not flip the
    // controls under the student.
    s.cameraYaw += input.lookYaw;
    s.cameraPitch = THREE.MathUtils.clamp(
      s.cameraPitch + input.lookPitch,
      CAM.minPitch,
      CAM.maxPitch,
    );
    input.lookYaw = 0;
    input.lookPitch = 0;

    // -- Movement request ---------------------------------------------------
    // Keyboard and pad write into the same vector, so a student can drive with
    // either without the two fighting each other.
    let mx = input.move.x;
    let my = input.move.y;
    const run = input.move.run || keys.current.has('shift');

    for (const key of keys.current) {
      if (FORWARD.has(key)) my += 1;
      else if (BACK.has(key)) my -= 1;
      else if (LEFT.has(key)) mx -= 1;
      else if (RIGHT.has(key)) mx += 1;
    }

    // At a bench the student is standing still, reading a screen.
    if (locked || focus) {
      mx = 0;
      my = 0;
    }

    const magnitude = Math.min(Math.hypot(mx, my), 1);

    if (magnitude > 0.02) {
      // Move relative to where the camera looks: pressing "forward" goes where
      // the student is looking, which is what every third-person game does.
      // forward = (-sin, 0, cos); screen-right = cross(forward, up)
      // = (-cos, 0, -sin). Both terms are negative on the strafe axis: get
      // that sign wrong and D walks left.
      const cos = Math.cos(s.cameraYaw);
      const sin = Math.sin(s.cameraYaw);
      desired.set(-mx * cos - my * sin, 0, -mx * sin + my * cos).normalize();

      const step = magnitude * (run ? RUN : WALK) * dt;
      const nx = s.position.x + desired.x * step;
      const nz = s.position.z + desired.z * step;
      // Axis-separated so sliding along a wall still works.
      if (!blocked(nx, s.position.z)) s.position.x = nx;
      if (!blocked(s.position.x, nz)) s.position.z = nz;

      // Turn the body towards the movement, never snap it.
      const target = Math.atan2(desired.x, desired.z);
      let diff = target - s.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.heading += diff * Math.min(TURN_RATE * dt, 1);
      speedRef.current = magnitude * (run ? RUN : WALK);
    } else {
      speedRef.current += (0 - speedRef.current) * Math.min(dt * 10, 1);
      if (speedRef.current < 0.02) speedRef.current = 0;
    }

    if (body.current) {
      body.current.position.copy(s.position);
      body.current.rotation.y = s.heading;
      body.current.visible = view === 'third';
    }


    // -- Camera -------------------------------------------------------------
    const focused = pointById(focus);
    if (focused) {
      // Slide up to the instrument and hold the reading pose. The avatar is
      // parked on the interaction point, which is where the spec says a
      // student stands: 0.8 m from the front panel.
      const [sx, , sz] = focused.anchors.interactionPoint;
      const [lx, ly, lz] = focused.anchors.lookAtPoint;
      // Stop just short of the marker so the screen fills the view without
      // the near plane clipping into the chassis.
      const toBench = new THREE.Vector3(lx - sx, 0, lz - sz).normalize();
      focusPose.set(sx + toBench.x * 0.18, INTERACTION.eyeHeight, sz + toBench.z * 0.18);

      camera.position.lerp(focusPose, 1 - Math.pow(0.002, dt));
      camLook.set(lx, ly, lz);
      // Matrix4.lookAt uses the *camera* convention (-Z towards the target).
      // Going through a plain Object3D here would use the mesh convention
      // (+Z towards the target) and aim the camera at the opposite wall.
      lookMatrix.lookAt(camera.position, camLook, camera.up);
      targetQuat.setFromRotationMatrix(lookMatrix);
      camera.quaternion.slerp(targetQuat, 1 - Math.pow(0.002, dt));

      s.position.x = sx;
      s.position.z = sz;
      s.heading = Math.atan2(toBench.x, toBench.z);
      if (body.current) {
        body.current.position.copy(s.position);
        body.current.rotation.y = s.heading;
        body.current.visible = false;
      }
      return;
    }

    if (view === 'first') {
      camera.position.set(s.position.x, INTERACTION.eyeHeight, s.position.z);
      // Look along +forward, same convention as the movement vector.
      camTarget.set(
        s.position.x - Math.sin(s.cameraYaw) * Math.cos(s.cameraPitch),
        INTERACTION.eyeHeight - Math.sin(s.cameraPitch),
        s.position.z + Math.cos(s.cameraYaw) * Math.cos(s.cameraPitch),
      );
      camera.lookAt(camTarget);
    } else {
      // The rig sits at -forward * distance. forward is
      // (-sin(yaw), 0, +cos(yaw)), so behind the avatar is
      // (+sin(yaw), 0, -cos(yaw)): getting the z sign wrong puts the camera in
      // front and the student walks into their own face.
      const horizontal = CAM.distance * Math.cos(s.cameraPitch);
      camWanted.set(
        s.position.x + Math.sin(s.cameraYaw) * horizontal,
        s.position.y + CAM.height + CAM.distance * Math.sin(s.cameraPitch),
        s.position.z - Math.cos(s.cameraYaw) * horizontal,
      );
      // Pull the camera in when it would sit inside a wall or a cabinet: walk
      // the ray back towards the player and keep the last free sample.
      camPulled.copy(camWanted);
      if (blocked(camWanted.x, camWanted.z)) {
        for (let t = 0.85; t >= 0.15; t -= 0.1) {
          const x = s.position.x + (camWanted.x - s.position.x) * t;
          const z = s.position.z + (camWanted.z - s.position.z) * t;
          if (!blocked(x, z)) {
            camPulled.set(
              x,
              s.position.y + CAM.lookHeight + (camWanted.y - s.position.y - CAM.lookHeight) * t,
              z,
            );
            break;
          }
          camPulled.set(x, s.position.y + CAM.lookHeight + 0.2, z);
        }
      }
      camera.position.lerp(camPulled, 1 - Math.pow(0.0001, dt));
      camTarget.set(s.position.x, s.position.y + CAM.lookHeight, s.position.z);
      camera.lookAt(camTarget);

      // A wall can squeeze the rig right up against the student's back. Hiding
      // the body then is what every third-person game does; leaving it visible
      // fills the screen with a lab coat.
      if (body.current) {
        const gap = Math.hypot(
          camera.position.x - s.position.x,
          camera.position.z - s.position.z,
        );
        body.current.visible = gap > CAM.hideBelow;
      }
    }

    // -- Proximity ----------------------------------------------------------
    let found: PointId | null = null;
    // Annotated: detectionRadius is a literal 1 in the `as const` spec.
    let best: number = INTERACTION.detectionRadius;
    for (const point of LAB_POINTS) {
      const [px, , pz] = point.anchors.interactionPoint;
      const distance = Math.hypot(s.position.x - px, s.position.z - pz);
      if (distance < best) {
        best = distance;
        found = point.id;
      }
    }
    if (found !== nearRef.current) onNear(found);

    // -- Interaction --------------------------------------------------------
    if (input.interact) {
      input.interact = false;
      if (found) onInteract(found);
      else if (Math.hypot(s.position.x - EXIT_POINT[0], s.position.z - EXIT_POINT[1]) < 1.4) {
        onExit();
      }
    }

    // -- Persistence --------------------------------------------------------
    // Throttled: the API stores where the student stopped, not every step.
    s.lastSave += dt;
    if (s.lastSave > 4 && speedRef.current > 0) {
      s.lastSave = 0;
      onMove({
        x: Number(s.position.x.toFixed(3)),
        z: Number(s.position.z.toFixed(3)),
        rotation: Number(s.heading.toFixed(3)),
      });
    }
  });

  return (
    <group ref={body}>
      <Avatar speedRef={speedRef} {...appearance} />
    </group>
  );
}
