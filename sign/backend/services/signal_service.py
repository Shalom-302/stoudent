"""Lab 01 - elementary signals: the virtual function generator."""
from __future__ import annotations

import numpy as np
from scipy import signal as sps

from backend.common.enums import SignalType
from backend.services._numeric import decimate, signal_metrics, time_base, to_list


class SignalService:
    """Waveform generation, mixing and noise.

    Every generator takes the same physical parameters a bench generator
    exposes - amplitude, frequency, phase, offset - so the mapping between the
    3D knob and the maths stays obvious to the student.
    """

    @staticmethod
    def generate_sine(
        t: np.ndarray,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
    ) -> np.ndarray:
        return offset + amplitude * np.sin(2 * np.pi * frequency * t + phase)

    @staticmethod
    def generate_square(
        t: np.ndarray,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
        duty: float = 0.5,
    ) -> np.ndarray:
        return offset + amplitude * sps.square(2 * np.pi * frequency * t + phase, duty=duty)

    @staticmethod
    def generate_triangle(
        t: np.ndarray,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
    ) -> np.ndarray:
        # width=0.5 makes the sawtooth symmetric, i.e. a triangle wave.
        return offset + amplitude * sps.sawtooth(2 * np.pi * frequency * t + phase, width=0.5)

    @staticmethod
    def generate_sawtooth(
        t: np.ndarray,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
    ) -> np.ndarray:
        return offset + amplitude * sps.sawtooth(2 * np.pi * frequency * t + phase)

    @staticmethod
    def generate_impulse(t: np.ndarray, amplitude: float = 1.0, offset: float = 0.0) -> np.ndarray:
        """Discrete Dirac: a single non-zero sample at t = 0."""
        y = np.full_like(t, offset, dtype=float)
        y[0] += amplitude
        return y

    @staticmethod
    def generate_step(
        t: np.ndarray, amplitude: float = 1.0, offset: float = 0.0, delay: float = 0.0
    ) -> np.ndarray:
        """Heaviside step, the input used to read an RC response in lab 07."""
        return offset + amplitude * (t >= delay).astype(float)

    @staticmethod
    def generate_dc(t: np.ndarray, amplitude: float = 1.0, offset: float = 0.0) -> np.ndarray:
        return np.full_like(t, amplitude + offset, dtype=float)

    def waveform(
        self,
        t: np.ndarray,
        signal_type: str = SignalType.sine.value,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
        duty: float = 0.5,
    ) -> np.ndarray:
        """Dispatch on ``signal_type`` and return the raw samples."""
        match signal_type:
            case SignalType.sine.value:
                return self.generate_sine(t, amplitude, frequency, phase, offset)
            case SignalType.square.value:
                return self.generate_square(t, amplitude, frequency, phase, offset, duty)
            case SignalType.triangle.value:
                return self.generate_triangle(t, amplitude, frequency, phase, offset)
            case SignalType.sawtooth.value:
                return self.generate_sawtooth(t, amplitude, frequency, phase, offset)
            case SignalType.impulse.value:
                return self.generate_impulse(t, amplitude, offset)
            case SignalType.step.value:
                return self.generate_step(t, amplitude, offset)
            case SignalType.dc.value:
                return self.generate_dc(t, amplitude, offset)
            case _:
                return self.generate_sine(t, amplitude, frequency, phase, offset)

    @staticmethod
    def add_noise(y: np.ndarray, snr_db: float, seed: int | None = None) -> np.ndarray:
        """Add white Gaussian noise at the requested signal-to-noise ratio.

        ``seed`` is exposed so a graded experiment is reproducible: the same
        submission must always yield the same score.
        """
        y = np.asarray(y, dtype=float)
        signal_power = float(np.mean(np.square(y)))
        if signal_power <= 0:
            return y
        noise_power = signal_power / (10 ** (snr_db / 10))
        rng = np.random.default_rng(seed)
        return y + rng.normal(0.0, np.sqrt(noise_power), size=y.shape)

    def generate(
        self,
        signal_type: str = SignalType.sine.value,
        amplitude: float = 1.0,
        frequency: float = 1000.0,
        phase: float = 0.0,
        offset: float = 0.0,
        duty: float = 0.5,
        duration: float = 0.005,
        sample_rate: float = 200_000.0,
        noise_snr_db: float | None = None,
        seed: int | None = None,
    ) -> dict:
        """Full generator call as consumed by ``POST /signals/generate``."""
        t = time_base(duration, sample_rate)
        y = self.waveform(t, signal_type, amplitude, frequency, phase, offset, duty)
        if noise_snr_db is not None:
            y = self.add_noise(y, noise_snr_db, seed=seed)

        t_view, y_view = decimate(t, y)
        period = 1.0 / frequency if frequency > 0 else None
        return {
            'signal_type': signal_type,
            'sample_rate': sample_rate,
            'duration': duration,
            'points': int(len(t)),
            'period': round(period, 9) if period else None,
            'angular_frequency': round(2 * np.pi * frequency, 6),
            't': to_list(t_view, decimals=9),
            'y': to_list(y_view),
            'metrics': signal_metrics(y),
        }

    def mix(
        self,
        components: list[dict],
        duration: float = 0.005,
        sample_rate: float = 200_000.0,
        noise_snr_db: float | None = None,
        seed: int | None = None,
    ) -> dict:
        """Sum several waveforms - the input of the spectrum-analyzer TP.

        ``x(t) = sin(2*pi*1000t) + 0.5*sin(2*pi*3000t)`` is exactly this call
        with two sine components.
        """
        t = time_base(duration, sample_rate)
        y = np.zeros_like(t)
        for component in components:
            y = y + self.waveform(
                t,
                signal_type=component.get('signal_type', SignalType.sine.value),
                amplitude=float(component.get('amplitude', 1.0)),
                frequency=float(component.get('frequency', 1000.0)),
                phase=float(component.get('phase', 0.0)),
                offset=float(component.get('offset', 0.0)),
                duty=float(component.get('duty', 0.5)),
            )
        if noise_snr_db is not None:
            y = self.add_noise(y, noise_snr_db, seed=seed)

        t_view, y_view = decimate(t, y)
        return {
            'signal_type': 'mix',
            'sample_rate': sample_rate,
            'duration': duration,
            'points': int(len(t)),
            'components': components,
            't': to_list(t_view, decimals=9),
            'y': to_list(y_view),
            'metrics': signal_metrics(y),
        }


signal_service = SignalService()
