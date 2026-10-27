import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Engineering notation: 1500 -> "1.5 kHz", 0.002 -> "2 ms". */
export function formatUnit(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `- ${unit}`;
  const abs = Math.abs(value);
  const scales: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
  ];
  if (abs === 0) return `0 ${unit}`;
  const [factor, prefix] = scales.find(([f]) => abs >= f) ?? [1e-9, 'n'];
  const scaled = value / factor;
  return `${Number(scaled.toPrecision(digits))} ${prefix}${unit}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
