'use client';

import { FilterBench } from './filter-bench';
import { FourierBench } from './fourier-bench';
import { SamplingBench } from './sampling-bench';
import { SignalsBench } from './signals-bench';
import { SpectrumBench } from './spectrum-bench';
import type { BenchProps } from './types';

/**
 * Slug -> bench. The seed data owns the slugs, so adding an experiment to the
 * catalogue and wiring its instruments are two independent changes.
 */
const BENCHES: Record<string, React.ComponentType<BenchProps>> = {
  'signaux-elementaires': SignalsBench,
  'serie-de-fourier': FourierBench,
  'transformee-de-fourier': SpectrumBench,
  echantillonnage: SamplingBench,
  filtrage: FilterBench,
};

export function Bench({ slug, ...props }: BenchProps & { slug: string }) {
  const Component = BENCHES[slug];
  if (!Component) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
        <p className="text-sm font-medium text-ink-700">Banc en préparation</p>
        <p className="mt-1 text-sm text-ink-500">
          Les instruments de cette expérience arrivent dans une prochaine version.
        </p>
      </div>
    );
  }
  return <Component {...props} />;
}

export { FilterBench, FourierBench, SamplingBench, SignalsBench, SpectrumBench };
export type { BenchProps };
