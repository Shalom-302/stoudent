"""Labs 02 & 03 - Fourier series and Fourier transform."""
from __future__ import annotations

import numpy as np

from backend.common.enums import SignalType, WindowType
from backend.services._numeric import decimate, signal_metrics, time_base, to_list
from backend.services.signal_service import signal_service

_WINDOWS = {
    WindowType.hann.value: np.hanning,
    WindowType.hamming.value: np.hamming,
    WindowType.blackman.value: np.blackman,
}


class FourierService:
    """Harmonic decomposition, reconstruction and FFT.

    The pedagogical order of the fiche technique is respected here: the service
    can return the *partial* reconstructions (harmonic 1, then 1+3, then
    1+3+5...) so the student watches the square wave appear before ever seeing
    the ``(4A/pi)`` formula.
    """

    # -- Fourier series -----------------------------------------------------

    @staticmethod
    def series_coefficients(
        signal_type: str, amplitude: float, n_harmonics: int
    ) -> list[dict]:
        """Analytic coefficients of the classic odd waveforms.

        Returned as a list of ``{order, frequency_ratio, amplitude, phase}``
        so the frontend can label each slider with its own harmonic.
        """
        harmonics: list[dict] = []
        for n in range(1, n_harmonics + 1):
            match signal_type:
                case SignalType.square.value:
                    # Odd harmonics only, amplitude 4A / (n*pi).
                    if n % 2 == 0:
                        continue
                    coefficient = 4 * amplitude / (np.pi * n)
                    phase = 0.0
                case SignalType.triangle.value:
                    if n % 2 == 0:
                        continue
                    coefficient = 8 * amplitude / (np.pi**2 * n**2)
                    # Alternating sign, expressed as a pi phase shift.
                    phase = 0.0 if ((n - 1) // 2) % 2 == 0 else np.pi
                case SignalType.sawtooth.value:
                    coefficient = 2 * amplitude / (np.pi * n)
                    phase = 0.0 if n % 2 == 1 else np.pi
                case _:  # a pure sine is its own first harmonic
                    if n != 1:
                        continue
                    coefficient = amplitude
                    phase = 0.0
            harmonics.append(
                {
                    'order': n,
                    'frequency_ratio': n,
                    'amplitude': round(float(coefficient), 6),
                    'phase': round(float(phase), 6),
                }
            )
        return harmonics

    def compute_harmonics(
        self,
        signal_type: str = SignalType.square.value,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        n_harmonics: int = 9,
        duration: float | None = None,
        sample_rate: float = 200_000.0,
        cumulative: bool = True,
    ) -> dict:
        """Harmonics plus the target waveform and its reconstructions.

        With ``cumulative=True`` the response carries one trace per partial
        sum, which is the whole point of the TP: the student toggles harmonics
        1, 3, 5, 7 and sees convergence, Gibbs overshoot included.
        """
        duration = duration if duration else 2.0 / frequency
        t = time_base(duration, sample_rate)
        target = signal_service.waveform(t, signal_type, amplitude, frequency)
        harmonics = self.series_coefficients(signal_type, amplitude, n_harmonics)

        partial = np.zeros_like(t)
        traces: list[dict] = []
        for harmonic in harmonics:
            component = harmonic['amplitude'] * np.sin(
                2 * np.pi * harmonic['frequency_ratio'] * frequency * t + harmonic['phase']
            )
            partial = partial + component
            if cumulative:
                _, partial_view = decimate(t, partial)
                traces.append(
                    {
                        'up_to_order': harmonic['order'],
                        'y': to_list(partial_view),
                        # Mean-square error against the ideal waveform: the
                        # number that must go down as harmonics are added.
                        'mse': round(float(np.mean((partial - target) ** 2)), 8),
                    }
                )

        t_view, target_view, partial_view = decimate(t, target, partial)
        return {
            'signal_type': signal_type,
            'frequency': frequency,
            'amplitude': amplitude,
            'n_harmonics': n_harmonics,
            'harmonics': harmonics,
            't': to_list(t_view, decimals=9),
            'target': to_list(target_view),
            'reconstruction': to_list(partial_view),
            'partial_sums': traces,
            'mse': round(float(np.mean((partial - target) ** 2)), 8),
        }

    def reconstruct_signal(
        self,
        harmonics: list[dict],
        frequency: float = 1000.0,
        duration: float | None = None,
        sample_rate: float = 200_000.0,
    ) -> dict:
        """Rebuild a waveform from the harmonics the student enabled."""
        duration = duration if duration else 2.0 / frequency
        t = time_base(duration, sample_rate)
        y = np.zeros_like(t)
        for harmonic in harmonics:
            if not harmonic.get('enabled', True):
                continue
            order = int(harmonic.get('order', 1))
            amp = float(harmonic.get('amplitude', 0.0))
            phase = float(harmonic.get('phase', 0.0))
            y = y + amp * np.sin(2 * np.pi * order * frequency * t + phase)

        t_view, y_view = decimate(t, y)
        return {
            'frequency': frequency,
            'harmonics': harmonics,
            't': to_list(t_view, decimals=9),
            'y': to_list(y_view),
            'metrics': signal_metrics(y),
        }

    # -- Fourier transform --------------------------------------------------

    @staticmethod
    def compute_fft(
        y: np.ndarray,
        sample_rate: float,
        window: str = WindowType.none.value,
        max_frequency: float | None = None,
        db_floor: float = -120.0,
    ) -> dict:
        """One-sided amplitude spectrum of ``y``.

        Normalisation is chosen so a pure sine of amplitude A reads exactly A
        on the spectrum analyzer - anything else confuses students far more
        than it teaches them about scaling conventions.
        """
        y = np.asarray(y, dtype=float)
        n = len(y)
        window_fn = _WINDOWS.get(window)
        if window_fn is not None:
            w = window_fn(n)
            # Coherent gain compensation keeps peak heights readable.
            y = y * w / (np.mean(w) if np.mean(w) else 1.0)

        spectrum = np.fft.rfft(y)
        freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)
        magnitude = np.abs(spectrum) * 2.0 / n
        if len(magnitude):
            magnitude[0] = np.abs(spectrum[0]) / n  # DC is not mirrored
        phase = np.angle(spectrum)
        # Phase is meaningless where there is no energy; zero it to avoid a
        # noisy phase plot that students read as a real phenomenon.
        if magnitude.size:
            phase = np.where(magnitude > magnitude.max() * 1e-3, phase, 0.0)
        magnitude_db = 20 * np.log10(np.maximum(magnitude, 10 ** (db_floor / 20)))

        if max_frequency:
            keep = freqs <= max_frequency
            freqs, magnitude, phase, magnitude_db = (
                freqs[keep],
                magnitude[keep],
                phase[keep],
                magnitude_db[keep],
            )

        f_view, m_view, p_view, db_view = decimate(freqs, magnitude, phase, magnitude_db)
        return {
            'sample_rate': sample_rate,
            'window': window,
            'resolution': round(float(sample_rate / n), 6),
            'nyquist': round(float(sample_rate / 2), 6),
            'frequencies': to_list(f_view, decimals=4),
            'magnitude': to_list(m_view),
            'magnitude_db': to_list(db_view, decimals=3),
            'phase': to_list(p_view),
            'peaks': FourierService.find_peaks(freqs, magnitude),
        }

    @staticmethod
    def find_peaks(
        freqs: np.ndarray, magnitude: np.ndarray, relative_threshold: float = 0.05, limit: int = 12
    ) -> list[dict]:
        """Spectral lines worth labelling on the analyzer display."""
        from scipy.signal import find_peaks as _find_peaks

        magnitude = np.asarray(magnitude, dtype=float)
        if magnitude.size == 0 or magnitude.max() <= 0:
            return []
        indices, _ = _find_peaks(magnitude, height=magnitude.max() * relative_threshold)
        ordered = sorted(indices, key=lambda i: magnitude[i], reverse=True)[:limit]
        return [
            {
                'frequency': round(float(freqs[i]), 4),
                'magnitude': round(float(magnitude[i]), 6),
            }
            for i in sorted(ordered, key=lambda i: freqs[i])
        ]

    def analyze(
        self,
        components: list[dict] | None = None,
        signal_type: str = SignalType.sine.value,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        duration: float = 0.02,
        sample_rate: float = 200_000.0,
        window: str = WindowType.none.value,
        max_frequency: float | None = None,
        noise_snr_db: float | None = None,
        seed: int | None = None,
    ) -> dict:
        """Time trace + spectrum in one call: the two oscilloscope screens."""
        if components:
            time_domain = signal_service.mix(
                components, duration=duration, sample_rate=sample_rate,
                noise_snr_db=noise_snr_db, seed=seed,
            )
            t = time_base(duration, sample_rate)
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
            if noise_snr_db is not None:
                y = signal_service.add_noise(y, noise_snr_db, seed=seed)
        else:
            time_domain = signal_service.generate(
                signal_type=signal_type, amplitude=amplitude, frequency=frequency,
                duration=duration, sample_rate=sample_rate,
                noise_snr_db=noise_snr_db, seed=seed,
            )
            t = time_base(duration, sample_rate)
            y = signal_service.waveform(t, signal_type, amplitude, frequency)
            if noise_snr_db is not None:
                y = signal_service.add_noise(y, noise_snr_db, seed=seed)

        return {
            'time_domain': time_domain,
            'spectrum': self.compute_fft(
                y, sample_rate=sample_rate, window=window, max_frequency=max_frequency
            ),
        }


fourier_service = FourierService()
