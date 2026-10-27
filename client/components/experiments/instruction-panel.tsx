'use client';

import { Check, Lightbulb } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InstructionStep } from '@/types';

interface InstructionPanelProps {
  steps: InstructionStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  objective?: string | null;
}

/**
 * The guided path through a TP.
 *
 * Hints are collapsed by default: the fiche technique asks the AI tutor to
 * "guider sans donner systematiquement la reponse", and the static hints follow
 * the same rule - the student has to decide to ask.
 */
export function InstructionPanel({
  steps,
  currentStep,
  onStepChange,
  objective,
}: InstructionPanelProps) {
  const [revealed, setRevealed] = React.useState<Record<number, boolean>>({});

  return (
    <div className="space-y-4">
      {objective && (
        <div className="rounded-[var(--radius-card)] border border-accent-200 bg-accent-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">
            Objectif
          </p>
          <p className="mt-1 text-sm text-ink-700">{objective}</p>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isCurrent = index === currentStep;
          const isDone = index < currentStep;
          return (
            <li key={step.title}>
              <button
                type="button"
                onClick={() => onStepChange(index)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'w-full rounded-[var(--radius-card)] border p-3 text-left transition-colors',
                  isCurrent
                    ? 'border-ink-900 bg-white'
                    : 'border-ink-200 bg-white hover:bg-ink-50',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      isDone
                        ? 'bg-[var(--color-success)] text-white'
                        : isCurrent
                          ? 'bg-ink-900 text-white'
                          : 'bg-ink-100 text-ink-500',
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{step.title}</p>
                    {isCurrent && (
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.content}</p>
                    )}
                  </div>
                </div>
              </button>

              {isCurrent && step.hint && (
                <div className="mt-2 pl-8">
                  {revealed[index] ? (
                    <p className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                      {step.hint}
                    </p>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevealed((r) => ({ ...r, [index]: true }))}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Afficher un indice
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentStep === 0}
          onClick={() => onStepChange(Math.max(currentStep - 1, 0))}
        >
          Précédent
        </Button>
        <span className="text-xs text-ink-400">
          Étape {Math.min(currentStep + 1, steps.length)} / {steps.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentStep >= steps.length - 1}
          onClick={() => onStepChange(Math.min(currentStep + 1, steps.length - 1))}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
