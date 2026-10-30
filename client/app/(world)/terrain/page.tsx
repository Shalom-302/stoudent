'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { SitePanel } from '@/components/terrain/SitePanel';
import { TerrainHud } from '@/components/terrain/TerrainHud';
import { LookSurface } from '@/components/world3d/controls/MovePad';
import { createPlayerInput, type PlayerTracker } from '@/components/world3d/Player';
import { SPAWN, type SiteId } from '@/lib/terrain/city';
import { SITE_CONTENT } from '@/lib/terrain/sites';
import { studentService } from '@/services/student';

// three touches `window` at import time: never in the server bundle.
const TerrainScene = dynamic(() => import('@/components/terrain/TerrainScene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-ink-500">Arrivée dans le quartier…</p>
    </div>
  ),
});

const SKINS: Record<string, string> = { default: '#c9a184', medium: '#a9784f', dark: '#7d4f33' };
const HAIRS: Record<string, string> = { default: '#2c2620', blond: '#c7a25e', red: '#8f4429' };

interface Notebook {
  discovered: SiteId[];
  missions: SiteId[];
  quizzes: SiteId[];
}

const STORAGE_KEY = 'stoudent.terrain.v1';
const EMPTY: Notebook = { discovered: [], missions: [], quizzes: [] };

/** The field notebook lives on this device for now; losing it only loses green dots. */
function useNotebook() {
  const [notebook, setNotebook] = React.useState<Notebook>(EMPTY);
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Notebook | null;
      if (saved) setNotebook({ ...EMPTY, ...saved });
    } catch {
      // private window, blocked storage: start empty
    }
  }, []);
  const add = React.useCallback((key: keyof Notebook, id: SiteId) => {
    setNotebook((current) => {
      if (current[key].includes(id)) return current;
      const next = { ...current, [key]: [...current[key], id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return { notebook, add };
}

/** Labo Terrain: walk the district and examine its telecom infrastructure. */
export default function TerrainPage() {
  const input = React.useMemo(() => createPlayerInput(), []);
  const tracker = React.useMemo<PlayerTracker>(() => ({ x: SPAWN.x, z: SPAWN.z, heading: SPAWN.rotation }), []);
  const [near, setNear] = React.useState<SiteId | null>(null);
  const [open, setOpen] = React.useState<SiteId | null>(null);
  const [view, setView] = React.useState<'third' | 'first'>('third');
  const [beam, setBeam] = React.useState<'unknown' | 'up' | 'down'>('unknown');
  const { notebook, add } = useNotebook();

  const avatar = useQuery({ queryKey: ['avatar'], queryFn: studentService.avatar });
  const appearance = React.useMemo(
    () => ({
      // Outdoors: street clothes rather than the lab coat.
      outfit: '#2f4f6f',
      outfitLight: '#3d637f',
      skin: SKINS[avatar.data?.skin ?? 'default'] ?? SKINS.default,
      hair: HAIRS[avatar.data?.hair ?? 'default'] ?? HAIRS.default,
    }),
    [avatar.data],
  );

  const discovered = React.useMemo(() => new Set(notebook.discovered), [notebook.discovered]);
  // Mastered: the quiz passed, and the mission too where the site has one.
  const mastered = React.useMemo(
    () =>
      new Set(
        notebook.quizzes.filter((id) => !SITE_CONTENT[id].mission || notebook.missions.includes(id)),
      ),
    [notebook.quizzes, notebook.missions],
  );

  const onInteract = React.useCallback(
    (id: SiteId) => {
      setOpen(id);
      add('discovered', id);
    },
    [add],
  );
  const onMission = React.useCallback(() => open && add('missions', open), [open, add]);
  const onQuiz = React.useCallback(() => open && add('quizzes', open), [open, add]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#cfe3f1]">
      <LookSurface input={input} disabled={open !== null}>
        <TerrainScene
          input={input}
          tracker={tracker}
          view={view}
          locked={open !== null}
          appearance={appearance}
          near={near}
          discovered={discovered}
          beam={beam}
          onNear={setNear}
          onInteract={onInteract}
        />
      </LookSurface>

      {!open && (
        <TerrainHud
          input={input}
          tracker={tracker}
          near={near}
          view={view}
          discovered={discovered}
          mastered={mastered}
          onToggleView={() => setView((v) => (v === 'third' ? 'first' : 'third'))}
        />
      )}

      {open && (
        <div className="pointer-events-none absolute inset-0">
          <SitePanel
            site={open}
            progress={{ mission: notebook.missions.includes(open), quiz: notebook.quizzes.includes(open) }}
            onClose={() => setOpen(null)}
            onMission={onMission}
            onQuiz={onQuiz}
            onBeam={setBeam}
          />
        </div>
      )}
    </div>
  );
}
