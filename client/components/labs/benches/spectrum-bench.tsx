'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Choice, ControlPanel, Knob } from '@/components/experiments/knob';
import { Oscilloscope } from '@/components/experiments/oscilloscope';
import { SpectrumAnalyzer } from '@/components/experiments/spectrum-analyzer';
import { Button } from '@/components/ui/button';
import { num, str } from '@/features/experiments/use-experiment';
import { formatUnit } from '@/lib/utils';
import { signalService, type SignalComponent } from '@/services/signals';

import type { BenchProps } from './types';

const WINDOWS = [
  { value: 'none', label: 'Aucune (rectangulaire)' },
  { value: 'hann', label: 'Hann' },
  { value: 'hamming', label: 'Hamming' },
  { value: 'blackman', label: 'Blackman' },
];

const DEFAULT_COMPONENTS: SignalComponent[] = [
  { signal_type: 'sine', frequency: 1000, amplitude: 1 },
  { signal_type: 'sine', frequency: 3000, amplitude: 0.5 },
];

/**
 * Lab 03 - the spectrum analyzer.
 *
 * Both screens are shown at once: the TP is precisely about the fact that the
 * same signal has two readings, and putting them side by side is the lesson.
 */
export function SpectrumBench({ parameters, setParameter }: BenchProps) {
  const components = React.useMemo<SignalComponent[]>(() => {
    const raw = parameters.components;
    if (Array.isArray(raw) && raw.length) return raw as SignalComponent[];
    return DEFAULT_COMPONENTS;
  }, [parameters.components]);

  const duration = num(parameters, 'duration', 0.02);
  const windowType = str(parameters, 'window', 'none');
  const maxFrequency = num(parameters, 'max_frequency', 8000);

  const query = useQuery({
    queryKey: ['fourier', components, duration, windowType, maxFrequency],
    queryFn: () =>
      signalService.fourier({
        components,
        duration,
        sample_rate: 200_000,
        window: windowType,
        max_frequency: maxFrequency,
      }),
    placeholderData: (previous) => previous,
  });

  const updateComponent = (index: number, patch: Partial<SignalComponent>) => {
    const next = components.map((component, i) =>
      i === index ? { ...component, ...patch } : component,
    );
    setParameter('components', next);
  };

  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Oscilloscope
            subtitle={`x(t) — fenêtre ${formatUnit(duration, 's')}`}
            busy={query.isFetching}
            metrics={data?.time_domain.metrics}
            height={220}
            series={
              data
                ? [
                    {
                      x: data.time_domain.t,
                      y: data.time_domain.y,
                      color: '#18181b',
                      label: 'x(t)',
                    },
                  ]
                : []
            }
          />
          <SpectrumAnalyzer
            spectrum={data?.spectrum}
            busy={query.isFetching}
            subtitle={`résolution df = 1 / T = ${data ? formatUnit(data.spectrum.resolution, 'Hz') : '—'}`}
            height={240}
            label="X(f)"
          />
        </div>

        <ControlPanel title="Signal composite">
          <div className="space-y-4">
            {components.map((component, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border border-ink-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-700">
                    Composante {index + 1}
                  </p>
                  {components.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Supprimer la composante ${index + 1}`}
                      onClick={() =>
                        setParameter(
                          'components',
                          components.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Knob
                  id={`component-${index}-frequency`}
                  label="Fréquence"
                  unit="Hz"
                  log
                  value={component.frequency ?? 1000}
                  min={50}
                  max={20_000}
                  onChange={(value) => updateComponent(index, { frequency: value })}
                />
                <Knob
                  id={`component-${index}-amplitude`}
                  label="Amplitude"
                  unit="V"
                  value={component.amplitude ?? 1}
                  min={0}
                  max={2}
                  step={0.05}
                  onChange={(value) => updateComponent(index, { amplitude: value })}
                />
              </div>
            ))}

            {components.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  setParameter('components', [
                    ...components,
                    { signal_type: 'sine', frequency: 5000, amplitude: 0.3 },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Ajouter une composante
              </Button>
            )}
          </div>

          <Knob
            id="acquisition-duration"
            label="Durée d’acquisition"
            unit="s"
            log
            value={duration}
            min={0.002}
            max={0.2}
            hint="plus longue = raies plus fines"
            onChange={(value) => setParameter('duration', value)}
          />
          <Knob
            id="max-frequency"
            label="Étendue affichée"
            unit="Hz"
            log
            value={maxFrequency}
            min={2000}
            max={50_000}
            onChange={(value) => setParameter('max_frequency', value)}
          />
          <Choice
            id="window"
            label="Fenêtre"
            value={windowType}
            options={WINDOWS}
            onChange={(value) => setParameter('window', value)}
          />
        </ControlPanel>
      </div>
    </div>
  );
}
