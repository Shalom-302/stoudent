'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * What a student from each filière actually finds on STOUDENT: one tab per
 * filière, its matières, and typical questions. Illustrative examples, labelled
 * as such on the page.
 */
const EXAMPLES = [
  {
    code: 'RIT',
    name: 'Réseaux Informatiques et Télécommunications',
    subjects: [
      {
        name: 'Traitement du signal',
        questions: [
          'Pourquoi faut-il fe > 2·fmax pour échantillonner sans repliement ?',
          'Quelle différence entre un filtre passe-bas et un passe-bande ?',
        ],
      },
      {
        name: 'GSM',
        questions: [
          'À quoi sert le HLR par rapport au VLR dans un réseau GSM ?',
          'Comment se déroule un handover entre deux BTS ?',
        ],
      },
      {
        name: 'Transmission',
        questions: [
          'Pourquoi préférer la modulation QAM à l’ASK en haut débit ?',
          'Quelle atténuation pour 20 km de fibre à 0,2 dB/km ?',
        ],
      },
    ],
  },
  {
    code: 'IDA',
    name: 'Informatique Développeur d’Application',
    subjects: [
      {
        name: 'Algorithmique',
        questions: [
          'Comment écrire une recherche dichotomique en pseudo-code ?',
          'Quand utiliser une boucle Pour plutôt qu’une boucle TantQue ?',
        ],
      },
      {
        name: 'Merise',
        questions: [
          'Comment passer du MCD au MLD avec une association n,n ?',
          'Que signifie une cardinalité 0,n côté client ?',
        ],
      },
      {
        name: 'Bases de données',
        questions: [
          'Quelle requête SQL pour compter les commandes par client ?',
          'À quoi sert une clé étrangère, et que se passe-t-il à la suppression ?',
        ],
      },
    ],
  },
  {
    code: 'FC',
    name: 'Finance Comptabilité',
    subjects: [
      {
        name: 'Comptabilité générale',
        questions: [
          'Comment enregistrer au journal l’achat d’un véhicule de société ?',
          'Quelle différence entre une charge et une immobilisation ?',
        ],
      },
      {
        name: 'Fiscalité',
        questions: [
          'Comment calculer la TVA à décaisser du mois ?',
          'Comment retrouver le HT d’une facture de 590 000 F TTC ?',
        ],
      },
      {
        name: 'Analyse financière',
        questions: [
          'Comment calculer le fonds de roulement à partir du bilan ?',
          'Que signifie un BFR négatif pour l’entreprise ?',
        ],
      },
    ],
  },
] as const;

export function ExampleQuestions() {
  const [active, setActive] = React.useState(0);
  const filiere = EXAMPLES[active];

  return (
    <section id="exemples" className="examples mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
      <div className="reveal max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">Exemples</p>
        <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
          Voici le genre de questions que vous trouverez sur STOUDENT.
        </h2>
        <p className="mt-4 text-lg text-ink-500">
          Chaque filière a ses matières. Choisissez la vôtre.
        </p>
      </div>

      <div className="reveal mt-10">
        <div role="tablist" aria-label="Filières" className="flex flex-wrap gap-2">
          {EXAMPLES.map((f, i) => (
            <button
              key={f.code}
              role="tab"
              id={`tab-${f.code}`}
              aria-selected={active === i}
              aria-controls={`panel-${f.code}`}
              onClick={() => setActive(i)}
              className={cn(
                'rounded-full border px-5 py-2.5 text-sm font-semibold transition',
                active === i ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 hover:border-ink-900',
              )}
            >
              {f.code}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-500">{filiere.name}</p>

        <div
          role="tabpanel"
          id={`panel-${filiere.code}`}
          aria-labelledby={`tab-${filiere.code}`}
          className="mt-6 grid gap-4 md:grid-cols-3"
        >
          {filiere.subjects.map((subject) => (
            <div key={subject.name} className="rounded-2xl border border-ink-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">{subject.name}</p>
              <ul className="mt-3 space-y-3">
                {subject.questions.map((q) => (
                  <li key={q} className="font-medium leading-snug text-ink-900">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-400">
            Exemples illustratifs. Et aussi : ELT, SEI, MSP, Gestion commerciale, Logistique…
          </p>
          <Link
            href={`/questions?filiere=${encodeURIComponent(filiere.code)}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            Voir les questions {filiere.code} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
