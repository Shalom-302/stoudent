'use client';

import { useQuery } from '@tanstack/react-query';

import { Instrument, Readout, ReadoutGrid } from '@/components/experiments/instrument';
import { Choice, ControlPanel, Knob } from '@/components/experiments/knob';
import { Plot2D } from '@/components/experiments/plot-2d';
import { SpectrumAnalyzer } from '@/components/experiments/spectrum-analyzer';
import { num, str } from '@/features/experiments/use-experiment';
import { formatUnit } from '@/lib/utils';
import { signalService } from '@/services/signals';

import type { BenchProps } from './types';

const FILTERS = [
  { value: 'low_pass', label: 'Passe-bas' },
  { value: 'high_pass', label: 'Passe-haut' },
  { value: 'band_pass', label: 'Passe-bande' },
  { value: 'band_stop', label: 'Réjecteur' },
];

const FAMILIES = [
  { value: 'butter', label: 'Butterworth' },
  { value: 'cheby1', label: 'Tchebychev I' },
  { value: 'cheby2', label: 'Tchebychev II' },
  { value: 'bessel', label: 'Bessel' },
];

const SOURCES = [
  { value: 'square', label: 'Carré' },
  { value: 'sine', label: 'Sinusoïde' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Dent de scie' },
];

/** Lab 05 - the filter bench: in/out traces, both spectra and the Bode plot. */
export function FilterBench({ parameters, setParameter }: BenchProps) {
  const filterType = str(parameters, 'filter_type', 'low_pass');
  const family = str(parameters, 'family', 'butter');
  const cutoff = num(parameters, 'cutoff', 2000);
  const cutoffHigh = num(parameters, 'cutoff_high', 6000);
  const order = Math.round(num(parameters, 'order', 4));
  const signalType = str(parameters, 'signal_type', 'square');
  const frequency = num(parameters, 'frequency', 1000);
  const amplitude = num(parameters, 'amplitude', 1);

  const isBand = filterType === 'band_pass' || filterType === 'band_stop';

  const query = useQuery({
    queryKey: [
      'filter',
      filterType,
      family,
      cutoff,
      cutoffHigh,
      order,
      signalType,
      frequency,
      amplitude,
      isBand,
    ],
    queryFn: () =>
      signalService.filter({
        filter_type: filterType,
        family,
        cutoff,
        cutoff_high: isBand ? Math.max(cutoffHigh, cutoff * 1.1) : null,
        order,
        signal_type: signalType,
        frequency,
        amplitude,
        duration: 0.02,
        sample_rate: 200_000,
      }),
    placeholderData: (previous) => previous,
  });

  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Instrument
            title="Oscilloscope — entrée / sortie"
            subtitle="le filtre agit sur le spectre : c’est le spectre qui change la forme"
            busy={query.isFetching}
            status={data ? `${data.global_attenuation_db.toFixed(1)} dB` : undefined}
          >
            <Plot2D
              height={260}
              series={
                data
                  ? [
                      {
                        x: data.t,
                        y: data.input,
                        color: '#b9b9c1',
                        width: 1.5,
                        label: 'entrée',
                      },
                      { x: data.t, y: data.output, color: '#18181b', width: 2, label: 'sortie' },
                    ]
                  : []
              }
              xLabel="temps (s)"
              yLabel="amplitude"
              xFormat={(v) => formatUnit(v, 's', 3)}
              ariaLabel="Signal avant et après filtrage"
            />
            {data && (
              <div className="mt-3">
                <ReadoutGrid>
                  <Readout label="Vpp entrée" value={formatUnit(data.input_metrics.peak_to_peak, 'V')} />
                  <Readout label="Vpp sortie" value={formatUnit(data.output_metrics.peak_to_peak, 'V')} />
                  <Readout
                    label="RMS sortie"
                    value={formatUnit(data.output_metrics.rms, 'V')}
                  />
                  <Readout
                    label="Pente théorique"
                    value={`${-20 * order} dB/décade`}
                    tone="accent"
                    hint={`ordre ${order}`}
                  />
                </ReadoutGrid>
              </div>
            )}
          </Instrument>

          <Instrument
            title="Réponse en fréquence (Bode)"
            subtitle="gain du filtre seul — comparez avec le spectre de sortie"
          >
            <Plot2D
              height={200}
              series={
                data
                  ? [
                      {
                        x: data.response.frequencies,
                        y: data.response.gain_db,
                        color: '#e9c21f',
                        width: 2,
                        label: '|H(f)| (dB)',
                      },
                    ]
                  : []
              }
              yDomain={[-100, 10]}
              xLabel="fréquence (Hz)"
              yLabel="gain (dB)"
              xFormat={(v) => formatUnit(v, 'Hz', 3)}
              markers={[
                { x: cutoff, label: 'fc' },
                ...(isBand ? [{ x: cutoffHigh, label: 'fc2' }] : []),
              ]}
              ariaLabel="Réponse en fréquence du filtre"
            />
          </Instrument>

          <SpectrumAnalyzer
            spectrum={data?.input_spectrum}
            overlay={
              data ? { spectrum: data.output_spectrum, label: 'sortie', color: '#e9c21f' } : undefined
            }
            busy={query.isFetching}
            subtitle="entrée en noir, sortie en jaune"
            height={220}
            label="entrée"
          />
        </div>

        <ControlPanel title="Banc de filtrage">
          <Choice
            id="filter-type"
            label="Type de filtre"
            value={filterType}
            options={FILTERS}
            onChange={(value) => setParameter('filter_type', value)}
          />
          <Choice
            id="filter-family"
            label="Famille"
            value={family}
            options={FAMILIES}
            onChange={(value) => setParameter('family', value)}
          />
          <Knob
            id="filter-cutoff"
            label={isBand ? 'Coupure basse' : 'Fréquence de coupure'}
            unit="Hz"
            log
            value={cutoff}
            min={100}
            max={50_000}
            onChange={(value) => setParameter('cutoff', value)}
          />
          {isBand && (
            <Knob
              id="filter-cutoff-high"
              label="Coupure haute"
              unit="Hz"
              log
              value={cutoffHigh}
              min={200}
              max={90_000}
              onChange={(value) => setParameter('cutoff_high', value)}
            />
          )}
          <Knob
            id="filter-order"
            label="Ordre"
            value={order}
            min={1}
            max={8}
            step={1}
            hint="-20n dB par décade"
            onChange={(value) => setParameter('order', value)}
          />

          <div className="border-t border-ink-200 pt-4">
            <Choice
              id="filter-source"
              label="Signal d’entrée"
              value={signalType}
              options={SOURCES}
              onChange={(value) => setParameter('signal_type', value)}
            />
            <div className="mt-4">
              <Knob
                id="filter-frequency"
                label="Fréquence"
                unit="Hz"
                log
                value={frequency}
                min={50}
                max={20_000}
                onChange={(value) => setParameter('frequency', value)}
              />
            </div>
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
