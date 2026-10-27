'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn, formatUnit } from '@/lib/utils';

interface KnobProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** Logarithmic travel, for frequency knobs spanning several decades. */
  log?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * A labelled control on the bench.
 *
 * Frequency knobs use a logarithmic slider: on a linear one, the whole audio
 * band below 1 kHz collapses into the first 5 % of travel and the student
 * cannot set 50 Hz at all.
 */
export function Knob({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  log = false,
  disabled,
  onChange,
}: KnobProps) {
  const toSlider = (v: number) =>
    log ? Math.log10(Math.max(v, min)) : v;
  const fromSlider = (v: number) => (log ? 10 ** v : v);

  const sliderMin = toSlider(min);
  const sliderMax = toSlider(max);
  const sliderStep = log ? (sliderMax - sliderMin) / 200 : step;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <output
          htmlFor={id}
          className="font-mono text-xs font-medium text-ink-900"
        >
          {unit ? formatUnit(value, unit) : Number(value.toPrecision(4))}
        </output>
      </div>
      <Slider
        id={id}
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={[toSlider(value)]}
        disabled={disabled}
        onValueChange={([next]) => {
          const raw = fromSlider(next);
          // Snap back to the declared step so the readout stays legible.
          const snapped = log ? Number(raw.toPrecision(3)) : Math.round(raw / step) * step;
          onChange(Math.min(Math.max(snapped, min), max));
        }}
        aria-label={label}
      />
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

interface ChoiceProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}

export function Choice({ id, label, value, options, disabled, className, onChange }: ChoiceProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ControlPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-4 rounded-[var(--radius-card)] border border-ink-200 bg-ink-50 p-4',
        className,
      )}
    >
      {title && (
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}
