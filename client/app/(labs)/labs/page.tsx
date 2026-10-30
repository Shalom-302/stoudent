'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Calculator, Construction, MapPin, Truck, Zap } from 'lucide-react';
import Link from 'next/link';

import { LabCard } from '@/components/labs/lab-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { labService } from '@/services/labs';

/** Labs announced for other filières: shown so students know theirs is coming. */
const COMING = [
  { filiere: 'ELT', title: 'Poste de transformation', body: 'Cellules HTA, transformateur, protections : du réseau au tableau.', icon: Zap },
  { filiere: 'GBAT', title: 'Chantier de construction', body: 'Implantation, ferraillage, coffrage, lecture de plans sur site.', icon: Construction },
  { filiere: 'LOG', title: 'Entrepôt et quai', body: 'Réception, stockage, préparation de commandes, flux de transport.', icon: Truck },
  { filiere: 'FCGE', title: 'Agence bancaire', body: 'Opérations de guichet, comptes, crédit : la comptabilité en situation.', icon: Calculator },
  { filiere: 'GEC', title: 'Rue commerçante', body: 'Vitrines, prix, enquête terrain : le marketing dans le quartier.', icon: Building2 },
] as const;

export default function LabsPage() {
  const labs = useQuery({ queryKey: ['labs'], queryFn: labService.list });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Laboratoires</h1>
      <p className="mt-1 text-sm text-ink-500">
        En salle de TP ou dehors, dans le quartier : manipule, mesure, et apprends ce que tu verras en stage.
      </p>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-ink-400">Dehors</h2>
      <Link
        href="/terrain"
        className="group mt-3 block overflow-hidden rounded-[var(--radius-card)] border border-ink-900 bg-ink-900 p-5 text-white transition-colors hover:bg-ink-800"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <Badge className="bg-[#f2b705] text-ink-900">Nouveau · RIT</Badge>
        </div>
        <h3 className="mt-4 text-lg font-semibold">Labo Terrain · Télécoms</h3>
        <p className="mt-1.5 max-w-xl text-sm text-white/75">
          Promène-toi dans un quartier et découvre les télécoms qui l’entourent : pylône de faisceau hertzien, point de
          concentration fibre, armoire de rue, chambre de tirage, relais GSM. Missions calculées : bilan de liaison,
          budget optique.
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-sm font-medium">
          Sortir dans le quartier
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </p>
      </Link>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-ink-400">En salle de TP</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {labs.isLoading
          ? [0, 1].map((key) => <Skeleton key={key} className="h-56" />)
          : labs.data?.map((lab) => <LabCard key={lab.slug} lab={lab} />)}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-ink-400">Pour les autres filières</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMING.map(({ filiere, title, body, icon: Icon }) => (
          <div key={filiere} className="rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-ink-50 p-4" aria-disabled>
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-400">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <Badge variant="outline">{filiere}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-700">{title}</h3>
            <p className="mt-1 text-xs text-ink-500">{body}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Labo en cours de développement</p>
          </div>
        ))}
      </div>
    </div>
  );
}
