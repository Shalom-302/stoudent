import type { Metadata } from 'next';
import Link from 'next/link';

import { PRIVACY_CONTACT } from '@/lib/community';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

const UPDATED = '28 octobre 2026';

/**
 * Written from what the code actually does (sign-up fields, WhatsApp use,
 * logs, deletion). Change the code, change this page.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Qui est responsable',
    body: (
      <>
        STOUDENT est édité par Kortex. Pour toute question sur vos données, écrivez à{' '}
        <a href={`mailto:${PRIVACY_CONTACT}`} className="font-semibold underline underline-offset-4">
          {PRIVACY_CONTACT}
        </a>
        .
      </>
    ),
  },
  {
    title: 'Ce que nous collectons',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Votre numéro WhatsApp</b> : il sert d’identifiant de connexion et à vous envoyer les codes de
          vérification.
        </li>
        <li>
          <b>Votre pseudo, votre filière</b>, et si vous les donnez votre établissement, votre niveau et une courte
          bio.
        </li>
        <li>
          <b>Votre mot de passe</b>, jamais en clair : nous n’en gardons qu’une empreinte chiffrée (bcrypt).
        </li>
        <li>
          <b>Ce que vous publiez</b> : questions, réponses, photos d’exercices, votes et signalements. La position
          GPS contenue dans les photos est supprimée à l’envoi.
        </li>
        <li>
          <b>Des journaux de sécurité</b> : adresse IP, navigateur et date des connexions, pour détecter les abus.
        </li>
      </ul>
    ),
  },
  {
    title: 'Ce que voient les autres membres',
    body: (
      <>
        Votre pseudo, votre filière, votre niveau, votre réputation et ce que vous publiez. <b>Votre numéro n’est
        jamais affiché</b> aux autres membres. Seuls les administrateurs de STOUDENT y ont accès, pour la modération
        et le support.
      </>
    ),
  },
  {
    title: 'WhatsApp',
    body: (
      <>
        Sans votre accord, nous n’utilisons votre numéro que pour les codes de vérification (inscription, mot de
        passe oublié, changement de numéro). Si vous cochez « Infos STOUDENT sur WhatsApp », vous recevez aussi un
        message quand quelqu’un répond à votre question (une seule fois par question) et des informations utiles
        comme les dates d’examens. Vous pouvez retirer cet accord à tout moment dans votre profil. Nous ne vendons
        ni ne transmettons votre numéro à personne.
      </>
    ),
  },
  {
    title: 'Combien de temps',
    body: (
      <>
        Vos données sont gardées tant que votre compte existe. Les codes de vérification expirent en 10 minutes.
        Quand vous supprimez votre compte, vos données personnelles sont effacées immédiatement (voir ci-dessous).
      </>
    ),
  },
  {
    title: 'Vos droits',
    body: (
      <>
        Vous pouvez consulter et corriger vos informations dans votre{' '}
        <Link href="/profile" className="font-semibold underline underline-offset-4">
          profil
        </Link>
        , changer votre numéro et votre mot de passe, et <b>supprimer votre compte</b> vous-même. La suppression efface
        votre numéro, votre pseudo, votre e-mail, vos informations de profil, votre accord WhatsApp et vos journaux
        de connexion. Vos questions et réponses restent en ligne sous « Membre supprimé », sans rien qui vous
        identifie, parce qu’elles contiennent aussi les réponses d’autres membres. Pour toute autre demande,
        écrivez-nous à l’adresse ci-dessus. Vous pouvez aussi saisir l’ARTCI, l’autorité ivoirienne de protection
        des données personnelles.
      </>
    ),
  },
  {
    title: 'Sécurité',
    body: (
      <>
        Connexion chiffrée (HTTPS), mots de passe chiffrés, blocage du compte après plusieurs mots de passe faux,
        sessions révocables, et un serveur dont la base de données n’est pas exposée sur Internet.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-400">STOUDENT</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Politique de confidentialité</h1>
      <p className="mt-3 text-ink-500">Ce que nous faisons de vos données, en clair. Mise à jour le {UPDATED}.</p>
      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl font-semibold">{section.title}</h2>
            <div className="mt-2 leading-relaxed text-ink-700">{section.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
