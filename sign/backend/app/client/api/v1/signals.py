"""The scientific endpoints: what the virtual instruments actually compute.

These path operations are declared ``def`` rather than ``async def`` on
purpose. NumPy/SciPy work is CPU-bound and releases no control to the event
loop; running them in Starlette's threadpool keeps the API responsive while a
64k-point FFT is in flight.
"""
from fastapi import APIRouter, Depends, Request
from fastapi_limiter.depends import RateLimiter

from backend.app.client.schema.signal import (
    ConvolutionParam,
    FibreDropParam,
    FilterParam,
    FourierParam,
    GenerateSignalParam,
    HarmonicsParam,
    LaplaceParam,
    MicrowaveLinkParam,
    ReconstructParam,
    SamplingParam,
)
from backend.common.exception import errors
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth
from backend.services.convolution_service import convolution_service
from backend.services.filter_service import filter_service
from backend.services.fourier_service import fourier_service
from backend.services.laplace_service import laplace_service
from backend.services.link_budget_service import link_budget_service
from backend.services.sampling_service import sampling_service
from backend.services.signal_service import signal_service

router = APIRouter(prefix='/signals', tags=['Scientific engine'])

# Every compute endpoint is metered: these are the only routes in the API where
# a single well-formed request costs real CPU.
ComputeLimit = Depends(RateLimiter(times=60, seconds=10))


@router.post(
    '/generate',
    summary='Generate a waveform (lab 01)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def generate_signal(request: Request, obj: GenerateSignalParam) -> ResponseModel:
    if obj.components:
        data = signal_service.mix(
            [component.model_dump() for component in obj.components],
            duration=obj.duration,
            sample_rate=obj.sample_rate,
            noise_snr_db=obj.noise_snr_db,
            seed=obj.seed,
        )
    else:
        data = signal_service.generate(
            signal_type=obj.signal_type,
            amplitude=obj.amplitude,
            frequency=obj.frequency,
            phase=obj.phase,
            offset=obj.offset,
            duty=obj.duty,
            duration=obj.duration,
            sample_rate=obj.sample_rate,
            noise_snr_db=obj.noise_snr_db,
            seed=obj.seed,
        )
    return response_base.success(request=request, data=data)


@router.post(
    '/harmonics',
    summary='Fourier series decomposition (lab 02)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def compute_harmonics(request: Request, obj: HarmonicsParam) -> ResponseModel:
    data = fourier_service.compute_harmonics(
        signal_type=obj.signal_type,
        amplitude=obj.amplitude,
        frequency=obj.frequency,
        n_harmonics=obj.n_harmonics,
        duration=obj.duration,
        sample_rate=obj.sample_rate,
        cumulative=obj.cumulative,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/reconstruct',
    summary='Rebuild a wave from selected harmonics (lab 02)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def reconstruct_signal(request: Request, obj: ReconstructParam) -> ResponseModel:
    data = fourier_service.reconstruct_signal(
        harmonics=[harmonic.model_dump() for harmonic in obj.harmonics],
        frequency=obj.frequency,
        duration=obj.duration,
        sample_rate=obj.sample_rate,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/fourier',
    summary='Spectrum analyzer: FFT of a signal (lab 03)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def compute_fourier(request: Request, obj: FourierParam) -> ResponseModel:
    data = fourier_service.analyze(
        components=[component.model_dump() for component in obj.components]
        if obj.components
        else None,
        signal_type=obj.signal_type,
        amplitude=obj.amplitude,
        frequency=obj.frequency,
        duration=obj.duration,
        sample_rate=obj.sample_rate,
        window=obj.window,
        max_frequency=obj.max_frequency,
        noise_snr_db=obj.noise_snr_db,
        seed=obj.seed,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/sample',
    summary='Sampling, Nyquist and aliasing (lab 04)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def sample_signal(request: Request, obj: SamplingParam) -> ResponseModel:
    data = sampling_service.sample_signal(
        signal_type=obj.signal_type,
        amplitude=obj.amplitude,
        frequency=obj.frequency,
        phase=obj.phase,
        sampling_rate=obj.sampling_rate,
        duration=obj.duration,
        reconstruct=obj.reconstruct,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/filter',
    summary='Filtering: low/high/band-pass, band-stop (lab 05)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def filter_signal(request: Request, obj: FilterParam) -> ResponseModel:
    data = filter_service.filter_signal(
        filter_type=obj.filter_type,
        cutoff=obj.cutoff,
        cutoff_high=obj.cutoff_high,
        order=obj.order,
        family=obj.family,
        components=[component.model_dump() for component in obj.components]
        if obj.components
        else None,
        signal_type=obj.signal_type,
        amplitude=obj.amplitude,
        frequency=obj.frequency,
        duration=obj.duration,
        sample_rate=obj.sample_rate,
        noise_snr_db=obj.noise_snr_db,
        seed=obj.seed,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/convolution',
    summary='Convolution and impulse response (lab 06)',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def convolve_signal(request: Request, obj: ConvolutionParam) -> ResponseModel:
    data = convolution_service.convolve_signals(
        signal_type=obj.signal_type,
        amplitude=obj.amplitude,
        frequency=obj.frequency,
        duration=obj.duration,
        sample_rate=obj.sample_rate,
        kernel=obj.kernel,
        resistance=obj.resistance,
        capacitance=obj.capacitance,
        kernel_values=obj.kernel_values,
        with_frames=obj.with_frames,
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/laplace',
    summary='Transfer function, poles/zeros, step response (lab 07)',
    # Symbolic work is the most expensive call in the API; meter it harder.
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=10, seconds=10))],
)
def analyze_laplace(request: Request, obj: LaplaceParam) -> ResponseModel:
    try:
        data = laplace_service.analyze(
            expression=obj.expression,
            resistance=obj.resistance,
            capacitance=obj.capacitance,
            duration=obj.duration,
            with_inverse=obj.with_inverse,
        )
    except ValueError as exc:
        # The parser rejects anything outside the allowed symbol set; surface
        # that as a 400 rather than a 500.
        raise errors.RequestError(msg=str(exc))
    return response_base.success(request=request, data=data)


@router.post(
    '/microwave-link',
    summary='Labo Terrain: microwave link budget and Fresnel clearance',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def microwave_link(request: Request, obj: MicrowaveLinkParam) -> ResponseModel:
    if obj.obstacle_at_km is not None and obj.obstacle_at_km >= obj.distance_km:
        raise errors.RequestError(msg='L’obstacle doit se trouver entre les deux pylônes.')
    data = link_budget_service.microwave_link(**obj.model_dump())
    return response_base.success(request=request, data=data)


@router.post(
    '/fibre-drop',
    summary='Labo Terrain: GPON optical budget from the NRO to the subscriber',
    dependencies=[DependsJwtAuth, ComputeLimit],
)
def fibre_drop(request: Request, obj: FibreDropParam) -> ResponseModel:
    data = link_budget_service.fibre_drop(**obj.model_dump())
    return response_base.success(request=request, data=data)
