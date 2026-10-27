'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { signManagerService } from '@/services/signmanager';

/** 'teacher' is the verified-professor role: it unlocks "Valider (prof)". */
const ROLES = ['user', 'teacher', 'admin'] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  user: 'membre',
  teacher: 'professeur vérifié',
  admin: 'admin',
};

interface StudentDrawerProps {
  xId: string | null;
  onClose: () => void;
}

/** One student in full: profile, per-TP progress, badges, role assignment. */
export function StudentDrawer({ xId, onClose }: StudentDrawerProps) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['signmanager', 'student', xId],
    queryFn: () => signManagerService.student(xId as string),
    enabled: Boolean(xId),
  });

  const setRoles = useMutation({
    mutationFn: (roles: string[]) => signManagerService.setRoles(xId as string, roles),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['signmanager'] });
      toast.success('Rôles mis à jour.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!xId) return null;

  const student = query.data;
  const fullName =
    student?.pseudo ||
    [student?.firstname, student?.lastname].filter(Boolean).join(' ') ||
    student?.email ||
    student?.phone;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{query.isLoading ? 'Chargement…' : fullName}</DialogTitle>
          <DialogDescription>
            {[student?.phone ? `+${student.phone}` : null, student?.email].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading || !student ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Niveau" value={student.level_number} />
              <Stat label="XP" value={student.total_xp} />
              <Stat label="TP validés" value={student.completed_experiments} />
              <Stat label="Score moyen" value={student.average_score} />
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="Filière" value={student.filiere ?? '—'} />
              <Field
                label="Se déclare"
                value={student.member_type === 'teacher' ? 'Professeur' : 'Étudiant'}
              />
              <Field label="Réputation" value={String(student.reputation)} />
              <Field label="Établissement" value={student.institution ?? '—'} />
              <Field label="Niveau d’études" value={student.level ?? '—'} />
              <Field label="Inscrit le" value={formatDate(student.join_time)} />
              <Field label="Dernière connexion" value={formatDate(student.last_login_time)} />
            </dl>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Rôles
              </h3>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const active = student.roles.includes(role);
                  return (
                    <Button
                      key={role}
                      variant={active ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={setRoles.isPending}
                      onClick={() => setRoles.mutate([role])}
                    >
                      {role === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                      {ROLE_LABELS[role]}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-400">
                Un compte porte un rôle à la fois. Donnez « professeur vérifié » après avoir vérifié
                qu’un membre qui se déclare prof l’est vraiment. Vous ne pouvez pas retirer votre
                propre rôle administrateur.
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Expériences
              </h3>
              {student.experiments.length === 0 ? (
                <p className="text-sm text-ink-500">Aucune expérience commencée.</p>
              ) : (
                <ul className="space-y-3">
                  {student.experiments.map((experiment) => (
                    <li key={experiment.experiment_slug}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm text-ink-900">
                          {experiment.experiment_title}
                        </span>
                        <span className="font-mono text-xs text-ink-500">
                          {experiment.best_score}/100 · {experiment.attempts} tentative
                          {experiment.attempts > 1 ? 's' : ''}
                        </span>
                      </div>
                      <Progress
                        value={
                          experiment.status === 'completed' ? 100 : experiment.progress
                        }
                        indicatorClassName={
                          experiment.status === 'completed'
                            ? 'bg-[var(--color-success)]'
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {student.achievements.length > 0 && (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Badges
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {student.achievements.map((name) => (
                    <li key={name}>
                      <Badge variant="accent">
                        <Award className="h-3 w-3" />
                        {name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-400">{label}</p>
      <p className="font-mono text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="text-ink-700">{value}</dd>
    </div>
  );
}
