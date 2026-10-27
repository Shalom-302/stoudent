'use client';

import * as React from 'react';

import type { PlayerInput } from '@/components/world3d/Player';
import { cn } from '@/lib/utils';

const RADIUS = 52; // px, travel of the stick

interface MovePadProps {
  input: PlayerInput;
  disabled?: boolean;
}

/**
 * Virtual stick that drives the avatar.
 *
 * It writes straight into the shared `PlayerInput` object instead of going
 * through React state: the render loop reads it every frame, and pushing a
 * state update per pointer move would re-render the page 60 times a second for
 * nothing.
 *
 * Works with mouse, touch and pen through Pointer Events, so the same control
 * serves a laptop trackpad and a tablet.
 */
export function MovePad({ input, disabled }: MovePadProps) {
  const base = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef<HTMLDivElement>(null);
  const pointerId = React.useRef<number | null>(null);

  const reset = React.useCallback(() => {
    input.move.x = 0;
    input.move.y = 0;
    if (stick.current) stick.current.style.transform = 'translate(-50%, -50%)';
  }, [input]);

  React.useEffect(() => reset, [reset]);

  const apply = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = base.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;

    const distance = Math.hypot(dx, dy);
    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS;
      dy = (dy / distance) * RADIUS;
    }

    input.move.x = dx / RADIUS;
    // Screen Y grows downwards; forward is up.
    input.move.y = -dy / RADIUS;
    if (stick.current) {
      stick.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  };

  return (
    <div
      ref={base}
      role="application"
      aria-label="Manche de déplacement de l’avatar"
      className={cn(
        'pointer-events-auto relative h-32 w-32 touch-none select-none rounded-full border border-ink-200 bg-white/85 backdrop-blur',
        disabled && 'pointer-events-none opacity-40',
      )}
      onPointerDown={(event) => {
        if (disabled) return;
        pointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        apply(event);
      }}
      onPointerMove={(event) => {
        if (pointerId.current !== event.pointerId) return;
        apply(event);
      }}
      onPointerUp={(event) => {
        if (pointerId.current !== event.pointerId) return;
        pointerId.current = null;
        reset();
      }}
      onPointerCancel={() => {
        pointerId.current = null;
        reset();
      }}
    >
      {/* Cardinal hints, so the control reads as a D-pad at a glance. */}
      <span aria-hidden className="absolute inset-x-0 top-1.5 text-center text-[10px] text-ink-400">
        Z
      </span>
      <span aria-hidden className="absolute inset-y-0 left-2 flex items-center text-[10px] text-ink-400">
        Q
      </span>
      <span aria-hidden className="absolute inset-y-0 right-2 flex items-center text-[10px] text-ink-400">
        D
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-1.5 text-center text-[10px] text-ink-400"
      >
        S
      </span>

      <div
        ref={stick}
        aria-hidden
        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink-900 transition-[background-color] duration-150"
      />
    </div>
  );
}

interface LookSurfaceProps {
  input: PlayerInput;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Drag-to-look surface laid over the canvas.
 *
 * Pointer lock is deliberately not used: it hijacks the cursor, breaks on
 * tablets, and a student who wants to click the HUD should not have to press
 * Escape first.
 */
export function LookSurface({ input, disabled, children }: LookSurfaceProps) {
  const dragging = React.useRef<number | null>(null);
  const last = React.useRef({ x: 0, y: 0 });

  return (
    <div
      className="absolute inset-0 touch-none"
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        dragging.current = event.pointerId;
        last.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragging.current !== event.pointerId) return;
        const dx = event.clientX - last.current.x;
        const dy = event.clientY - last.current.y;
        last.current = { x: event.clientX, y: event.clientY };
        // Accumulated in radians; the render loop consumes and zeroes it.
        input.lookYaw += dx * 0.005;
        input.lookPitch += dy * 0.004;
      }}
      onPointerUp={(event) => {
        if (dragging.current === event.pointerId) dragging.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
    >
      {children}
    </div>
  );
}
