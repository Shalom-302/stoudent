"""Scientific engine of SignalLab.

Pure computation: NumPy / SciPy / SymPy only, no database and no FastAPI. The
3D world never computes a Fourier transform - it renders what this package
returns (see the fiche technique, section 9.2).
"""
from backend.services.convolution_service import convolution_service
from backend.services.filter_service import filter_service
from backend.services.fourier_service import fourier_service
from backend.services.laplace_service import laplace_service
from backend.services.sampling_service import sampling_service
from backend.services.signal_service import signal_service

__all__ = [
    'convolution_service',
    'filter_service',
    'fourier_service',
    'laplace_service',
    'sampling_service',
    'signal_service',
]
