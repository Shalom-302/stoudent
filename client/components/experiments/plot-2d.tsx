'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface PlotSeries {
  x: number[];
  y: number[];
  color?: string;
  width?: number;
  dashed?: boolean;
  /** Draw discrete markers instead of a line - used for sampled points. */
  style?: 'line' | 'points' | 'stems';
  label?: string;
}

export interface PlotMarker {
  x: number;
  label: string;
}

interface Plot2DProps {
  series: PlotSeries[];
  xLabel?: string;
  yLabel?: string;
  /** Formats the axis ticks; defaults to a compact numeric form. */
  xFormat?: (value: number) => string;
  yFormat?: (value: number) => string;
  yDomain?: [number, number];
  xDomain?: [number, number];
  markers?: PlotMarker[];
  height?: number;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_COLORS = ['#18181b', '#e9c21f', '#17916b', '#c0392b', '#6b6b77'];
const PADDING = { top: 14, right: 16, bottom: 34, left: 52 };

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 1e-6; v += step) ticks.push(v);
  return ticks;
}

function compact(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e4 || abs < 1e-3) return value.toExponential(1);
  return Number(value.toPrecision(3)).toString();
}

/**
 * Canvas plot shared by the oscilloscope, the spectrum analyzer and the Bode
 * panel.
 *
 * Canvas rather than SVG on purpose: a trace is up to 2048 points and the
 * student drags a frequency knob continuously, which would mean re-creating
 * thousands of DOM nodes per frame.
 */
export function Plot2D({
  series,
  xLabel,
  yLabel,
  xFormat = compact,
  yFormat = compact,
  yDomain,
  xDomain,
  markers,
  height = 260,
  className,
  ariaLabel,
}: Plot2DProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Starts at 0, never at a guess: any non-zero default is a width the canvas
  // would impose on its column before the first measurement lands.
  const [width, setWidth] = React.useState(0);

  // Layout effect, so the first real measurement happens before paint and the
  // trace never flashes at the wrong size.
  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = (next: number) => {
      // Round to whole pixels: sub-pixel jitter from a flex/grid parent would
      // otherwise retrigger the observer forever.
      const rounded = Math.round(next);
      setWidth((current) => (Math.abs(current - rounded) > 0.5 ? rounded : current));
    };

    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next !== undefined) measure(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    if (width <= 0) return;

    // Render at device resolution: a 1 px trace on a HiDPI screen is otherwise
    // a blurry 2 px smear, which reads as noise on an oscilloscope.
    //
    // Only the *backing store* is sized in pixels here. The CSS width stays
    // `w-full` so the element is sized BY its column, never the other way
    // round: an inline pixel width beats the class, and a canvas that dictates
    // its own width overflows the grid track and paints over the next column.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) return;

    const visible = series.filter((s) => s.x.length > 0 && s.y.length > 0);
    if (visible.length === 0) return;

    const xValues = visible.flatMap((s) => [s.x[0], s.x[s.x.length - 1]]);
    let xMin = xDomain?.[0] ?? Math.min(...xValues);
    let xMax = xDomain?.[1] ?? Math.max(...xValues);
    if (xMin === xMax) xMax = xMin + 1;

    let yMin: number;
    let yMax: number;
    if (yDomain) {
      [yMin, yMax] = yDomain;
    } else {
      yMin = Infinity;
      yMax = -Infinity;
      for (const s of visible) {
        for (const v of s.y) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return;
      const margin = (yMax - yMin) * 0.12 || 0.5;
      yMin -= margin;
      yMax += margin;
    }

    const sx = (v: number) => PADDING.left + ((v - xMin) / (xMax - xMin)) * plotWidth;
    const sy = (v: number) => PADDING.top + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    // Grid
    context.strokeStyle = 'rgba(0,0,0,0.07)';
    context.fillStyle = '#8d8d98';
    context.lineWidth = 1;
    context.font = '11px ui-sans-serif, system-ui, sans-serif';

    for (const tick of niceTicks(yMin, yMax, 4)) {
      const y = Math.round(sy(tick)) + 0.5;
      context.beginPath();
      context.moveTo(PADDING.left, y);
      context.lineTo(width - PADDING.right, y);
      context.stroke();
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      context.fillText(yFormat(tick), PADDING.left - 8, y);
    }

    // Engineering-notation labels are wide ("200 µs"); asking for five ticks
    // on a narrow column runs them into each other.
    const xTickCount = Math.max(2, Math.min(5, Math.floor(plotWidth / 95)));
    for (const tick of niceTicks(xMin, xMax, xTickCount)) {
      const x = Math.round(sx(tick)) + 0.5;
      context.beginPath();
      context.moveTo(x, PADDING.top);
      context.lineTo(x, PADDING.top + plotHeight);
      context.stroke();
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillText(xFormat(tick), x, PADDING.top + plotHeight + 8);
    }

    // Zero line, when it falls inside the view
    if (yMin < 0 && yMax > 0) {
      context.strokeStyle = 'rgba(0,0,0,0.22)';
      const y = Math.round(sy(0)) + 0.5;
      context.beginPath();
      context.moveTo(PADDING.left, y);
      context.lineTo(width - PADDING.right, y);
      context.stroke();
    }

    // Frequency markers (spectral peaks)
    if (markers?.length) {
      context.strokeStyle = 'rgba(233,194,31,0.9)';
      context.fillStyle = '#c39b12';
      context.setLineDash([3, 3]);
      context.textAlign = 'center';
      context.textBaseline = 'top';
      for (const marker of markers) {
        if (marker.x < xMin || marker.x > xMax) continue;
        const x = Math.round(sx(marker.x)) + 0.5;
        context.beginPath();
        context.moveTo(x, PADDING.top);
        context.lineTo(x, PADDING.top + plotHeight);
        context.stroke();
        context.fillText(marker.label, x, PADDING.top + 2);
      }
      context.setLineDash([]);
    }

    // Traces
    context.save();
    context.beginPath();
    context.rect(PADDING.left, PADDING.top, plotWidth, plotHeight);
    context.clip();

    visible.forEach((s, index) => {
      const color = s.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = s.width ?? 1.75;
      context.setLineDash(s.dashed ? [5, 4] : []);
      const count = Math.min(s.x.length, s.y.length);

      if (s.style === 'points' || s.style === 'stems') {
        const zeroY = sy(Math.max(Math.min(0, yMax), yMin));
        for (let i = 0; i < count; i += 1) {
          const px = sx(s.x[i]);
          const py = sy(s.y[i]);
          if (s.style === 'stems') {
            context.beginPath();
            context.moveTo(px, zeroY);
            context.lineTo(px, py);
            context.stroke();
          }
          context.beginPath();
          context.arc(px, py, 2.4, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.beginPath();
        for (let i = 0; i < count; i += 1) {
          const px = sx(s.x[i]);
          const py = sy(s.y[i]);
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.stroke();
      }
      context.setLineDash([]);
    });

    context.restore();

    // Frame
    context.strokeStyle = 'rgba(0,0,0,0.14)';
    context.lineWidth = 1;
    context.strokeRect(
      PADDING.left + 0.5,
      PADDING.top + 0.5,
      plotWidth - 1,
      plotHeight - 1,
    );
  }, [series, width, height, yDomain, xDomain, markers, xFormat, yFormat]);

  const legend = series.filter((s) => s.label);

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel ?? `Graphique ${yLabel ?? ''} en fonction de ${xLabel ?? ''}`}
        className="block w-full rounded-lg bg-white"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
        {legend.length > 0 && (
          <ul className="flex flex-wrap items-center gap-3">
            {legend.map((s, index) => (
              <li key={s.label} className="flex items-center gap-1.5 text-xs text-ink-600">
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded-full"
                  style={{
                    backgroundColor: s.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                  }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {(xLabel || yLabel) && (
          <p className="text-xs text-ink-400">
            {yLabel ? `${yLabel} / ` : ''}
            {xLabel}
          </p>
        )}
      </div>
    </div>
  );
}
