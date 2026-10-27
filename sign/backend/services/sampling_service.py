"""Lab 04 - sampling, Nyquist-Shannon and aliasing."""
from __future__ import annotations

import numpy as np

from backend.common.enums import SignalType
from backend.services._numeric import MAX_RENDER_POINTS, decimate, time_base, to_list
from backend.services.fourier_service import fourier_service
from backend.services.signal_service import signal_service


class SamplingService:
    """Sample a continuous signal and expose what Shannon predicts.

    The service deliberately returns both the "analog" reference trace and the
    sampled points: the aliasing lesson only lands when the student sees the
    reconstructed 1 kHz tone sitting on top of a 5 kHz original.
    """

    @staticmethod
    def alias_frequency(frequency: float, sampling_rate: float) -> float:
        """Apparent frequency after sampling (folding about Nyquist).

        Below Nyquist this returns ``frequency`` itself, which is exactly the
        result that makes the criterion feel earned rather than asserted.
        """
        if sampling_rate <= 0:
            return frequency
        folded = abs(frequency % sampling_rate)
        if folded > sampling_rate / 2:
            folded = sampling_rate - folded
        return folded

    def detect_aliasing(self, frequency: float, sampling_rate: float) -> dict:
        nyquist = sampling_rate / 2
        aliased = frequency > nyquist
        return {
            'sampling_rate': sampling_rate,
            'nyquist_frequency': round(nyquist, 6),
            'signal_frequency': frequency,
            'is_aliased': bool(aliased),
            'apparent_frequency': round(self.alias_frequency(frequency, sampling_rate), 6),
            'min_sampling_rate': round(2 * frequency, 6),
            'criterion': 'fs > 2 * fmax',
            'verdict': (
                'Aliasing: the sampling rate is below the Shannon criterion.'
                if aliased
                else 'Correct sampling: the criterion fs > 2 * fmax is satisfied.'
            ),
        }

    @staticmethod
    def reconstruct_signal(
        samples: np.ndarray, sampling_rate: float, t_dense: np.ndarray
    ) -> np.ndarray:
        """Whittaker-Shannon (cardinal sine) interpolation.

        This is the ideal reconstruction filter of the theory, computed
        directly rather than approximated, so the plotted curve *is* the
        formula the student is about to be shown.
        """
        samples = np.asarray(samples, dtype=float)
        n = len(samples)
        if n == 0:
            return np.zeros_like(t_dense)
        # Guard the O(n*m) outer product: a dense grid times many samples can
        # explode, so cap the reconstruction grid instead of the sample count.
        t_sample = np.arange(n) / sampling_rate
        matrix = np.sinc((t_dense[:, None] - t_sample[None, :]) * sampling_rate)
        return matrix @ samples

    def sample_signal(
        self,
        signal_type: str = SignalType.sine.value,
        amplitude: float = 1.0,
        frequency: float = 5000.0,
        phase: float = 0.0,
        sampling_rate: float = 6000.0,
        duration: float = 0.002,
        reconstruct: bool = True,
        analog_oversampling: int = 50,
    ) -> dict:
        """Full sampling experiment: analog trace, samples, reconstruction."""
        analog_rate = max(sampling_rate * analog_oversampling, frequency * 40)
        t_analog = time_base(duration, analog_rate)
        y_analog = signal_service.waveform(t_analog, signal_type, amplitude, frequency, phase)

        t_samples = time_base(duration, sampling_rate)
        y_samples = signal_service.waveform(t_samples, signal_type, amplitude, frequency, phase)

        result: dict = {
            'analog': {
                't': to_list(decimate(t_analog)[0], decimals=9),
                'y': to_list(decimate(t_analog, y_analog)[1]),
                'sample_rate': analog_rate,
            },
            'samples': {
                't': to_list(t_samples[:MAX_RENDER_POINTS], decimals=9),
                'y': to_list(y_samples[:MAX_RENDER_POINTS]),
                'sample_rate': sampling_rate,
                'count': int(len(t_samples)),
            },
            'aliasing': self.detect_aliasing(frequency, sampling_rate),
        }

        if reconstruct:
            # Cap both sides of the sinc matrix so the request stays bounded.
            t_dense = decimate(t_analog, max_points=1024)[0]
            used = y_samples[:2048]
            y_reconstructed = self.reconstruct_signal(used, sampling_rate, t_dense)
            result['reconstructed'] = {
                't': to_list(t_dense, decimals=9),
                'y': to_list(y_reconstructed),
            }
            apparent = result['aliasing']['apparent_frequency']
            result['reconstructed']['apparent_frequency'] = apparent

        # The spectrum makes the folding visible rather than merely stated.
        result['spectrum'] = fourier_service.compute_fft(y_samples, sampling_rate)
        return result


sampling_service = SamplingService()
