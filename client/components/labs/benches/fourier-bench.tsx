'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { Instrument, Readout, ReadoutGrid } from '@/components/experiments/instrument';
import { Choice, ControlPanel, Knob } from '@/components/experiments/knob';
import { Plot2D } from '@/components/experiments/plot-2d';
import { Badge } from '@/components/ui/badge';
import { num, str } from '@/features/experiments/use-experiment';
import { formatUnit } from '@/lib/utils';
import { signalService } from '@/services/signals';

import type { BenchProps } from './types';

const WAVEFORMS = [
  { value: 'square', label: 'Carré' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Dent de scie' },
];

/**
 * Lab 02 - Fourier series.
 *
 * The whole point is the *superposition*: the target waveform stays on screen
 * while the student adds harmonics one at a time and watches the reconstruction
 * climb onto it. The formula is revealed only after validation.
 */
export function FourierBench({ parameters, setParameter }: BenchProps) {
  const signalType = str(parameters, 'signal_type', 'square');
  const amplitude = num(parameters, 'amplitude', 1);
  const frequency = num(parameters, 'frequency', 1000);
  const nHarmonics = Math.round(num(parameters, 'n_harmonics', 1));

  const query = useQuery({
    queryKey: ['harmonics', signalType, amplitude, frequency],
    queryFn: () =>
      signalService.harmonics({
        signal_type: signalType,
        amplitude,
        frequency,
        // Always compute the full set: moving the harmonic knob then only
        // re-slices data already in the browser, which is instant.
        n_harmonics: 31,
        cumulative: true,
        sample_rate: 200_000,
      }),
    placeholderData: (previous) => previous,
  });

  const data = query.data;

  // Highest partial sum at or below the requested order.
  const partial = React.useMemo(() => {
    if (!data) return null;
    const eligible = data.partial_sums.filter((p) => p.up_to_order <= nHarmonics);
    return eligible.length ? eligible[eligible.length - 1] : null;
  }, [data, nHarmonics]);

  const activeHarmonics = (data?.harmonics ?? []).filter((h) => h.order <= nHarmonics);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] [&>*]:min-w-0">
        <Instrument
          title="Oscilloscope — reconstruction"
          subtitle={`${activeHarmonics.length} harmonique${activeHarmonics.length > 1 ? 's' : ''} active${activeHarmonics.length > 1 ? 's' : ''}`}
          busy={query.isFetching}
          status={partial ? `MSE ${partial.mse.toExponential(2)}` : undefined}
        >
          <Plot2D
            height={300}
            series={
              data
                ? [
                    {
                      x: data.t,
                      y: data.target,
                      color: '#b9b9c1',
                      dashed: true,
                      width: 1.5,
                      label: 'onde cible',
                    },
                    ...(partial
                      ? [
                          {
                            x: data.t,
                            y: partial.y,
                            color: '#18181b',
                            width: 2,
                            label: `somme jusqu'à n = ${partial.up_to_order}`,
                          },
                        ]
                      : []),
                  ]
                : []
            }
            xLabel="temps (s)"
            yLabel="amplitude"
            xFormat={(v) => formatUnit(v, 's', 3)}
            ariaLabel="Reconstruction du signal par ses harmoniques"
          />
          <div className="mt-3">
            <ReadoutGrid>
              <Readout
                label="Harmoniques"
                value={`${activeHarmonics.length}`}
                hint={`jusqu'à n = ${partial?.up_to_order ?? 0}`}
              />
              <Readout
                label="Erreur quadratique"
                value={partial ? partial.mse.toExponential(2) : '-'}
                tone={partial && partial.mse < 0.05 ? 'success' : 'default'}
                hint="doit diminuer"
              />
              <Readout label="Fondamentale" value={formatUnit(frequency, 'Hz')} />
              <Readout
                label="Amplitude n=1"
                value={activeHarmonics[0]?.amplitude.toFixed(3) ?? '-'}
                tone="accent"
              />
            </ReadoutGrid>
          </div>
        </Instrument>

        <ControlPanel title="Synthèse">
          <Choice
            id="fourier-waveform"
            label="Onde cible"
            value={signalType}
            options={WAVEFORMS}
            onChange={(value) => setParameter('signal_type', value)}
          />
          <Knob
            id="fourier-frequency"
            label="Fréquence"
            unit="Hz"
            log
            value={frequency}
            min={100}
            max={10_000}
            onChange={(value) => setParameter('frequency', value)}
          />
          <Knob
            id="fourier-harmonics"
            label="Harmoniques activées"
            value={nHarmonics}
            min={1}
            max={31}
            step={2}
            hint="les harmoniques paires d'un carré sont nulles"
            onChange={(value) => setParameter('n_harmonics', value)}
          />
        </ControlPanel>
      </div>

      <Instrument title="Spectre des harmoniques" subtitle="amplitude 4A / (n·π) pour un carré">
        <Plot2D
          height={200}
          series={[
            {
              x: activeHarmonics.map((h) => h.order * frequency),
              y: activeHarmonics.map((h) => Math.abs(h.amplitude)),
              color: '#e9c21f',
              style: 'stems',
              label: 'harmoniques actives',
            },
          ]}
          xDomain={[0, 33 * frequency]}
          xLabel="fréquence (Hz)"
          yLabel="amplitude"
          xFormat={(v) => formatUnit(v, 'Hz', 3)}
          ariaLabel="Raies des harmoniques actives"
        />
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {activeHarmonics.map((harmonic) => (
            <li key={harmonic.order}>
              <Badge variant="accent">
                n={harmonic.order} · {harmonic.amplitude.toFixed(3)}
              </Badge>
            </li>
          ))}
        </ul>
      </Instrument>
    </div>
  );
}
