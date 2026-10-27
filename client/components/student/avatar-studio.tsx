'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { studentService, type AvatarPayload } from '@/services/student';

const OPTIONS = {
  outfit: [
    { value: 'lab_coat', label: 'Blouse', color: '#f4f4f6' },
    { value: 'hoodie', label: 'Sweat', color: '#4b5563' },
    { value: 'jacket', label: 'Veste', color: '#2f4f6f' },
  ],
  hair: [
    { value: 'default', label: 'Brun', color: '#3a3230' },
    { value: 'blond', label: 'Blond', color: '#d8b878' },
    { value: 'red', label: 'Roux', color: '#a5502e' },
  ],
  skin: [
    { value: 'default', label: 'Clair', color: '#e8c39e' },
    { value: 'medium', label: 'Mat', color: '#c08b5c' },
    { value: 'dark', label: 'Foncé', color: '#8a5a3b' },
  ],
} as const;

type OptionGroup = keyof typeof OPTIONS;

const GROUP_LABELS: Record<OptionGroup, string> = {
  outfit: 'Tenue',
  hair: 'Cheveux',
  skin: 'Teint',
};

/**
 * Avatar customisation.
 *
 * Kept to three swatch rows rather than a 3D preview: the avatar is already
 * visible in the world, and a second WebGL context on the profile page would
 * cost more than it teaches.
 */
export function AvatarStudio() {
  const queryClient = useQueryClient();
  const avatar = useQuery({ queryKey: ['avatar'], queryFn: studentService.avatar });
  const [draft, setDraft] = React.useState<AvatarPayload>({});

  const current = { ...avatar.data, ...draft };
  const dirty = Object.keys(draft).length > 0;

  const save = useMutation({
    mutationFn: () => studentService.updateAvatar(draft),
    onSuccess: () => {
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ['avatar'] });
      void queryClient.invalidateQueries({ queryKey: ['student'] });
      void queryClient.invalidateQueries({ queryKey: ['world'] });
      toast.success('Avatar mis à jour.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>Votre apparence dans le monde 3D.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {avatar.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {(Object.keys(OPTIONS) as OptionGroup[]).map((group) => (
              <fieldset key={group}>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {GROUP_LABELS[group]}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {OPTIONS[group].map((option) => {
                    const selected = current[group] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setDraft((previous) => ({ ...previous, [group]: option.value }))
                        }
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          selected
                            ? 'border-ink-900 bg-ink-50 text-ink-900'
                            : 'border-ink-200 text-ink-600 hover:bg-ink-50',
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-4 w-4 rounded-full border border-ink-200"
                          style={{ backgroundColor: option.color }}
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="flex justify-end">
              <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Enregistrement…' : 'Enregistrer l’avatar'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
