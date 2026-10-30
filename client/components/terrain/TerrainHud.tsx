'use client';

import { ArrowLeft, BookOpen, Eye, Footprints, Keyboard, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { MovePad } from '@/components/world3d/controls/MovePad';
import type { PlayerInput, PlayerTracker } from '@/components/world3d/Player';
import { Button } from '@/components/ui/button';
import { EXTENT, ORION, SIGMA, SITES, STREETS, type SiteId } from '@/lib/terrain/city';
import { SITE_CONTENT, SITE_ORDER } from '@/lib/terrain/sites';
import { cn } from '@/lib/utils';

const MAP = 132; // px

/** North-up map of the district; the arrow follows the avatar, pins turn green once examined. */
function MiniMap({ tracker, discovered }: { tracker: PlayerTracker; discovered: Set<SiteId> }) {
  const arrow = React.useRef<SVGGElement>(null);
  const scale = MAP / (EXTENT * 2);
  const px = (v: number) => (v + EXTENT) * scale;

  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (arrow.current) {
        // heading 0 faces +z (south on the map), hence the 180° turn.
        const deg = 180 - (tracker.heading * 180) / Math.PI;
        arrow.current.setAttribute('transform', `translate(${px(tracker.x)} ${px(tracker.z)}) rotate(${deg})`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- px depends on constants only
  }, [tracker]);

  return (
    <svg
      width={MAP}
      height={MAP}
      viewBox={`0 0 ${MAP} ${MAP}`}
      className="rounded-xl border border-ink-200 bg-[#d8c19c]/95 shadow"
      role="img"
      aria-label="Plan du quartier"
    >
      {STREETS.map((s) => (
        <rect key={s.name} x={px(s.minX)} y={px(s.minZ)} width={(s.maxX - s.minX) * scale} height={(s.maxZ - s.minZ) * scale} fill="#55595d" />
      ))}
      {[SIGMA, ORION].map((b) => (
        <rect key={b.name} x={px(b.minX)} y={px(b.minZ)} width={(b.maxX - b.minX) * scale} height={(b.maxZ - b.minZ) * scale} fill="#8f9aa3" />
      ))}
      {SITES.map((s) => (
        <circle key={s.id} cx={px(s.at[0])} cy={px(s.at[1])} r={4} fill={discovered.has(s.id) ? '#21b36b' : '#f2b705'} stroke="#1d2023" strokeWidth={1} />
      ))}
      <g ref={arrow}>
        <path d="M0 -6 L4.5 5 L0 2.5 L-4.5 5 Z" fill="#ffffff" stroke="#1d2023" strokeWidth={1} />
      </g>
    </svg>
  );
}

interface TerrainHudProps {
  input: PlayerInput;
  tracker: PlayerTracker;
  near: SiteId | null;
  view: 'third' | 'first';
  discovered: Set<SiteId>;
  mastered: Set<SiteId>;
  onToggleView: () => void;
}

export function TerrainHud({ input, tracker, near, view, discovered, mastered, onToggleView }: TerrainHudProps) {
  const [notebook, setNotebook] = React.useState(false);
  const site = near ? SITE_CONTENT[near] : null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="bg-white/90">
            <Link href="/labs">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Laboratoires</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleView} className="bg-white/90">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">{view === 'third' ? 'Vue 1re personne' : 'Vue 3e personne'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNotebook((v) => !v)} aria-expanded={notebook} className="bg-white/90">
            <BookOpen className="h-4 w-4" />
            Carnet {discovered.size}/{SITE_ORDER.length}
          </Button>
        </div>
        <div className="pointer-events-auto">
          <MiniMap tracker={tracker} discovered={discovered} />
        </div>
      </div>

      {notebook && (
        <div className="pointer-events-auto absolute left-3 top-16 w-72 rounded-2xl border border-ink-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-4">
          <p className="font-display text-base font-semibold text-ink-900">Carnet de terrain</p>
          <p className="mt-0.5 text-xs text-ink-500">Trouve les sites jaunes sur le plan et examine-les.</p>
          <ul className="mt-3 space-y-2">
            {SITE_ORDER.map((id) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    mastered.has(id) ? 'bg-success' : discovered.has(id) ? 'bg-[#f2b705]' : 'bg-ink-200',
                  )}
                />
                <span className={discovered.has(id) ? 'text-ink-900' : 'text-ink-400'}>
                  {discovered.has(id) ? SITE_CONTENT[id].title : '???'}
                </span>
                {mastered.has(id) && <span className="ml-auto text-[11px] font-semibold text-success">maîtrisé</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {site && (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm font-semibold text-ink-900">{site.title}</p>
            <p className="mt-0.5 text-xs text-ink-500">{site.subtitle}</p>
            <Button
              size="sm"
              className="mt-2.5 w-full"
              onClick={() => {
                input.interact = true;
              }}
            >
              <Search className="h-4 w-4" /> Examiner
              <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">E</kbd>
            </Button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
        <MovePad input={input} />
        <div className="flex flex-col items-end gap-2">
          <p className="pointer-events-none hidden items-center gap-2 rounded-full bg-ink-900/85 px-3 py-1.5 text-[11px] text-white lg:flex">
            <Keyboard className="h-3.5 w-3.5" />
            ZQSD / flèches · glisser pour regarder · Maj pour courir · E pour examiner
          </p>
          <div className="pointer-events-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/90"
              onPointerDown={() => {
                input.move.run = true;
              }}
              onPointerUp={() => {
                input.move.run = false;
              }}
              onPointerLeave={() => {
                input.move.run = false;
              }}
            >
              <Footprints className="h-4 w-4" /> Courir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
