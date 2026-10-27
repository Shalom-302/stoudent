'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { LabHud } from '@/components/world3d/LabHud';
import { StationPanel } from '@/components/world3d/StationPanel';
import { LookSurface } from '@/components/world3d/controls/MovePad';
import { createPlayerInput } from '@/components/world3d/Player';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_SIGNAL } from '@/lib/lab3d/signal';
import type { LessonContext } from '@/lib/lab3d/screens';
import { signalFromParameters } from '@/lib/lab3d/signal-bridge';
import { pointById, type PointId } from '@/lib/lab3d/stations';
import { labService } from '@/services/labs';
import { studentService } from '@/services/student';

// three touches `window` at import time, so the canvas must never be part of
// the server bundle.
const LabScene = dynamic(() => import('@/components/world3d/LabScene'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const OUTFITS: Record<string, { outfit: string; outfitLight: string }> = {
  lab_coat: { outfit: '#dfe3e6', outfitLight: '#eef1f3' },
  hoodie: { outfit: '#46525c', outfitLight: '#5d6b76' },
  jacket: { outfit: '#2f4f6f', outfitLight: '#3d637f' },
};
const SKINS: Record<string, string> = {
  default: '#c9a184',
  medium: '#a9784f',
  dark: '#7d4f33',
};
const HAIRS: Record<string, string> = {
  default: '#2c2620',
  blond: '#c7a25e',
  red: '#8f4429',
};

/** The lab room: walk the avatar to a bench and open its TP. */
export default function WorldPage() {
  const router = useRouter();
  const [near, setNear] = React.useState<PointId | null>(null);
  const [view, setView] = React.useState<'third' | 'first'>('third');
  /** Bench being worked at. The TP runs here, in the room. */
  const [focus, setFocus] = React.useState<PointId | null>(null);
  /** Live bench parameters, so the 3D instruments follow the knobs. */
  const [benchParameters, setBenchParameters] = React.useState<Record<string, unknown> | null>(
    null,
  );
  /** What the big screen and the whiteboard are teaching right now. */
  const [lesson, setLesson] = React.useState<LessonContext | undefined>(undefined);

  // One mutable object shared by the keyboard, the on-screen stick and the
  // render loop. Never state: it changes every frame.
  const input = React.useMemo(() => createPlayerInput(), []);

  const avatar = useQuery({ queryKey: ['avatar'], queryFn: studentService.avatar });
  const progress = useQuery({ queryKey: ['progress'], queryFn: studentService.progress });
  const lab = useQuery({
    queryKey: ['lab', 'signal-lab'],
    queryFn: () => labService.detail('signal-lab'),
  });

  const onNear = React.useCallback((id: PointId | null) => setNear(id), []);

  // Opening a bench must not leave the lab: the camera walks up to the
  // instrument and the panel opens over the scene.
  const onInteract = React.useCallback((id: PointId) => setFocus(id), []);

  const onLeaveStation = React.useCallback(() => {
    setFocus(null);
    setBenchParameters(null);
    setLesson(undefined);
  }, []);

  const onExit = React.useCallback(() => router.push('/dashboard'), [router]);

  const onMove = React.useCallback(
    (transform: { x: number; z: number; rotation: number }) => {
      // Fire and forget: losing one autosave is harmless, blocking the render
      // loop on a round trip is not.
      void studentService
        .saveTransform({
          position_x: transform.x,
          position_y: 0,
          position_z: transform.z,
          rotation: transform.rotation,
        })
        .catch(() => undefined);
    },
    [],
  );

  // Resume where the student left the room, clamped inside it.
  const start = React.useMemo(() => {
    const a = avatar.data;
    const x = a ? Math.min(Math.max(a.position_x, -5.4), 5.4) : 4.2;
    const z = a ? Math.min(Math.max(a.position_z, -4.4), 4.4) : 3.6;
    // A never-placed avatar has x = z = rotation = 0; drop it in the aisle
    // facing the benches rather than nose-first into the back wall.
    const placed = Boolean(a && (a.position_x !== 0 || a.position_z !== 0));
    return {
      // Middle of the aisle, far enough from the back wall that the
      // third-person rig fits behind the avatar instead of being squeezed
      // against it; clear of the desks (z = 1.8) and of every interaction
      // radius.
      x: placed ? x : 1.4,
      z: placed ? z : 1.2,
      rotation: placed ? a!.rotation : Math.PI,
    };
  }, [avatar.data]);

  const focusPoint = pointById(focus);

  const appearance = React.useMemo(() => {
    const a = avatar.data;
    return {
      ...(OUTFITS[a?.outfit ?? 'lab_coat'] ?? OUTFITS.lab_coat),
      skin: SKINS[a?.skin ?? 'default'] ?? SKINS.default,
      hair: HAIRS[a?.hair ?? 'default'] ?? HAIRS.default,
    };
  }, [avatar.data]);

  const signal = React.useMemo(
    () => (benchParameters ? signalFromParameters(benchParameters) : DEFAULT_SIGNAL),
    [benchParameters],
  );

  const ready = !avatar.isLoading;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#c6d2d8]">
      {!ready ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
            <p className="text-sm text-ink-500">Ouverture de la salle…</p>
          </div>
        </div>
      ) : (
        <>
          {/* The look surface sits under the HUD so dragging the background
              orbits the camera, while HUD controls still receive their clicks. */}
          <LookSurface input={input} disabled={focus !== null}>
            <LabScene
              signal={signal}
              input={input}
              view={view}
              focus={focus}
              lesson={lesson}
              locked={focus !== null}
              start={start}
              appearance={appearance}
              near={near}
              onNear={onNear}
              onInteract={onInteract}
              onExit={onExit}
              onMove={onMove}
            />
          </LookSurface>

          {!focus && (
            <LabHud
              input={input}
              near={near}
              view={view}
              onToggleView={() => setView((v) => (v === 'third' ? 'first' : 'third'))}
              onInteract={() => {
                input.interact = true;
              }}
              level={progress.data?.level ?? null}
              experiments={lab.data?.experiments}
            />
          )}

          {focusPoint && (
            <div className="pointer-events-none absolute inset-0">
              <StationPanel
                point={focusPoint}
                onClose={onLeaveStation}
                onParameters={setBenchParameters}
                onLesson={setLesson}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
