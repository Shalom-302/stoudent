"""Shared numeric helpers for the scientific services.

Two concerns live here: keeping JSON payloads small enough for a 60 fps
oscilloscope, and making sure a student can never ask for a 100 M-point array.
"""
from __future__ import annotations

import numpy as np

# An oscilloscope canvas is ~1200 px wide; beyond a couple thousand points the
# extra samples cost bandwidth without changing a single pixel.
MAX_RENDER_POINTS = 2048

# Hard ceiling on the array the engine will allocate for one request. Requests
# above it are rejected in the schema layer, not silently truncated.
MAX_COMPUTE_POINTS = 1_000_000


def decimate(*arrays: np.ndarray, max_points: int = MAX_RENDER_POINTS) -> list[np.ndarray]:
    """Uniformly subsample parallel arrays down to ``max_points``.

    Slicing (rather than averaging) is deliberate: the student must see the
    aliasing artifacts the theory predicts, not a smoothed version of them.
    """
    if not arrays:
        return []
    n = len(arrays[0])
    if n <= max_points:
        return [np.asarray(a) for a in arrays]
    step = int(np.ceil(n / max_points))
    return [np.asarray(a)[::step] for a in arrays]


def to_list(array: np.ndarray, decimals: int = 6) -> list[float]:
    """JSON-safe float list: rounded, with NaN/inf collapsed to 0.0."""
    values = np.asarray(array, dtype=float)
    values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    return np.round(values, decimals).tolist()


def time_base(duration: float, sample_rate: float) -> np.ndarray:
    """Time vector of ``duration`` seconds sampled at ``sample_rate`` Hz."""
    n = max(int(round(duration * sample_rate)), 2)
    return np.arange(n, dtype=float) / sample_rate


def rms(y: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(np.asarray(y, dtype=float)))))


def signal_metrics(y: np.ndarray) -> dict[str, float]:
    """Descriptive statistics displayed under the oscilloscope trace."""
    y = np.asarray(y, dtype=float)
    peak_to_peak = float(np.max(y) - np.min(y))
    return {
        'min': round(float(np.min(y)), 6),
        'max': round(float(np.max(y)), 6),
        'mean': round(float(np.mean(y)), 6),
        'rms': round(rms(y), 6),
        'peak_to_peak': round(peak_to_peak, 6),
        'power': round(float(np.mean(np.square(y))), 6),
    }
