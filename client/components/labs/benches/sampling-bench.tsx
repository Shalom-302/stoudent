'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Instrument, Readout, ReadoutGrid } from '@/components/experiments/instrument';
import { ControlPanel, Knob } from '@/components/experiments/knob';
import { Plot2D } from '@/components/experiments/plot-2d';
import { SpectrumAnalyzer } from '@/components/experiments/spectrum-analyzer';
import { num, str } from '@/features/experiments/use-experiment';
import { cn, formatUnit } from '@/lib/utils';
import { signalService } from '@/services/signals';

import type { BenchProps } from './types';

/**
 * Lab 04 - sampling and aliasing.
 *
 * Three traces on one screen: the analog signal, the samples actually taken,
 * and the sinc reconstruction built from those samples alone. When fs is too
 * low, the reconstruction visibly detaches from the original - which is the
 * whole demonstration.
 */
export function SamplingBench({ parameters, setParameter }: BenchProps) {
  const frequency = num(parameters, 'frequency', 5000);
  const samplingRate = num(parameters, 'sampling_rate', 6000);
  const amplitude = num(parameters, 'amplitude', 1);
  const signalType = str(parameters, 'signal_type', 'sine');
  const duration = num(parameters, 'duration', 0.002);

  const query = useQuery({
    queryKey: ['sampling', signalType, amplitude, frequency, samplingRate, duration],
    queryFn: () =>
      signalService.sample({
        signal_type: signalType,
        amplitude,
        frequency,
        sampling_rate: samplingRate,
        duration,
        reconstruct: true,
      }),
    placeholderData: (previous) => previous,
  });

  const data = query.data;
  const aliasing = data?.aliasing;

  return (
    <div className="space-y-4">
      {aliasing && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-[var(--radius-card)] border p-4',
            aliasing.is_aliased
              ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5'
              : 'border-[var(--color-success)]/40 bg-[var(--color-success)]/5',
          )}
        >
          {aliasing.is_aliased ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
          )}
          <div>
            <p className="text-sm font-medium text-ink-900">{aliasing.verdict}</p>
            <p className="mt-1 font-mono text-xs text-ink-500">
              {aliasing.criterion} → fe min = {formatUnit(aliasing.min_sampling_rate, 'Hz')}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Instrument
            title="Oscilloscope — échantillonnage"
            subtitle="signal analogique, échantillons, reconstruction par sinus cardinal"
            busy={query.isFetching}
            status={aliasing?.is_aliased ? 'Repliement' : 'Conforme'}
          >
            <Plot2D
              height={300}
              series={
                data
                  ? [
                      {
                        x: data.analog.t,
                        y: data.analog.y,
                        color: '#b9b9c1',
                        width: 1.5,
                        label: 'signal analogique',
                      },
                      ...(data.reconstructed
                        ? [
                            {
                              x: data.reconstructed.t,
                              y: data.reconstructed.y,
                              color: '#c0392b',
                              width: 2,
                              label: 'reconstruction',
                            },
                          ]
                        : []),
                      {
                        x: data.samples.t,
                        y: data.samples.y,
                        color: '#18181b',
                        style: 'stems',
                        label: 'échantillons',
                      },
                    ]
                  : []
              }
              xLabel="temps (s)"
              yLabel="amplitude"
              xFormat={(v) => formatUnit(v, 's', 3)}
              ariaLabel="Signal analogique, échantillons et reconstruction"
            />
            {aliasing && (
              <div className="mt-3">
                <ReadoutGrid>
                  <Readout
                    label="Fréquence signal"
                    value={formatUnit(aliasing.signal_frequency, 'Hz')}
                  />
                  <Readout
                    label="Fréquence Nyquist"
                    value={formatUnit(aliasing.nyquist_frequency, 'Hz')}
                    hint="fe / 2"
                  />
                  <Readout
                    label="Fréquence apparente"
                    value={formatUnit(aliasing.apparent_frequency, 'Hz')}
                    tone={aliasing.is_aliased ? 'danger' : 'success'}
                  />
                  <Readout label="Échantillons" value={`${data?.samples.count ?? 0}`} />
                </ReadoutGrid>
              </div>
            )}
          </Instrument>

          <SpectrumAnalyzer
            spectrum={data?.spectrum}
            busy={query.isFetching}
            subtitle="spectre des échantillons — la raie repliée apparaît ici"
            height={200}
            label="spectre échantillonné"
          />
        </div>

        <ControlPanel title="Banc d’échantillonnage">
          <Knob
            id="signal-frequency"
            label="Fréquence du signal"
            unit="Hz"
            log
            value={frequency}
            min={100}
            max={50_000}
            onChange={(value) => setParameter('frequency', value)}
          />
          <Knob
            id="sampling-rate"
            label="Fréquence d’échantillonnage"
            unit="Hz"
            log
            value={samplingRate}
            min={500}
            max={200_000}
            hint="critère : fe > 2 × fmax"
            onChange={(value) => setParameter('sampling_rate', value)}
          />
          <Knob
            id="sampling-duration"
            label="Fenêtre"
            unit="s"
            log
            value={duration}
            min={0.0005}
            max={0.02}
            onChange={(value) => setParameter('duration', value)}
          />
        </ControlPanel>
      </div>
    </div>
  );
}
