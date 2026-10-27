"""Lab 05 - filtering: low-pass, high-pass, band-pass, band-stop."""
from __future__ import annotations

import numpy as np
from scipy import signal as sps

from backend.common.enums import FilterType, SignalType
from backend.services._numeric import decimate, signal_metrics, time_base, to_list
from backend.services.fourier_service import fourier_service
from backend.services.signal_service import signal_service


class FilterService:
    """IIR filter design and application.

    Filters are built as second-order sections (``sos``) rather than transfer
    function coefficients: at the orders and cut-offs students will try, the
    ``b, a`` form goes numerically unstable and produces garbage traces that
    look like a physics result.
    """

    @staticmethod
    def design(
        filter_type: str,
        cutoff: float | tuple[float, float],
        sample_rate: float,
        order: int = 4,
        family: str = 'butter',
    ) -> np.ndarray:
        """Return the SOS matrix for the requested filter."""
        nyquist = sample_rate / 2
        match filter_type:
            case FilterType.low_pass.value:
                wn = min(float(cutoff) / nyquist, 0.999)
                btype = 'lowpass'
            case FilterType.high_pass.value:
                wn = min(float(cutoff) / nyquist, 0.999)
                btype = 'highpass'
            case FilterType.band_pass.value | FilterType.band_stop.value:
                low, high = cutoff  # type: ignore[misc]
                wn = [min(float(low) / nyquist, 0.998), min(float(high) / nyquist, 0.999)]
                btype = 'bandpass' if filter_type == FilterType.band_pass.value else 'bandstop'
            case _:
                raise ValueError(f'Unsupported filter type: {filter_type}')

        return sps.iirfilter(
            N=order, Wn=wn, btype=btype, ftype=family, output='sos'
        )

    @staticmethod
    def apply(sos: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Single-pass filtering, started from steady state.

        A single pass is what the Bode plot next to the trace describes: the TP
        asks the student to predict -3 dB at the cut-off and -20n dB/decade
        beyond it, and ``filtfilt`` would silently deliver twice that. The
        initial conditions are set from the first sample so the trace does not
        open on a start-up transient that is an artifact of t = 0, not physics.
        """
        y = np.asarray(y, dtype=float)
        if y.size == 0:
            return y
        zi = sps.sosfilt_zi(sos) * y[0]
        filtered, _ = sps.sosfilt(sos, y, zi=zi)
        return filtered

    @staticmethod
    def frequency_response(
        sos: np.ndarray, sample_rate: float, points: int = 1024
    ) -> dict:
        """Bode data for the filter panel: gain in dB and phase in degrees."""
        w, h = sps.sosfreqz(sos, worN=points, fs=sample_rate)
        magnitude = np.abs(h)
        return {
            'frequencies': to_list(w, decimals=4),
            'gain_db': to_list(20 * np.log10(np.maximum(magnitude, 1e-12)), decimals=3),
            'gain': to_list(magnitude),
            'phase_deg': to_list(np.degrees(np.unwrap(np.angle(h))), decimals=3),
        }

    def low_pass(self, y, cutoff, sample_rate, order=4):
        return self.apply(self.design(FilterType.low_pass.value, cutoff, sample_rate, order), y)

    def high_pass(self, y, cutoff, sample_rate, order=4):
        return self.apply(self.design(FilterType.high_pass.value, cutoff, sample_rate, order), y)

    def band_pass(self, y, low, high, sample_rate, order=4):
        sos = self.design(FilterType.band_pass.value, (low, high), sample_rate, order)
        return self.apply(sos, y)

    def band_stop(self, y, low, high, sample_rate, order=4):
        sos = self.design(FilterType.band_stop.value, (low, high), sample_rate, order)
        return self.apply(sos, y)

    def filter_signal(
        self,
        filter_type: str = FilterType.low_pass.value,
        cutoff: float = 2000.0,
        cutoff_high: float | None = None,
        order: int = 4,
        family: str = 'butter',
        components: list[dict] | None = None,
        signal_type: str = SignalType.square.value,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        duration: float = 0.02,
        sample_rate: float = 200_000.0,
        noise_snr_db: float | None = None,
        seed: int | None = None,
    ) -> dict:
        """Before/after traces, both spectra, and the filter's Bode plot."""
        t = time_base(duration, sample_rate)
        if components:
            y = np.zeros_like(t)
            for component in components:
                y = y + signal_service.waveform(
                    t,
                    signal_type=component.get('signal_type', SignalType.sine.value),
                    amplitude=float(component.get('amplitude', 1.0)),
                    frequency=float(component.get('frequency', 1000.0)),
                    phase=float(component.get('phase', 0.0)),
                    offset=float(component.get('offset', 0.0)),
                    duty=float(component.get('duty', 0.5)),
                )
        else:
            y = signal_service.waveform(t, signal_type, amplitude, frequency)
        if noise_snr_db is not None:
            y = signal_service.add_noise(y, noise_snr_db, seed=seed)

        band = filter_type in (FilterType.band_pass.value, FilterType.band_stop.value)
        cutoff_arg = (cutoff, cutoff_high or cutoff * 2) if band else cutoff
        sos = self.design(filter_type, cutoff_arg, sample_rate, order, family)
        filtered = self.apply(sos, y)

        t_view, y_view, f_view = decimate(t, y, filtered)
        attenuation = (
            20 * np.log10(max(float(np.std(filtered)), 1e-12) / max(float(np.std(y)), 1e-12))
        )
        return {
            'filter': {
                'type': filter_type,
                'family': family,
                'order': order,
                'cutoff': cutoff,
                'cutoff_high': cutoff_high if band else None,
                'sample_rate': sample_rate,
            },
            't': to_list(t_view, decimals=9),
            'input': to_list(y_view),
            'output': to_list(f_view),
            'input_metrics': signal_metrics(y),
            'output_metrics': signal_metrics(filtered),
            'global_attenuation_db': round(float(attenuation), 3),
            'input_spectrum': fourier_service.compute_fft(y, sample_rate),
            'output_spectrum': fourier_service.compute_fft(filtered, sample_rate),
            'response': self.frequency_response(sos, sample_rate),
        }


filter_service = FilterService()
