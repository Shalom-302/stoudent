'use client';

import {
  ArrowLeft,
  BookOpen,
  Eye,
  Keyboard,
  Map as MapIcon,
  Minus,
  Navigation,
  Network,
  Plane,
  Plus,
  Search,
  Tag,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { MovePad, RunToggle } from '@/components/world3d/controls/MovePad';
import type { PlayerInput, PlayerTracker } from '@/components/world3d/Player';
import { Button } from '@/components/ui/button';
import {
  BUILDINGS,
  EQUIPMENT,
  EXTENT,
  FIBRE_ROUTE,
  STREETS,
  equipmentById,
  type Equipment,
  type EquipmentType,
} from '@/lib/terrain/city';
import { SITE_CONTENT, SITE_ORDER } from '@/lib/terrain/sites';
import { cn } from '@/lib/utils';

/** Pin colour per type, shared by the map and its legend. */
const TYPE_COLOR: Record<EquipmentType, string> = {
  fh: '#0ea5e9',
  'fh-roof': '#38bdf8',
  gsm: '#a855f7',
  smallcell: '#c084fc',
  nro: '#ea580c',
  sro: '#f97316',
  chambre: '#fb923c',
  pbo: '#fdba74',
};

/**
 * Where the camera orbits for a close look, and from how far: the dishes of a
 * tower, the panels of a rooftop site, the box on a pole.
 */
function closeUp(e: Equipment): { y: number; distance: number } | null {
  switch (e.type) {
    case 'fh':
      return { y: 24, distance: 11 };
    case 'gsm':
      return { y: e.y + 4.2, distance: 8 };
    case 'fh-roof':
      return { y: e.y + 1.9, distance: 5 };
    case 'smallcell':
      return { y: 7.6, distance: 4 };
    case 'pbo':
      return { y: 5.2, distance: 3.5 };
    case 'nro':
      return { y: 4, distance: 18 };
    default:
      return null; // at street level: the normal view already shows it
  }
}

/** Drops the avatar at the spot where the equipment is examined, facing it. */
function goTo(input: PlayerInput, e: Equipment) {
  input.teleport = {
    x: e.stand[0],
    z: e.stand[1],
    heading: Math.atan2(e.at[0] - e.stand[0], e.at[1] - e.stand[1]),
    lookUp: e.type === 'fh' || e.type === 'gsm' || e.type === 'fh-roof',
  };
}

/**
 * North-up plan of the district: streets, buildings, the fibre route and
 * every piece of equipment. The arrow follows the avatar.
 */
function Plan({
  size,
  tracker,
  discovered,
  onPick,
  selected,
}: {
  size: number;
  tracker: PlayerTracker;
  discovered: Set<EquipmentType>;
  onPick?: (e: Equipment) => void;
  selected?: string | null;
}) {
  const arrow = React.useRef<SVGGElement>(null);
  const scale = size / (EXTENT * 2);
  const px = React.useCallback((v: number) => (v + EXTENT) * scale, [scale]);

  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (arrow.current) {
        // heading 0 faces +z (down on the plan), hence the 180° turn.
        const deg = 180 - (tracker.heading * 180) / Math.PI;
        arrow.current.setAttribute('transform', `translate(${px(tracker.x)} ${px(tracker.z)}) rotate(${deg})`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tracker, px]);

  const r = Math.max(3, size / 45);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" role="img" aria-label="Plan du quartier">
      <rect width={size} height={size} fill="#d8c19c" />
      {BUILDINGS.map((b, i) => (
        <rect key={i} x={px(b.minX)} y={px(b.minZ)} width={(b.maxX - b.minX) * scale} height={(b.maxZ - b.minZ) * scale} fill={b.name ? '#8f9aa3' : '#c4ab84'} />
      ))}
      {STREETS.map((s) => (
        <rect key={s.name} x={px(s.minX)} y={px(s.minZ)} width={(s.maxX - s.minX) * scale} height={(s.maxZ - s.minZ) * scale} fill="#55595d" />
      ))}
      <polyline
        points={FIBRE_ROUTE.map(([x, z]) => `${px(x)},${px(z)}`).join(' ')}
        fill="none"
        stroke="#ff8a1f"
        strokeWidth={Math.max(1.5, size / 160)}
        strokeDasharray="4 3"
      />
      {EQUIPMENT.filter((e) => e.link && e.id < e.link).map((e) => {
        const o = equipmentById(e.link!)!;
        return <line key={e.id} x1={px(e.at[0])} y1={px(e.at[1])} x2={px(o.at[0])} y2={px(o.at[1])} stroke="#38bdf8" strokeWidth={1.2} strokeDasharray="3 3" />;
      })}
      {EQUIPMENT.map((e) => (
        <circle
          key={e.id}
          cx={px(e.at[0])}
          cy={px(e.at[1])}
          r={selected === e.id ? r * 1.6 : r}
          fill={TYPE_COLOR[e.type]}
          stroke={discovered.has(e.type) ? '#21b36b' : '#1d2023'}
          strokeWidth={discovered.has(e.type) ? 2 : 1}
          className={onPick ? 'cursor-pointer' : undefined}
          onClick={onPick ? () => onPick(e) : undefined}
        />
      ))}
      <g ref={arrow}>
        <path d={`M0 ${-r * 2} L${r * 1.5} ${r * 1.6} L0 ${r * 0.8} L${-r * 1.5} ${r * 1.6} Z`} fill="#ffffff" stroke="#1d2023" strokeWidth={1} />
      </g>
    </svg>
  );
}

/** The district map, full screen: pick an equipment, read what it is, go there. */
function FullMap({
  input,
  tracker,
  discovered,
  onClose,
}: {
  input: PlayerInput;
  tracker: PlayerTracker;
  discovered: Set<EquipmentType>;
  onClose: () => void;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [size, setSize] = React.useState(320);
  React.useEffect(() => {
    const fit = () => setSize(Math.min(window.innerWidth - 32, window.innerHeight - 260, 560));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const go = (e: Equipment) => {
    goTo(input, e);
    onClose();
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 overflow-y-auto bg-ink-900/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-label="Carte du quartier">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink-900">Carte du quartier</p>
            <p className="text-xs text-ink-500">Touche un équipement sur la carte ou dans la liste, puis « Y aller ».</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer la carte" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row">
          <div className="shrink-0 self-center overflow-hidden rounded-xl border border-ink-200">
            <Plan size={size} tracker={tracker} discovered={discovered} onPick={(e) => setSelected(e.id)} selected={selected} />
          </div>
          <ul className="min-w-0 flex-1 space-y-3">
            {SITE_ORDER.map((type) => {
              const items = EQUIPMENT.filter((e) => e.type === type);
              return (
                <li key={type}>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[type] }} />
                    {SITE_CONTENT[type].title}
                    {discovered.has(type) && <span className="text-success">· vu</span>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {items.map((e, i) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => go(e)}
                        onMouseEnter={() => setSelected(e.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                          selected === e.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-900',
                        )}
                      >
                        <Navigation className="h-3 w-3" aria-hidden />
                        Y aller{items.length > 1 ? ` · ${i + 1}` : ''}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface TerrainHudProps {
  input: PlayerInput;
  tracker: PlayerTracker;
  near: string | null;
  view: 'third' | 'first';
  discovered: Set<EquipmentType>;
  mastered: Set<EquipmentType>;
  networks: boolean;
  labels: boolean;
  onToggleView: () => void;
  onToggleNetworks: () => void;
  onToggleLabels: () => void;
}

export function TerrainHud({
  input,
  tracker,
  near,
  view,
  discovered,
  mastered,
  networks,
  labels,
  onToggleView,
  onToggleNetworks,
  onToggleLabels,
}: TerrainHudProps) {
  const [notebook, setNotebook] = React.useState(false);
  const [map, setMap] = React.useState(false);
  const [aerial, setAerial] = React.useState(false);
  // The close-up ends when the student walks (the Player clears input.orbit).
  const [orbiting, setOrbiting] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setOrbiting(input.orbit !== null), 250);
    return () => clearInterval(id);
  }, [input]);
  const toggleAerial = () => {
    input.orbit = null;
    if (aerial) {
      input.zoomTo = 2.4;
      input.pitchTo = 0.24;
    } else {
      input.zoomTo = 60;
      input.pitchTo = 1.2;
    }
    setAerial(!aerial);
  };
  const lookCloser = (e: Equipment) => {
    const c = closeUp(e);
    if (!c) return;
    input.orbit = { x: e.at[0], y: c.y, z: e.at[1] };
    input.zoomTo = c.distance;
    input.pitchTo = 0.2;
    setOrbiting(true);
    setAerial(false);
  };
  const backToStudent = () => {
    input.orbit = null;
    input.zoomTo = 2.4;
    input.pitchTo = 0.24;
    setOrbiting(false);
  };
  const here = equipmentById(near);
  const content = here ? SITE_CONTENT[here.type] : null;
  const toggle = 'bg-white/90 aria-pressed:bg-ink-900 aria-pressed:text-white';

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex max-w-[calc(100%-150px)] flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="bg-white/90">
            <Link href="/labs" aria-label="Laboratoires">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Laboratoires</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNotebook((v) => !v)} aria-expanded={notebook} className="bg-white/90">
            <BookOpen className="h-4 w-4" />
            Carnet {discovered.size}/{SITE_ORDER.length}
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleNetworks} aria-pressed={networks} className={toggle}>
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Réseaux</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleLabels} aria-pressed={labels} className={toggle}>
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Étiquettes</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleView} className="bg-white/90" aria-label={view === 'third' ? 'Vue 1re personne' : 'Vue 3e personne'}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setMap(true)}
          aria-label="Ouvrir la carte"
          className="pointer-events-auto relative overflow-hidden rounded-xl border border-ink-200 shadow"
        >
          <Plan size={132} tracker={tracker} discovered={discovered} />
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-ink-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <MapIcon className="h-3 w-3" /> Carte
          </span>
        </button>
      </div>

      {networks && (
        <div className="pointer-events-none absolute right-3 top-[156px] hidden rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-ink-700 shadow sm:right-4 sm:block">
          <p className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-[#38bdf8]" /> Liaison radio
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-[#ff8a1f]" /> Fibre (enterrée, aérienne)
          </p>
        </div>
      )}

      {notebook && (
        <div className="pointer-events-auto absolute left-3 top-16 w-72 rounded-2xl border border-ink-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-4">
          <p className="font-display text-base font-semibold text-ink-900">Carnet de terrain</p>
          <p className="mt-0.5 text-xs text-ink-500">Examine chaque type d’équipement. Le quiz (et la mission) le rendent « maîtrisé ».</p>
          <ul className="mt-3 space-y-2">
            {SITE_ORDER.map((type) => (
              <li key={type} className="flex items-center gap-2 text-sm">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', mastered.has(type) ? 'bg-success' : discovered.has(type) ? 'bg-[#f2b705]' : 'bg-ink-200')} />
                <span className={discovered.has(type) ? 'text-ink-900' : 'text-ink-500'}>{SITE_CONTENT[type].title}</span>
                {mastered.has(type) && <span className="ml-auto text-[11px] font-semibold text-success">maîtrisé</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {here && content && (
        <div
          className={cn(
            'absolute inset-x-0 flex justify-center px-4',
            // Out of the way when the point is to look at the equipment.
            orbiting || aerial ? 'top-[150px] sm:top-16' : 'top-1/2 -translate-y-1/2',
          )}
        >
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm font-semibold text-ink-900">{here.label}</p>
            <p className="mt-0.5 text-xs text-ink-500">{content.subtitle}</p>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  input.interact = true;
                }}
              >
                <Search className="h-4 w-4" /> Examiner
                <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">E</kbd>
              </Button>
              {closeUp(here) && !orbiting && (
                <Button size="sm" variant="outline" onClick={() => lookCloser(here)}>
                  <ZoomIn className="h-4 w-4" /> Voir de près
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
        <MovePad input={input} />
        <div className="flex flex-col items-end gap-2">
          <p className="pointer-events-none hidden items-center gap-2 rounded-full bg-ink-900/85 px-3 py-1.5 text-[11px] text-white lg:flex">
            <Keyboard className="h-3.5 w-3.5" />
            ZQSD · glisser pour regarder · molette pour zoomer · Maj pour courir · E pour examiner
          </p>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {orbiting && (
              <Button size="sm" onClick={backToStudent}>
                <User className="h-4 w-4" /> Revenir à l’avatar
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white/90" aria-label="Rapprocher la caméra" onClick={() => (input.zoom -= 0.35)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white/90" aria-label="Éloigner la caméra" onClick={() => (input.zoom += 0.35)}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={toggleAerial} aria-pressed={aerial} className={toggle}>
                <Plane className="h-4 w-4" /> <span className="hidden sm:inline">Vue aérienne</span>
              </Button>
            </div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <Button variant="outline" size="sm" className="bg-white/90" onClick={() => setMap(true)}>
              <MapIcon className="h-4 w-4" /> Carte
            </Button>
            <RunToggle input={input} />
          </div>
        </div>
      </div>

      {map && <FullMap input={input} tracker={tracker} discovered={discovered} onClose={() => setMap(false)} />}
    </div>
  );
}
