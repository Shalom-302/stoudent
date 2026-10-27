'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnswerResult, Question } from '@/types';

interface QuestionPanelProps {
  questions: Question[];
  answers: Record<string, unknown>;
  results?: AnswerResult[] | null;
  submitting?: boolean;
  disabled?: boolean;
  onChange: (id: string, value: unknown) => void;
  onSubmit: () => void;
}

/**
 * The validation form.
 *
 * Nothing here knows the right answer - the correction comes back from the API
 * after grading, which keeps the expected values off the wire until the student
 * has committed.
 *
 * Accessibility is done by pointing every control at the *visible* question
 * text with `aria-labelledby`, never by adding a hidden copy of it: a duplicated
 * label is read twice by a screen reader and shows up twice in a copy-paste.
 */
export function QuestionPanel({
  questions,
  answers,
  results,
  submitting,
  disabled,
  onChange,
  onSubmit,
}: QuestionPanelProps) {
  const byId = React.useMemo(
    () => new Map((results ?? []).map((result) => [result.question_id, result])),
    [results],
  );

  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== '',
  ).length;

  if (questions.length === 0) {
    return <p className="text-sm text-ink-500">Cette expérience n’a pas de questionnaire.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {questions.map((question, index) => {
        const result = byId.get(question.id);
        const labelId = `${question.id}-label`;

        return (
          <section
            key={question.id}
            role="group"
            aria-labelledby={labelId}
            className={cn(
              'rounded-[var(--radius-card)] border p-5',
              result
                ? result.correct
                  ? 'border-[var(--color-success)]/40 bg-[var(--color-success)]/5'
                  : 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5'
                : 'border-ink-200 bg-white',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600"
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p id={labelId} className="text-sm font-medium leading-relaxed text-ink-900">
                  {question.question}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {question.points} point{question.points > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="mt-4 pl-9">
              {question.type === 'mcq' && (
                <div role="radiogroup" aria-labelledby={labelId} className="space-y-2">
                  {question.options.map((option) => (
                    <label
                      key={option}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors',
                        answers[question.id] === option
                          ? 'border-ink-900 bg-ink-50'
                          : 'border-ink-200 hover:bg-ink-50',
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={answers[question.id] === option}
                        disabled={disabled}
                        onChange={() => onChange(question.id, option)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-ink-900"
                      />
                      <span className="leading-relaxed text-ink-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === 'boolean' && (
                <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
                  {[
                    { value: true, label: 'Vrai' },
                    { value: false, label: 'Faux' },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      type="button"
                      variant={answers[question.id] === option.value ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={disabled}
                      aria-pressed={answers[question.id] === option.value}
                      onClick={() => onChange(question.id, option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}

              {question.type === 'numeric' && (
                <div className="flex items-center gap-2.5">
                  <Input
                    id={question.id}
                    aria-labelledby={labelId}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    disabled={disabled}
                    value={(answers[question.id] as string | number | undefined) ?? ''}
                    onChange={(event) => onChange(question.id, event.target.value)}
                    placeholder="Valeur"
                    className="max-w-44"
                  />
                  {question.unit && (
                    <span className="shrink-0 text-sm font-medium text-ink-500">
                      {question.unit}
                    </span>
                  )}
                </div>
              )}

              {question.type === 'text' && (
                <Input
                  id={question.id}
                  aria-labelledby={labelId}
                  disabled={disabled}
                  value={(answers[question.id] as string | undefined) ?? ''}
                  onChange={(event) => onChange(question.id, event.target.value)}
                  placeholder="Votre réponse"
                />
              )}
            </div>

            {result && (
              <p
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
                  result.correct
                    ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                    : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
                )}
              >
                {result.correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="leading-relaxed">
                  {result.correct ? 'Correct' : 'Incorrect'}
                  {result.feedback ? ` — ${result.feedback}` : ''}
                </span>
              </p>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
        <p className="text-xs text-ink-400">
          {answeredCount} / {questions.length} question{questions.length > 1 ? 's' : ''} renseignée
          {answeredCount > 1 ? 's' : ''}
        </p>
        <Button type="submit" disabled={submitting || disabled}>
          {submitting ? 'Validation…' : 'Valider le TP'}
        </Button>
      </div>
    </form>
  );
}
