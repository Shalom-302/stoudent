'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { StudentDrawer } from '@/components/admin/student-drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { signManagerService, type ManagedStudent } from '@/services/signmanager';

const PAGE_SIZE = 20;

/**
 * The roster.
 *
 * A table on desktop, a stack of cards on mobile: a seven-column table inside a
 * horizontal scroller is unusable on a phone, and this page is exactly the one
 * a teacher opens on a phone between two classes.
 */
export function StudentTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string | null>(null);

  // Debounce: typing a name should not fire a query per keystroke.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ['signmanager', 'students', debounced, status, page],
    queryFn: () =>
      signManagerService.students({
        search: debounced || undefined,
        status: status === 'all' ? undefined : status === 'active',
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ xId, next }: { xId: string; next: boolean }) =>
      signManagerService.setStatus(xId, next),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['signmanager'] });
      toast.success(variables.next ? 'Compte réactivé.' : 'Compte désactivé.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = query.data;

  return (
    <>
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher par pseudo, numéro, e-mail ou nom"
                aria-label="Rechercher un étudiant"
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              aria-label="Filtrer par statut"
              className="w-auto min-w-40"
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
            >
              <option value="all">Tous les comptes</option>
              <option value="active">Actifs</option>
              <option value="inactive">Désactivés</option>
            </Select>
          </div>

          {query.isLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-14" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="mt-6 text-sm text-ink-500">Aucun étudiant ne correspond.</p>
          ) : (
            <>
              {/* Desktop */}
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide text-ink-400">
                      <th scope="col" className="py-2 pr-3 font-medium">Étudiant</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Établissement</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Niveau</th>
                      <th scope="col" className="py-2 pr-3 font-medium">TP validés</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Score</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Statut</th>
                      <th scope="col" className="py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {data.items.map((student) => (
                      <tr key={student.x_id} className="hover:bg-ink-50">
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            onClick={() => setSelected(student.x_id)}
                            className="text-left"
                          >
                            <span className="block font-medium text-ink-900 underline-offset-4 hover:underline">
                              {displayName(student)}
                            </span>
                            <span className="block text-xs text-ink-400">{contactLine(student)}</span>
                          </button>
                        </td>
                        <td className="py-3 pr-3 text-ink-600">{student.institution ?? '—'}</td>
                        <td className="py-3 pr-3">
                          <span className="font-mono text-ink-900">{student.level_number}</span>
                          <span className="ml-1 text-xs text-ink-400">
                            {student.total_xp} XP
                          </span>
                        </td>
                        <td className="py-3 pr-3 font-mono text-ink-700">
                          {student.completed_experiments}
                        </td>
                        <td className="py-3 pr-3 font-mono text-ink-700">
                          {student.average_score}
                        </td>
                        <td className="py-3 pr-3">
                          <StatusBadge student={student} />
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggleStatus.isPending}
                            onClick={() =>
                              toggleStatus.mutate({
                                xId: student.x_id,
                                next: !student.status,
                              })
                            }
                          >
                            {student.status ? (
                              <>
                                <UserMinus className="h-4 w-4" />
                                Désactiver
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" />
                                Réactiver
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <ul className="mt-4 space-y-3 md:hidden">
                {data.items.map((student) => (
                  <li
                    key={student.x_id}
                    className="rounded-[var(--radius-card)] border border-ink-200 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(student.x_id)}
                      className="block w-full text-left"
                    >
                      <span className="block font-medium text-ink-900">
                        {displayName(student)}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {contactLine(student)}
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge student={student} />
                      <Badge variant="outline">Niv. {student.level_number}</Badge>
                      <Badge variant="outline">{student.completed_experiments} TP</Badge>
                      <Badge variant="accent">{student.total_xp} XP</Badge>
                    </div>
                    <p className="mt-2 text-xs text-ink-400">
                      Inscrit le {formatDate(student.join_time)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      disabled={toggleStatus.isPending}
                      onClick={() =>
                        toggleStatus.mutate({ xId: student.x_id, next: !student.status })
                      }
                    >
                      {student.status ? 'Désactiver le compte' : 'Réactiver le compte'}
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-400">
                  {data.total} étudiant{data.total > 1 ? 's' : ''} · page {data.page} /{' '}
                  {Math.max(data.total_pages, 1)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StudentDrawer xId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function displayName(student: ManagedStudent): string {
  return (
    student.pseudo ||
    [student.firstname, student.lastname].filter(Boolean).join(' ') ||
    student.email ||
    student.phone ||
    '—'
  );
}

/** Contact + filière under the name: how an admin recognises a member. */
function contactLine(student: ManagedStudent): string {
  const contact = student.phone ? `+${student.phone}` : student.email;
  return [
    contact,
    student.filiere,
    student.member_type === 'teacher' ? 'se déclare prof' : null,
    student.whatsapp_opt_in ? 'infos WhatsApp ✓' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function StatusBadge({ student }: { student: { status: boolean; roles: string[] } }) {
  const isAdmin = student.roles.includes('admin');
  return (
    <span className={cn('inline-flex items-center gap-1.5')}>
      <Badge variant={student.status ? 'success' : 'danger'}>
        {student.status ? 'Actif' : 'Désactivé'}
      </Badge>
      {isAdmin && (
        <Badge variant="accent">
          <ShieldCheck className="h-3 w-3" />
          admin
        </Badge>
      )}
    </span>
  );
}
