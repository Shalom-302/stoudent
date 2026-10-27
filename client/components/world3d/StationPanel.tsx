'use client';

import { ChevronLeft, Save, Zap } from 'lucide-react';
import * as React from 'react';

import { GuidePanel } from '@/components/experiments/guide-panel';
import { InstructionPanel } from '@/components/experiments/instruction-panel';
import { MilestoneList } from '@/components/experiments/milestone-list';
import { Choice, Knob } from '@/components/experiments/knob';
import { QuestionPanel } from '@/components/experiments/question-panel';
import { ResultDialog } from '@/components/experiments/result-dialog';
import { TheoryPanel } from '@/components/experiments/theory-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { num, str, useExperiment } from '@/features/experiments/use-experiment';
import { buildLesson } from '@/lib/lab3d/lesson';
import type { LessonContext } from '@/lib/lab3d/screens';
import { controlsFor } from '@/lib/lab3d/signal-bridge';
import type { LabPoint } from '@/lib/lab3d/stations';

interface StationPanelProps {
  point: LabPoint;
  onClose: () => void;
  /** Bench parameters, lifted so the 3D instruments can render them. */
  onParameters: (parameters: Record<string, unknown>) => void;
  /** What the wall screens should teach while this bench is open. */
  onLesson: (lesson: LessonContext | undefined) => void;
}

/**
 * The TP, run from inside the room.
 *
 * The student never leaves the lab: the camera has already moved up to the
 * bench, the 3D instrument screens are the readout, and this panel is the
 * front face of the equipment - knobs on one tab, the questionnaire on the
 * other. Turning a knob here updates the screens across the room, which is the
 * whole point of doing it in place rather than on a separate page.
 */
export function StationPanel({ point, onClose, onParameters, onLesson }: StationPanelProps) {
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
  } = useExperiment(point.slug);

  // Push the bench state up so the room's instruments follow the knobs.
  React.useEffect(() => {
    onParameters(parameters);
  }, [parameters, onParameters]);

  // And the instruction, so the big screen and the whiteboard say what to do
  // right now instead of standing there as decoration.
  const lesson = React.useMemo(
    () => buildLesson(experiment.data, parameters, milestones, currentStep),
    [experiment.data, parameters, milestones, currentStep],
  );
  React.useEffect(() => {
    onLesson(lesson);
    return () => onLesson(undefined);
  }, [lesson, onLesson]);

  // Escape leaves the bench, exactly like stepping back from it.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = experiment.data;
  const controls = controlsFor(point.slug);
  const completed = data?.status === 'completed' || Boolean(result?.passed);

  return (
    <>
      <aside
        role="dialog"
        aria-label={point.title}
        className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ink-200 bg-white/97 backdrop-blur sm:w-[26rem]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 p-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-accent-600">
              Poste {point.id}
            </p>
            <h2 className="truncate text-sm font-semibold text-ink-900">{point.title}</h2>
            <p className="truncate text-xs text-ink-500">{point.subtitle}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
            Quitter
          </Button>
        </header>

        {experiment.isLoading || !data ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2">
              <Badge variant="accent">
                <Zap className="h-3 w-3" />
                {data.xp_reward} XP
              </Badge>
              {data.best_score > 0 && (
                <Badge variant={completed ? 'success' : 'outline'}>
                  {data.best_score} / 100
                </Badge>
              )}
              {saving && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-400">
                  <Save className="h-3 w-3" />
                  sauvegarde
                </span>
              )}
            </div>

            <Tabs defaultValue="course" className="flex min-h-0 flex-1 flex-col">
              <div className="px-4 pt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="course" className="flex-1 px-2">
                    Cours
                  </TabsTrigger>
                  <TabsTrigger value="bench" className="flex-1 px-2">
                    Banc
                  </TabsTrigger>
                  <TabsTrigger value="protocol" className="flex-1 px-2">
                    Étapes
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="flex-1 px-2">
                    Valider
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <TabsContent value="course" className="space-y-4">
                  <GuidePanel guide={data.guide} dense />
                </TabsContent>

                <TabsContent value="bench" className="space-y-5">
                  <MilestoneList milestones={milestones} dense />

                  <p className="text-xs text-ink-500">
                    Les écrans du poste et le grand écran de la salle suivent ces réglages en
                    direct.
                  </p>

                  {controls.choices.map((choice) => (
                    <Choice
                      key={choice.key}
                      id={`station-${choice.key}`}
                      label={choice.label}
                      value={str(parameters, choice.key, choice.options[0]?.value ?? '')}
                      options={choice.options}
                      onChange={(value) => setParameter(choice.key, value)}
                    />
                  ))}

                  {controls.knobs.map((knob) => (
                    <Knob
                      key={knob.key}
                      id={`station-${knob.key}`}
                      label={knob.label}
                      unit={knob.unit}
                      hint={knob.hint}
                      log={knob.log}
                      min={knob.min}
                      max={knob.max}
                      step={knob.step}
                      value={num(parameters, knob.key, knob.min)}
                      onChange={(value) => setParameter(knob.key, value)}
                    />
                  ))}

                  {controls.knobs.length === 0 && controls.choices.length === 0 && (
                    <p className="text-sm text-ink-500">
                      Ce poste n’a pas de réglage : lisez le protocole puis validez.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="protocol">
                  <InstructionPanel
                    steps={data.instructions}
                    currentStep={currentStep}
                    onStepChange={setCurrentStep}
                    objective={data.objective}
                  />
                </TabsContent>

                <TabsContent value="quiz" className="space-y-4">
                  <QuestionPanel
                    questions={data.questions}
                    answers={answers}
                    results={result?.results}
                    submitting={submitting}
                    onChange={setAnswer}
                    onSubmit={() => submit.mutate()}
                  />
                  <TheoryPanel theory={result?.theory ?? data.theory} unlocked={completed} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </aside>

      <ResultDialog
        result={result}
        labSlug="signal-lab"
        onRetry={retry}
        onClose={closeResult}
        onDone={() => {
          closeResult();
          onClose();
        }}
      />
    </>
  );
}
