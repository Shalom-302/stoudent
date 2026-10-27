import { api } from '@/lib/api';
import type {
  ConvolutionResult,
  FilterResult,
  FourierAnalysis,
  HarmonicsResult,
  LaplaceResult,
  SamplingResult,
  SignalTrace,
} from '@/types';

export interface SignalComponent {
  signal_type?: string;
  amplitude?: number;
  frequency?: number;
  phase?: number;
  offset?: number;
  duty?: number;
}

/**
 * The scientific engine lives on the server (NumPy / SciPy / SymPy).
 * Babylon.js renders the result; it never computes a Fourier transform.
 */
export const signalService = {
  generate: (payload: {
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    phase?: number;
    offset?: number;
    duty?: number;
    duration?: number;
    sample_rate?: number;
    components?: SignalComponent[];
    noise_snr_db?: number | null;
    seed?: number | null;
  }) => api.post<SignalTrace>('/signals/generate', payload),

  harmonics: (payload: {
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    n_harmonics?: number;
    cumulative?: boolean;
    sample_rate?: number;
    duration?: number | null;
  }) => api.post<HarmonicsResult>('/signals/harmonics', payload),

  reconstruct: (payload: {
    harmonics: { order: number; amplitude: number; phase?: number; enabled?: boolean }[];
    frequency?: number;
    sample_rate?: number;
    duration?: number | null;
  }) => api.post<SignalTrace>('/signals/reconstruct', payload),

  fourier: (payload: {
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    components?: SignalComponent[];
    duration?: number;
    sample_rate?: number;
    window?: string;
    max_frequency?: number | null;
    noise_snr_db?: number | null;
  }) => api.post<FourierAnalysis>('/signals/fourier', payload),

  sample: (payload: {
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    phase?: number;
    sampling_rate?: number;
    duration?: number;
    reconstruct?: boolean;
  }) => api.post<SamplingResult>('/signals/sample', payload),

  filter: (payload: {
    filter_type?: string;
    cutoff?: number;
    cutoff_high?: number | null;
    order?: number;
    family?: string;
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    components?: SignalComponent[];
    duration?: number;
    sample_rate?: number;
    noise_snr_db?: number | null;
  }) => api.post<FilterResult>('/signals/filter', payload),

  convolution: (payload: {
    signal_type?: string;
    amplitude?: number;
    frequency?: number;
    duration?: number;
    sample_rate?: number;
    kernel?: string;
    resistance?: number;
    capacitance?: number;
    with_frames?: boolean;
  }) => api.post<ConvolutionResult>('/signals/convolution', payload),

  laplace: (payload: {
    expression?: string | null;
    resistance?: number;
    capacitance?: number;
    duration?: number | null;
    with_inverse?: boolean;
  }) => api.post<LaplaceResult>('/signals/laplace', payload),
};
