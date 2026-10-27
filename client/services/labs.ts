import { api } from '@/lib/api';
import type {
  ExperimentDetail,
  Milestone,
  ExperimentSummary,
  LabDetail,
  LabSummary,
  SubmitResult,
  WorldDescriptor,
} from '@/types';

export const labService = {
  list: () => api.get<LabSummary[]>('/labs'),
  world: () => api.get<WorldDescriptor>('/labs/world'),
  detail: (slug: string) => api.get<LabDetail>(`/labs/${slug}`),
  experiments: (slug: string) => api.get<ExperimentSummary[]>(`/labs/${slug}/experiments`),
};

export interface ExperimentProgress {
  status: string;
  progress: number;
  current_step: number;
  score: number;
  best_score: number;
  attempts: number;
  parameters: Record<string, unknown>;
  milestones?: Milestone[];
  started_at?: string | null;
  completed_at?: string | null;
}

export const experimentService = {
  detail: (slug: string) => api.get<ExperimentDetail>(`/experiments/${slug}`),
  start: (slug: string) => api.post<ExperimentProgress>(`/experiments/${slug}/start`),
  progress: (slug: string) => api.get<ExperimentProgress>(`/experiments/${slug}/progress`),

  /** Autosave of the bench: cheap, frequent, never graded. */
  saveState: (
    slug: string,
    payload: { current_step?: number; parameters?: Record<string, unknown>; progress?: number },
  ) => api.put<ExperimentProgress>(`/experiments/${slug}/state`, payload),

  submit: (
    slug: string,
    payload: { answers: Record<string, unknown>; parameters?: Record<string, unknown> },
  ) => api.post<SubmitResult>(`/experiments/${slug}/submit`, payload),
};
