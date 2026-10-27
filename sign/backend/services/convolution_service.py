"""Lab 06 - convolution and impulse response (post-MVP content, API ready)."""
from __future__ import annotations

import numpy as np

from backend.common.enums import SignalType
from backend.services._numeric import decimate, signal_metrics, time_base, to_list
from backend.services.signal_service import signal_service


class ConvolutionService:
    """Discrete convolution presented as "what a system does to a signal".

    The service also returns the intermediate overlap frames so the frontend
    can animate the sliding-kernel picture that makes convolution click.
    """

    @staticmethod
    def convolve(x: np.ndarray, h: np.ndarray, mode: str = 'full') -> np.ndarray:
        return np.convolve(np.asarray(x, dtype=float), np.asarray(h, dtype=float), mode=mode)

    @staticmethod
    def rc_impulse_response(
        resistance: float, capacitance: float, sample_rate: float, duration: float | None = None
    ) -> tuple[np.ndarray, np.ndarray]:
        """h(t) = (1/RC) e^(-t/RC): the first-order low-pass of lab 07."""
        tau = resistance * capacitance
        duration = duration if duration else 5 * tau
        t = time_base(duration, sample_rate)
        h = np.exp(-t / tau) / tau
        return t, h

    def animation_frames(
        self, x: np.ndarray, h: np.ndarray, frames: int = 40
    ) -> list[dict]:
        """Sampled snapshots of the flip-and-slide construction."""
        x = np.asarray(x, dtype=float)
        h = np.asarray(h, dtype=float)
        full = self.convolve(x, h)
        total = len(full)
        step = max(total // frames, 1)
        h_flipped = h[::-1]
        snapshots: list[dict] = []
        for shift in range(0, total, step):
            # Window of x that currently overlaps the flipped kernel.
            start = max(0, shift - len(h) + 1)
            end = min(len(x), shift + 1)
            overlap = float(np.sum(x[start:end] * h_flipped[len(h) - (end - start):])) \
                if end > start else 0.0
            snapshots.append({'shift': shift, 'value': round(overlap, 6)})
        return snapshots

    def convolve_signals(
        self,
        signal_type: str = SignalType.square.value,
        amplitude: float = 1.0,
        frequency: float = 500.0,
        duration: float = 0.01,
        sample_rate: float = 50_000.0,
        kernel: str = 'rc',
        resistance: float = 1000.0,
        capacitance: float = 1e-6,
        kernel_values: list[float] | None = None,
        with_frames: bool = False,
    ) -> dict:
        """Convolve a generated signal with a system impulse response."""
        t = time_base(duration, sample_rate)
        x = signal_service.waveform(t, signal_type, amplitude, frequency)

        # ``dt`` turns the discrete sum into the continuous-time integral for a
        # kernel expressed as h(t); already-normalised kernels keep dt = 1.
        dt = 1.0
        if kernel_values:
            h = np.asarray(kernel_values, dtype=float)
            t_h = np.arange(len(h)) / sample_rate
        elif kernel == 'rc':
            t_h, h = self.rc_impulse_response(resistance, capacitance, sample_rate)
            dt = 1.0 / sample_rate
        else:  # moving average: the most intuitive smoothing kernel
            width = max(int(sample_rate / (10 * frequency)), 1)
            h = np.ones(width) / width
            t_h = np.arange(width) / sample_rate

        y = self.convolve(x, h)[: len(t)] * dt

        t_view, x_view, y_view = decimate(t, x, y)
        t_h_view, h_view = decimate(t_h, h)
        result = {
            'kernel': kernel if not kernel_values else 'custom',
            'sample_rate': sample_rate,
            't': to_list(t_view, decimals=9),
            'input': to_list(x_view),
            'output': to_list(y_view),
            'impulse_response': {
                't': to_list(t_h_view, decimals=9),
                'h': to_list(h_view),
                'tau': round(resistance * capacitance, 9) if kernel == 'rc' else None,
            },
            'input_metrics': signal_metrics(x),
            'output_metrics': signal_metrics(y),
        }
        if with_frames:
            result['frames'] = self.animation_frames(x, h)
        return result


convolution_service = ConvolutionService()
