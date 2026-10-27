'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { experimentService } from '@/services/labs';
import type { Milestone, SubmitResult } from '@/types';

const AUTOSAVE_DELAY = 1200;

/**
 * Owns one running TP: its bench parameters, its answers and its persistence.
 *
 * Bench state is autosaved on a debounce rather than on every knob movement -
 * dragging a frequency slider fires dozens of changes per second and each one
 * would otherwise be a round trip.
 */
export function useExperiment(slug: string) {
  const queryClient = useQueryClient();
  const [parameters, setParameters] = React.useState<Record<string, unknown>>({});
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [currentStep, setCurrentStep] = React.useState(0);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  // Ticked live by the server on every autosave: the manipulation is graded
  // as it happens, not only when the student submits.
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const hydrated = React.useRef(false);

  const experiment = useQuery({
    queryKey: ['experiment', slug],
    queryFn: () => experimentService.detail(slug),
  });

  // `start` is idempotent server-side: it opens the TP or resumes it, and never
  // resets saved work, so calling it on mount is safe.
  const start = useMutation({
    mutationFn: () => experimentService.start(slug),
  });

  React.useEffect(() => {
    if (!experiment.data || hydrated.current) return;
    hydrated.current = true;
    setParameters({ ...experiment.data.initial_parameters, ...experiment.data.parameters });
    setCurrentStep(experiment.data.current_step ?? 0);
    setMilestones(experiment.data.milestones ?? []);
    start.mutate(undefined, {
      onError: () => toast.error('Impossible d’ouvrir ce TP.'),
    });
    // `start` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.data]);

  const saveState = useMutation({
    mutationFn: (payload: {
      current_step?: number;
      parameters?: Record<string, unknown>;
      progress?: number;
    }) => experimentService.saveState(slug, payload),
    onSuccess: (data) => {
      if (data?.milestones) setMilestones(data.milestones);
    },
  });

  // Debounced autosave of the bench.
  React.useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      saveState.mutate({ parameters, current_step: currentStep });
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters, currentStep]);

  const submit = useMutation({
    mutationFn: () => experimentService.submit(slug, { answers, parameters }),
    onSuccess: (data) => {
      setResult(data);
      if (data.milestones) setMilestones(data.milestones);
      void queryClient.invalidateQueries({ queryKey: ['experiment', slug] });
      void queryClient.invalidateQueries({ queryKey: ['labs'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      void queryClient.invalidateQueries({ queryKey: ['achievements'] });
      if (data.passed) toast.success(`TP validé — ${data.score} / 100`);
      else toast.warning(`Score ${data.score} / 100 — reprenez la manipulation.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setParameter = React.useCallback((key: string, value: unknown) => {
    setParameters((previous) => ({ ...previous, [key]: value }));
  }, []);

  const setAnswer = React.useCallback((id: string, value: unknown) => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
  }, []);

  const retry = React.useCallback(() => {
    setResult(null);
    setAnswers({});
  }, []);

  return {
    experiment,
    milestones,
    parameters,
    setParameter,
    setParameters,
    answers,
    setAnswer,
    currentStep,
    setCurrentStep,
    submit,
    submitting: submit.isPending,
    result,
    retry,
    closeResult: () => setResult(null),
    saving: saveState.isPending,
  };
}

/** Reads a numeric bench parameter with a fallback, tolerating string input. */
export function num(
  parameters: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = parameters[key];
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

export function str(
  parameters: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = parameters[key];
  return typeof value === 'string' && value ? value : fallback;
}
