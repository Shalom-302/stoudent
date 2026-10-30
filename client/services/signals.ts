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

  /** Labo Terrain: microwave link budget and Fresnel clearance between two towers. */
  microwaveLink: (payload: Partial<MicrowaveLinkInput>) =>
    api.post<MicrowaveLinkResult>('/signals/microwave-link', payload),
  /** Labo Terrain: GPON optical budget from the central office to the subscriber. */
  fibreDrop: (payload: Partial<FibreDropInput>) => api.post<FibreDropResult>('/signals/fibre-drop', payload),
};

export interface MicrowaveLinkInput {
  frequency_ghz: number;
  distance_km: number;
  tx_power_dbm: number;
  dish_diameter_m: number;
  losses_db: number;
  sensitivity_dbm: number;
  height_a_m: number;
  height_b_m: number;
  obstacle_height_m: number;
}

export interface MicrowaveLinkResult {
  free_space_loss_db: number;
  dish_gain_dbi: number;
  received_dbm: number;
  fade_margin_db: number;
  fresnel_radius_m: number;
  earth_bulge_m: number;
  line_of_sight_m: number;
  clearance_m: number;
  clearance_ratio: number;
  fresnel_clear: boolean;
  raise_towers_by_m: number;
  link_up: boolean;
  verdict: string;
}

export interface FibreDropInput {
  length_km: number;
  wavelength_nm: 1310 | 1490 | 1550;
  splices: number;
  connectors: number;
  splitters: number[];
  olt_power_dbm: number;
  onu_sensitivity_dbm: number;
}

export interface FibreDropResult {
  attenuation_db_per_km: number;
  fibre_loss_db: number;
  splice_loss_db: number;
  connector_loss_db: number;
  splitter_loss_db: number;
  total_loss_db: number;
  received_dbm: number;
  margin_db: number;
  subscribers_per_port: number;
  split_ok: boolean;
  link_up: boolean;
  verdict: string;
}
