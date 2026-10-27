'use client';

import { useQuery } from '@tanstack/react-query';

import { Choice, ControlPanel, Knob } from '@/components/experiments/knob';
import { Oscilloscope } from '@/components/experiments/oscilloscope';
import { Readout } from '@/components/experiments/instrument';
import { signalService } from '@/services/signals';
import { formatUnit } from '@/lib/utils';
import type { BenchProps } from './types';
import { num, str } from '@/features/experiments/use-experiment';

const WAVEFORMS = [
  { value: 'sine', label: 'Sinusoïde' },
  { value: 'square', label: 'Carré' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Dent de scie' },
  { value: 'impulse', label: 'Impulsion' },
  { value: 'step', label: 'Échelon' },
];

/** Lab 01 - the function generator and its oscilloscope. */
export function SignalsBench({ parameters, setParameter }: BenchProps) {
  const signalType = str(parameters, 'signal_type', 'sine');
  const amplitude = num(parameters, 'amplitude', 1);
  const frequency = num(parameters, 'frequency', 1000);
  const phase = num(parameters, 'phase', 0);
  const offset = num(parameters, 'offset', 0);

  // A fixed 5 ms window keeps the "count the periods" question meaningful:
  // an auto-scaling time base would always show the same number of periods.
  const duration = 0.005;
  const sampleRate = 200_000;

  const query = useQuery({
    queryKey: ['signal', signalType, amplitude, frequency, phase, offset],
    queryFn: () =>
      signalService.generate({
        signal_type: signalType,
        amplitude,
        frequency,
        phase,
        offset,
        duration,
        sample_rate: sampleRate,
      }),
    placeholderData: (previous) => previous,
  });

  const trace = query.data;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] [&>*]:min-w-0">
      <Oscilloscope
        subtitle={`Fenêtre ${formatUnit(duration, 's')} · ${formatUnit(sampleRate, 'éch/s')}`}
        busy={query.isFetching}
        metrics={trace?.metrics}
        series={
          trace
            ? [{ x: trace.t, y: trace.y, color: '#18181b', label: 'x(t)' }]
            : []
        }
        extraReadouts={
          trace?.period ? (
            <>
              <Readout
                label="Période"
                value={formatUnit(trace.period, 's')}
                hint="T = 1 / f"
                tone="accent"
              />
              <Readout
                label="Périodes visibles"
                value={(duration / trace.period).toFixed(1)}
              />
            </>
          ) : null
        }
      />

      <ControlPanel title="Générateur">
        <Choice
          id="signal-type"
          label="Forme d’onde"
          value={signalType}
          options={WAVEFORMS}
          onChange={(value) => setParameter('signal_type', value)}
        />
        <Knob
          id="amplitude"
          label="Amplitude"
          unit="V"
          value={amplitude}
          min={0.1}
          max={5}
          step={0.1}
          onChange={(value) => setParameter('amplitude', value)}
        />
        <Knob
          id="frequency"
          label="Fréquence"
          unit="Hz"
          log
          value={frequency}
          min={10}
          max={100_000}
          onChange={(value) => setParameter('frequency', value)}
        />
        <Knob
          id="phase"
          label="Phase"
          value={phase}
          min={-Math.PI}
          max={Math.PI}
          step={0.05}
          hint="radians"
          onChange={(value) => setParameter('phase', value)}
        />
        <Knob
          id="offset"
          label="Offset"
          unit="V"
          value={offset}
          min={-2}
          max={2}
          step={0.1}
          onChange={(value) => setParameter('offset', value)}
        />
      </ControlPanel>
    </div>
  );
}
