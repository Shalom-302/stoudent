'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Radio } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { labService } from '@/services/labs';

const SLUG = 'telecom-lab';

const ROADMAP = [
  { version: 'V0.5', body: 'Labo Télécom : PABX, SIP, VoIP, puis GSM.' },
  { version: 'V1', body: 'Laboratoires collaboratifs, sessions de classe, campus virtuel RIT.' },
];

/** Labo Télécom preview — visible from day one, playable later (section 12). */
export default function TelecomLaboPage() {
  const lab = useQuery({ queryKey: ['lab', SLUG], queryFn: () => labService.detail(SLUG) });

  const equipment = lab.data?.scene_config?.equipment ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
        <Link href="/labs">
          <ArrowLeft className="h-4 w-4" />
          Tous les laboratoires
        </Link>
      </Button>

      {lab.isLoading || !lab.data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <header className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
              <Radio className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
                  {lab.data.name}
                </h1>
                <Badge variant="outline">Bientôt disponible</Badge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-500">
                {lab.data.scene_config?.locked_message ??
                  'Simulation téléphonie / PABX / GSM — bientôt disponible'}
              </p>
            </div>
          </header>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Zone de découverte</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 flex flex-wrap items-center gap-2 font-mono text-sm text-ink-600">
                <span>Téléphone</span>
                <span aria-hidden className="text-ink-300">→</span>
                <span>BTS</span>
                <span aria-hidden className="text-ink-300">→</span>
                <span>Réseau</span>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {equipment.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-500">
                Ces équipements sont déjà visibles dans le monde 3D. Ils deviendront
                manipulables lorsque le laboratoire ouvrira.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Feuille de route</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {ROADMAP.map((entry) => (
                  <li key={entry.version} className="flex gap-3">
                    <Badge variant="accent" className="h-fit shrink-0">
                      {entry.version}
                    </Badge>
                    <p className="text-sm text-ink-600">{entry.body}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
