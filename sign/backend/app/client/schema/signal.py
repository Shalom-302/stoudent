"""Request schemas for the scientific endpoints.

Every bound here is a denial-of-service control as much as a physics one: the
computation runs in the API worker, so ``duration * sample_rate`` is the single
number that decides how much CPU and memory one request can claim.
"""
from pydantic import Field, field_validator, model_validator
from typing_extensions import Self

from backend.common.enums import FilterType, SignalType, WindowType
from backend.common.schema import SchemaBase
from backend.services._numeric import MAX_COMPUTE_POINTS


class _BoundedAcquisition(SchemaBase):
    """Mixin enforcing the sample-count ceiling on any generated trace."""

    duration: float = Field(default=0.005, gt=0, le=10.0, description='Seconds')
    sample_rate: float = Field(default=200_000.0, gt=0, le=10_000_000.0, description='Hz')

    @model_validator(mode='after')
    def _check_points(self) -> Self:
        points = self.duration * self.sample_rate
        if points > MAX_COMPUTE_POINTS:
            raise ValueError(
                f'duration x sample_rate must stay under {MAX_COMPUTE_POINTS:,} samples '
                f'(requested {int(points):,}).'
            )
        return self


class SignalComponent(SchemaBase):
    """One term of a composite signal, e.g. ``0.5*sin(2*pi*3000t)``."""

    signal_type: SignalType = SignalType.sine
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=1000.0, ge=0, le=1_000_000)
    phase: float = Field(default=0.0, ge=-100, le=100)
    offset: float = Field(default=0.0, ge=-1000, le=1000)
    duty: float = Field(default=0.5, gt=0, lt=1)


class GenerateSignalParam(_BoundedAcquisition):
    signal_type: SignalType = SignalType.sine
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=1000.0, ge=0, le=1_000_000)
    phase: float = Field(default=0.0, ge=-100, le=100)
    offset: float = Field(default=0.0, ge=-1000, le=1000)
    duty: float = Field(default=0.5, gt=0, lt=1)
    # Several components turn this into the composite-signal call.
    components: list[SignalComponent] | None = Field(default=None, max_length=16)
    noise_snr_db: float | None = Field(default=None, ge=-20, le=120)
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)


class HarmonicsParam(SchemaBase):
    """Fourier-series decomposition of a periodic waveform."""

    signal_type: SignalType = SignalType.square
    amplitude: float = Field(default=1.0, gt=0, le=1000)
    frequency: float = Field(default=1000.0, gt=0, le=1_000_000)
    n_harmonics: int = Field(default=9, ge=1, le=99)
    cumulative: bool = True
    sample_rate: float = Field(default=200_000.0, gt=0, le=10_000_000.0)
    duration: float | None = Field(default=None, gt=0, le=1.0)


class HarmonicParam(SchemaBase):
    order: int = Field(ge=1, le=199)
    amplitude: float = Field(default=0.0, ge=-1000, le=1000)
    phase: float = Field(default=0.0, ge=-100, le=100)
    enabled: bool = True


class ReconstructParam(SchemaBase):
    """Rebuild a wave from the harmonics the student toggled on."""

    harmonics: list[HarmonicParam] = Field(default_factory=list, max_length=100)
    frequency: float = Field(default=1000.0, gt=0, le=1_000_000)
    sample_rate: float = Field(default=200_000.0, gt=0, le=10_000_000.0)
    duration: float | None = Field(default=None, gt=0, le=1.0)


class FourierParam(_BoundedAcquisition):
    """Time trace + spectrum, the spectrum-analyzer call."""

    duration: float = Field(default=0.02, gt=0, le=10.0)
    signal_type: SignalType = SignalType.sine
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=1000.0, ge=0, le=1_000_000)
    components: list[SignalComponent] | None = Field(default=None, max_length=16)
    window: WindowType = WindowType.none
    max_frequency: float | None = Field(default=None, gt=0, le=10_000_000)
    noise_snr_db: float | None = Field(default=None, ge=-20, le=120)
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)


class SamplingParam(SchemaBase):
    """Nyquist / aliasing experiment."""

    signal_type: SignalType = SignalType.sine
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=5000.0, gt=0, le=1_000_000)
    phase: float = Field(default=0.0, ge=-100, le=100)
    sampling_rate: float = Field(default=6000.0, gt=0, le=1_000_000)
    duration: float = Field(default=0.002, gt=0, le=0.5)
    reconstruct: bool = True

    @model_validator(mode='after')
    def _check_cost(self) -> Self:
        # The sinc reconstruction is O(samples x grid); bound the sample count
        # rather than letting a 0.5 s x 1 MHz request build a 500 k x 1 k matrix.
        if self.duration * self.sampling_rate > 50_000:
            raise ValueError('duration x sampling_rate must stay under 50,000 samples.')
        return self


class FilterParam(_BoundedAcquisition):
    duration: float = Field(default=0.02, gt=0, le=10.0)
    filter_type: FilterType = FilterType.low_pass
    cutoff: float = Field(default=2000.0, gt=0, le=1_000_000)
    cutoff_high: float | None = Field(default=None, gt=0, le=1_000_000)
    order: int = Field(default=4, ge=1, le=10)
    family: str = Field(default='butter')
    signal_type: SignalType = SignalType.square
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=1000.0, gt=0, le=1_000_000)
    components: list[SignalComponent] | None = Field(default=None, max_length=16)
    noise_snr_db: float | None = Field(default=None, ge=-20, le=120)
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)

    @field_validator('family')
    @classmethod
    def _known_family(cls, value: str) -> str:
        # Passed straight to scipy.iirfilter's ``ftype``; allow-list it.
        allowed = {'butter', 'cheby1', 'cheby2', 'ellip', 'bessel'}
        if value not in allowed:
            raise ValueError(f'family must be one of {sorted(allowed)}')
        return value

    @model_validator(mode='after')
    def _check_band(self) -> Self:
        band = self.filter_type in (FilterType.band_pass, FilterType.band_stop)
        if band:
            if self.cutoff_high is None:
                raise ValueError('cutoff_high is required for band-pass / band-stop filters.')
            if self.cutoff_high <= self.cutoff:
                raise ValueError('cutoff_high must be greater than cutoff.')
        nyquist = self.sample_rate / 2
        highest = self.cutoff_high or self.cutoff
        if highest >= nyquist:
            raise ValueError(f'Cut-off frequencies must stay below Nyquist ({nyquist:g} Hz).')
        return self


class ConvolutionParam(SchemaBase):
    signal_type: SignalType = SignalType.square
    amplitude: float = Field(default=1.0, ge=-1000, le=1000)
    frequency: float = Field(default=500.0, gt=0, le=1_000_000)
    duration: float = Field(default=0.01, gt=0, le=1.0)
    sample_rate: float = Field(default=50_000.0, gt=0, le=1_000_000)
    kernel: str = Field(default='rc')
    resistance: float = Field(default=1000.0, gt=0, le=1e9)
    capacitance: float = Field(default=1e-6, gt=0, le=1.0)
    kernel_values: list[float] | None = Field(default=None, max_length=1024)
    with_frames: bool = False

    @field_validator('kernel')
    @classmethod
    def _known_kernel(cls, value: str) -> str:
        allowed = {'rc', 'moving_average'}
        if value not in allowed:
            raise ValueError(f'kernel must be one of {sorted(allowed)}')
        return value

    @model_validator(mode='after')
    def _check_points(self) -> Self:
        if self.duration * self.sample_rate > 100_000:
            raise ValueError('duration x sample_rate must stay under 100,000 samples.')
        return self


class LaplaceParam(SchemaBase):
    """Symbolic study of a transfer function H(s)."""

    expression: str | None = Field(
        default=None,
        max_length=200,
        description="Transfer function in s, e.g. '1/(0.001*s + 1)'. Omit to use the RC preset.",
    )
    resistance: float = Field(default=1000.0, gt=0, le=1e9)
    capacitance: float = Field(default=1e-6, gt=0, le=1.0)
    duration: float | None = Field(default=None, gt=0, le=100.0)
    with_inverse: bool = True
