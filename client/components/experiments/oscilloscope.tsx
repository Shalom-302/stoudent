'use client';

import { Instrument, Readout, ReadoutGrid } from '@/components/experiments/instrument';
import { Plot2D, type PlotSeries } from '@/components/experiments/plot-2d';
import { formatUnit } from '@/lib/utils';
import type { SignalMetrics } from '@/types';

interface OscilloscopeProps {
  series: PlotSeries[];
  metrics?: SignalMetrics | null;
  subtitle?: string;
  busy?: boolean;
  height?: number;
  yDomain?: [number, number];
  extraReadouts?: React.ReactNode;
}

/** Time-domain screen. Axis in seconds, auto-scaled with engineering prefixes. */
export function Oscilloscope({
  series,
  metrics,
  subtitle,
  busy,
  height = 280,
  yDomain,
  extraReadouts,
}: OscilloscopeProps) {
  return (
    <Instrument title="Oscilloscope" subtitle={subtitle} busy={busy} status="Domaine temporel">
      <Plot2D
        series={series}
        height={height}
        yDomain={yDomain}
        xLabel="temps (s)"
        yLabel="amplitude"
        xFormat={(v) => formatUnit(v, 's', 3)}
        ariaLabel="Trace temporelle du signal"
      />
      {(metrics || extraReadouts) && (
        <div className="mt-3">
          <ReadoutGrid>
            {metrics && (
              <>
                <Readout label="Vmax" value={formatUnit(metrics.max, 'V')} />
                <Readout label="Vmin" value={formatUnit(metrics.min, 'V')} />
                <Readout label="Vpp" value={formatUnit(metrics.peak_to_peak, 'V')} />
                <Readout label="Veff (RMS)" value={formatUnit(metrics.rms, 'V')} />
              </>
            )}
            {extraReadouts}
          </ReadoutGrid>
        </div>
      )}
    </Instrument>
  );
}
