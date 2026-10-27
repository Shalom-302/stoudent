'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { AvatarStudio } from '@/components/student/avatar-studio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BTS_FILIERES } from '@/lib/community';
import { studentService, type UpdateProfilePayload } from '@/services/student';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['student'], queryFn: studentService.me });
  const [form, setForm] = React.useState<UpdateProfilePayload>({});
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!profile.data || dirty) return;
    setForm({
      firstname: profile.data.firstname,
      lastname: profile.data.lastname,
      institution: profile.data.institution,
      level: profile.data.level,
      filiere: profile.data.filiere,
      whatsapp_opt_in: profile.data.whatsapp_opt_in,
      bio: profile.data.bio,
    });
  }, [profile.data, dirty]);

  const save = useMutation({
    mutationFn: () => studentService.updateMe(form),
    onSuccess: () => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['student'] });
      toast.success('Profil mis à jour.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof UpdateProfilePayload) => (value: string) => {
    setDirty(true);
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  if (profile.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {profile.data?.pseudo ?? 'Profil'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {profile.data?.phone ? `+${profile.data.phone}` : profile.data?.email}
          {profile.data?.member_type === 'teacher' && ' · Professeur'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-xl bg-ink-900 px-4 py-2">
            <p className="font-display text-xl font-semibold text-white">{profile.data?.reputation ?? 0}</p>
            <p className="text-[11px] text-white/70">réputation STOUDENT</p>
          </div>
          <div className="rounded-xl bg-ink-50 px-4 py-2">
            <p className="font-display text-xl font-semibold text-ink-900">{profile.data?.total_xp ?? 0}</p>
            <p className="text-[11px] text-ink-500">XP labo</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Votre filière et votre niveau apparaissent à côté de votre pseudo sur vos questions et réponses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstname">Prénom</Label>
                <Input
                  id="firstname"
                  value={form.firstname ?? ''}
                  onChange={(event) => set('firstname')(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastname">Nom</Label>
                <Input
                  id="lastname"
                  value={form.lastname ?? ''}
                  onChange={(event) => set('lastname')(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filiere">Filière</Label>
                <Input
                  id="filiere"
                  list="profile-filieres"
                  value={form.filiere ?? ''}
                  onChange={(event) => set('filiere')(event.target.value)}
                  maxLength={100}
                />
                <datalist id="profile-filieres">
                  {BTS_FILIERES.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="institution">Établissement</Label>
                <Input
                  id="institution"
                  value={form.institution ?? ''}
                  onChange={(event) => set('institution')(event.target.value)}
                  placeholder="Lycée / IUT / centre de formation"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="level">Niveau d’études</Label>
                <Input
                  id="level"
                  value={form.level ?? ''}
                  onChange={(event) => set('level')(event.target.value)}
                  placeholder="BTS RIT 1re année"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-200 p-3 text-sm text-ink-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-ink-900"
                checked={Boolean(form.whatsapp_opt_in)}
                onChange={(event) => {
                  setDirty(true);
                  setForm((previous) => ({ ...previous, whatsapp_opt_in: event.target.checked }));
                }}
              />
              <span>
                <span className="font-medium text-ink-900">Infos STOUDENT sur WhatsApp</span>
                <br />
                Un message quand quelqu’un répond à votre question (une fois par question), et les
                dates d’examens. Votre numéro n’est jamais affiché ni partagé.
              </span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio ?? ''}
                onChange={(event) => set('bio')(event.target.value)}
                maxLength={1000}
                placeholder="Quelques mots sur vous."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!dirty || save.isPending}>
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AvatarStudio />
    </div>
  );
}
