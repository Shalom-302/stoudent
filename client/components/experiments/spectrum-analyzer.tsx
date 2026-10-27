'use client';

import * as React from 'react';

import { Instrument, Readout, ReadoutGrid } from '@/components/experiments/instrument';
import { Plot2D } from '@/components/experiments/plot-2d';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatUnit } from '@/lib/utils';
import type { Spectrum } from '@/types';

interface SpectrumAnalyzerProps {
  spectrum: Spectrum | null | undefined;
  busy?: boolean;
  subtitle?: string;
  height?: number;
  /** Second trace, e.g. the filtered output overlaid on the input. */
  overlay?: { spectrum: Spectrum; label: string; color?: string };
  label?: string;
}

/**
 * Frequency-domain screen.
 *
 * Linear magnitude is the default because it is the view where a student can
 * read "1" and "0.5" straight off the two raies of the TP; the dB view is one
 * tab away for the filtering lab, where 60 dB of dynamic range is the point.
 */
export function SpectrumAnalyzer({
  spectrum,
  busy,
  subtitle,
  height = 280,
  overlay,
  label = 'Spectre',
}: SpectrumAnalyzerProps) {
  const markers = React.useMemo(
    () =>
      (spectrum?.peaks ?? []).slice(0, 6).map((peak) => ({
        x: peak.frequency,
        label: formatUnit(peak.frequency, 'Hz', 3),
      })),
    [spectrum],
  );

  if (!spectrum) {
    return (
      <Instrument title="Analyseur de spectre" subtitle={subtitle} busy={busy}>
        <div className="flex h-[280px] items-center justify-center text-sm text-ink-400">
          Aucune acquisition.
        </div>
      </Instrument>
    );
  }

  const linear = [
    {
      x: spectrum.frequencies,
      y: spectrum.magnitude,
      color: '#18181b',
      label,
    },
    ...(overlay
      ? [
          {
            x: overlay.spectrum.frequencies,
            y: overlay.spectrum.magnitude,
            color: overlay.color ?? '#e9c21f',
            label: overlay.label,
          },
        ]
      : []),
  ];

  const decibels = [
    {
      x: spectrum.frequencies,
      y: spectrum.magnitude_db,
      color: '#18181b',
      label,
    },
    ...(overlay
      ? [
          {
            x: overlay.spectrum.frequencies,
            y: overlay.spectrum.magnitude_db,
            color: overlay.color ?? '#e9c21f',
            label: overlay.label,
          },
        ]
      : []),
  ];

  return (
    <Instrument
      title="Analyseur de spectre"
      subtitle={subtitle}
      busy={busy}
      status="Domaine fréquentiel"
    >
      <Tabs defaultValue="linear">
        <TabsList>
          <TabsTrigger value="linear">Amplitude</TabsTrigger>
          <TabsTrigger value="db">dB</TabsTrigger>
        </TabsList>
        <TabsContent value="linear">
          <Plot2D
            series={linear}
            height={height}
            markers={markers}
            xLabel="fréquence (Hz)"
            yLabel="amplitude"
            xFormat={(v) => formatUnit(v, 'Hz', 3)}
            ariaLabel="Spectre en amplitude"
          />
        </TabsContent>
        <TabsContent value="db">
          <Plot2D
            series={decibels}
            height={height}
            markers={markers}
            yDomain={[-90, 10]}
            xLabel="fréquence (Hz)"
            yLabel="gain (dB)"
            xFormat={(v) => formatUnit(v, 'Hz', 3)}
            ariaLabel="Spectre en décibels"
          />
        </TabsContent>
      </Tabs>

      <div className="mt-3">
        <ReadoutGrid>
          <Readout
            label="Résolution"
            value={formatUnit(spectrum.resolution, 'Hz')}
            hint="df = 1 / T"
          />
          <Readout label="Nyquist" value={formatUnit(spectrum.nyquist, 'Hz')} />
          {spectrum.peaks.slice(0, 2).map((peak, index) => (
            <Readout
              key={peak.frequency}
              label={`Raie ${index + 1}`}
              value={formatUnit(peak.frequency, 'Hz')}
              hint={`amplitude ${peak.magnitude.toFixed(3)}`}
              tone="accent"
            />
          ))}
        </ReadoutGrid>
      </div>
    </Instrument>
  );
}
