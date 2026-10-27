'use client';

import { Award, PartyPopper, RotateCcw, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { SubmitResult } from '@/types';

interface ResultDialogProps {
  result: SubmitResult | null;
  labSlug: string;
  onRetry: () => void;
  onClose: () => void;
  /**
   * Provided when the TP runs inside the 3D room: finishing steps back from
   * the bench instead of leaving the lab for a list page.
   */
  onDone?: () => void;
}

/** End-of-TP screen: score, XP, badges, and the door to the next experiment. */
export function ResultDialog({ result, labSlug, onRetry, onClose, onDone }: ResultDialogProps) {
  if (!result) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.passed ? (
              <>
                <PartyPopper className="h-5 w-5 text-accent-500" />
                TP validé
              </>
            ) : (
              <>
                <RotateCcw className="h-5 w-5 text-ink-400" />
                Pas encore
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.passed
              ? 'Vous pouvez relancer le TP pour améliorer votre score.'
              : 'Reprenez la manipulation puis revalidez : les tentatives ne sont pas pénalisées.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-ink-500">Score</span>
              <span className="font-mono text-2xl font-semibold text-ink-900">
                {result.score}
                <span className="text-base text-ink-400"> / 100</span>
              </span>
            </div>
            <Progress value={result.score} />
            {result.best_score > result.score && (
              <p className="mt-1.5 text-xs text-ink-400">
                Meilleur score enregistré : {result.best_score} / 100
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-accent-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-accent-600">XP gagnée</p>
              <p className="font-mono text-lg font-semibold text-ink-900">
                +{result.xp_earned}
              </p>
            </div>
            <div className="rounded-lg bg-ink-50 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-ink-400">Niveau</p>
              <p className="flex items-center gap-1.5 font-mono text-lg font-semibold text-ink-900">
                {result.level_number}
                {result.level_up && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                    <TrendingUp className="h-3.5 w-3.5" />
                    niveau supérieur
                  </span>
                )}
              </p>
            </div>
          </div>

          {result.unlocked_achievements.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Badges débloqués
              </p>
              <ul className="space-y-1.5">
                {result.unlocked_achievements.map((achievement) => (
                  <li
                    key={achievement.slug}
                    className="flex items-center gap-2.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2"
                  >
                    <Award className="h-4 w-4 shrink-0 text-accent-600" />
                    <span className="text-sm font-medium text-ink-900">{achievement.name}</span>
                    {achievement.xp_reward > 0 && (
                      <span className="ml-auto font-mono text-xs text-accent-600">
                        +{achievement.xp_reward} XP
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Recommencer
          </Button>
          {onDone ? (
            <Button onClick={onDone}>Revenir dans la salle</Button>
          ) : (
            <Button asChild>
              <Link href={`/labs/${labSlug === 'telecom-lab' ? 'telecom' : 'signal'}`}>
                Retour au laboratoire
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
