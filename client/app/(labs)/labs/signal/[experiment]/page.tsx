'use client';

import { useParams } from 'next/navigation';

import { ExperimentShell } from '@/components/experiments/experiment-shell';
import { GuidePanel } from '@/components/experiments/guide-panel';
import { InstructionPanel } from '@/components/experiments/instruction-panel';
import { MilestoneList } from '@/components/experiments/milestone-list';
import { QuestionPanel } from '@/components/experiments/question-panel';
import { ResultDialog } from '@/components/experiments/result-dialog';
import { TheoryPanel } from '@/components/experiments/theory-panel';
import { Bench } from '@/components/labs/benches';
import { Skeleton } from '@/components/ui/skeleton';
import { useExperiment } from '@/features/experiments/use-experiment';

/**
 * One running TP: instructions, the virtual bench, and the validation form.
 *
 * The bench is picked from the slug, so the pedagogical catalogue (backend
 * seed) and the instrument code stay independent of one another.
 */
export default function ExperimentPage() {
  const params = useParams<{ experiment: string }>();
  const slug = params.experiment;

  const {
    experiment,
    milestones,
    parameters,
    setParameter,
    answers,
    setAnswer,
    currentStep,
    setCurrentStep,
    submit,
    submitting,
    result,
    retry,
    closeResult,
    saving,
  } = useExperiment(slug);

  if (experiment.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-16" />
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (experiment.isError || !experiment.data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-lg font-semibold text-ink-900">Expérience introuvable</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          {experiment.error instanceof Error
            ? experiment.error.message
            : 'Ce TP n’existe pas ou n’est pas encore publié.'}
        </p>
      </div>
    );
  }

  const data = experiment.data;
  const completed = data.status === 'completed' || Boolean(result?.passed);

  return (
    <>
      <ExperimentShell
        experiment={data}
        saving={saving}
        bench={<Bench slug={slug} parameters={parameters} setParameter={setParameter} />}
        instructions={
          <>
            <GuidePanel guide={data.guide} className="mb-4" dense />
            <MilestoneList milestones={milestones} className="mb-4" dense />
            <InstructionPanel
              steps={data.instructions}
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              objective={data.objective}
            />
          </>
        }
        questions={
          <QuestionPanel
            questions={data.questions}
            answers={answers}
            results={result?.results}
            submitting={submitting}
            onChange={setAnswer}
            onSubmit={() => submit.mutate()}
          />
        }
        theory={
          <TheoryPanel theory={result?.theory ?? data.theory} unlocked={completed} />
        }
      />

      <ResultDialog
        result={result}
        labSlug={data.lab_slug}
        onRetry={retry}
        onClose={closeResult}
      />
    </>
  );
}
