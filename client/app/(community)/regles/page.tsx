import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Règles de la communauté' };

const RULES = [
  {
    title: 'L’entraide reste gratuite',
    text: 'Poser une question, répondre, partager une ressource : tout ce qui sert l’entraide est et restera gratuit. Pas de vente de corrigés, pas de publicité.',
  },
  {
    title: 'Toutes les filières sont les bienvenues',
    text: 'RIT, IDA, Télécoms, Gestion ou une autre : indiquez votre filière et votre niveau pour que les bonnes personnes vous répondent.',
  },
  {
    title: 'On explique le raisonnement',
    text: 'Une bonne réponse donne la méthode et les étapes, pas seulement le résultat. Le but est que l’autre sache refaire l’exercice seul.',
  },
  {
    title: 'On cherche avant de demander',
    text: 'Utilisez la recherche : votre question a peut-être déjà une réponse. Sinon, montrez ce que vous avez essayé.',
  },
  {
    title: 'On respecte les sources',
    text: 'Une ressource partagée garde son titre, son lien et son auteur ou organisme d’origine. On partage le lien, on ne recopie pas le contenu.',
  },
  {
    title: 'On reste courtois',
    text: 'Pas d’insultes, de moqueries ni de spam. Un contenu qui ne respecte pas ces règles peut être signalé : après plusieurs signalements, il est masqué en attendant la modération.',
  },
  {
    title: 'Les professeurs ont leur mot à dire',
    text: 'Les professeurs vérifiés peuvent valider une réponse juste. Ce badge ne remplace pas les votes, il les éclaire.',
  },
];

export default function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">STOUDENT</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Règles de la communauté</h1>
      <p className="mt-3 text-ink-500">Simples, parce qu’on est là pour apprendre ensemble.</p>
      <ol className="mt-10 space-y-6">
        {RULES.map((rule, i) => (
          <li key={rule.title} className="flex gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-900 font-display font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">{rule.title}</h2>
              <p className="mt-1 text-ink-600">{rule.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/questions" className="btn-primary mt-12">
        Aller au fil des questions
      </Link>
    </div>
  );
}
