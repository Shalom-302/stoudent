'use client';

import { ArrowLeft, DoorOpen, Eye, Footprints, Keyboard, Zap } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { MovePad } from '@/components/world3d/controls/MovePad';
import type { PlayerInput } from '@/components/world3d/Player';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { pointById, type PointId } from '@/lib/lab3d/stations';
import type { ExperimentSummary, LevelDetail } from '@/types';

interface LabHudProps {
  input: PlayerInput;
  near: PointId | null;
  view: 'third' | 'first';
  onToggleView: () => void;
  onInteract: () => void;
  level?: LevelDetail | null;
  experiments?: ExperimentSummary[];
}

/**
 * Game-style overlay: where you are, what you can do here, and the controls to
 * drive the avatar without a keyboard.
 */
export function LabHud({
  input,
  near,
  view,
  onToggleView,
  onInteract,
  level,
  experiments,
}: LabHudProps) {
  const point = pointById(near);
  const experiment = experiments?.find((item) => item.slug === point?.slug);
  const done = experiment?.status === 'completed';

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* -- Top bar ------------------------------------------------------- */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              MyLab
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleView}>
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">
              {view === 'third' ? 'Vue 1re personne' : 'Vue 3e personne'}
            </span>
            <span className="sm:hidden">{view === 'third' ? '1re' : '3e'}</span>
          </Button>
        </div>

        {level && (
          <div className="pointer-events-auto w-44 rounded-[var(--radius-card)] border border-ink-200 bg-white/90 p-2.5 backdrop-blur sm:w-56 sm:p-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-ink-700">Niveau {level.level_number}</span>
              <span className="flex items-center gap-1 font-mono text-xs text-ink-400">
                <Zap className="h-3 w-3" />
                {level.total_xp}
              </span>
            </div>
            <Progress value={level.progress_percent} />
            <p className="mt-1.5 truncate text-[11px] text-ink-400">{level.title}</p>
          </div>
        )}
      </div>

      {/* -- Station prompt ------------------------------------------------ */}
      {point && (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
          <div className="pointer-events-auto max-w-md rounded-[var(--radius-card)] border border-ink-200 bg-white/95 p-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">{point.title}</p>
              {done && <Badge variant="success">Validé</Badge>}
              {experiment && !done && experiment.best_score > 0 && (
                <Badge variant="outline">{experiment.best_score}/100</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-500">{point.subtitle}</p>
            <Button size="sm" className="mt-2.5 w-full" onClick={onInteract}>
              Utiliser ce poste
              <kbd className="ml-1 rounded bg-ink-900/10 px-1.5 py-0.5 text-[10px] font-semibold">
                E
              </kbd>
            </Button>
          </div>
        </div>
      )}

      {/* -- Bottom controls ---------------------------------------------- */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
        <MovePad input={input} />

        <div className="flex flex-col items-end gap-2">
          <p className="pointer-events-none hidden items-center gap-2 rounded-full bg-ink-900/85 px-3 py-1.5 text-[11px] text-white lg:flex">
            <Keyboard className="h-3.5 w-3.5" />
            ZQSD / flèches · glisser pour regarder · Maj pour courir · E pour utiliser
          </p>

          <div className="pointer-events-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              // Held, not toggled: the same gesture as holding Shift.
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
              <Footprints className="h-4 w-4" />
              Courir
            </Button>

            <Button
              size="sm"
              disabled={!point}
              onClick={() => {
                input.interact = true;
              }}
            >
              <DoorOpen className="h-4 w-4" />
              Utiliser
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
