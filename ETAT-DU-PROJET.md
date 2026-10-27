# STOUDENT — état du projet

> Le mini réseau social d'entraide des étudiants **de toutes les filières du BTS**.
> Concept : `STOUDENT_note_de_concept_MVP.docx`. Backed by Kortex.

Point d'avancement au **28 octobre 2026**. En production sur
**https://stoudent.kortex.sbs** (Dokploy, images GHCR). Ce document décrit ce
qui tourne, comment c'est déployé, ce qui reste à faire et les décisions prises.

---

## 1. En une phrase

Un étudiant s'inscrit avec son numéro WhatsApp et sa filière, pose une question
(avec la photo de l'exercice et des formules), reçoit des réponses votées
(👍 Utile), choisit la meilleure, remercie (🙏 Merci), est prévenu une fois sur
WhatsApp quand on lui répond, et reste connecté sur son téléphone. Le labo
virtuel 3D (ex-SignalLab) est inclus sous l'onglet **Lab**.

Le périmètre MVP de la note de concept est couvert, ressources mises à part
(fermées au lancement, voir §6).

---

## 2. Ce qui fonctionne

### Comptes

| | |
|---|---|
| **Inscription** | Numéro WhatsApp (identifiant), pseudo public, **filière obligatoire**, établissement et niveau facultatifs, « étudiant » ou « professeur ». E-mail facultatif (les admins se connectent par e-mail). |
| **Vérification** | Code WhatsApp à l'inscription via gowa, porté de shaapi (`OTP_ENABLED`). Quota d'envois par numéro. |
| **Session** | Seul un jeton est gardé dans le navigateur, jamais le mot de passe. Cookie httpOnly de 60 jours, renouvelé à chaque visite : ouvrir un lien STOUDENT reconnecte. Une session par appareil. |
| **Mot de passe oublié** | Code WhatsApp dédié, même réponse que le numéro existe ou non. Toutes les sessions sont fermées après le changement. |
| **Profil > compte** | Changer son mot de passe (les autres appareils sont déconnectés), ajouter ou changer son numéro (code envoyé au nouveau), **supprimer son compte**. |
| **Consentement WhatsApp** | Case décochée par défaut, horodatée, révocable dans le profil. |

### Communauté

- **Fil de questions** : filtres filière, matière et tag, recherche plein texte
  en français, tris (récentes, mieux notées, actives, sans réponse). Lecture
  publique, écriture connectée.
- **Poser une question** : titre, détail, filière, matière, tags, **photo de
  l'exercice** (prise depuis le téléphone, réencodée en JPEG, position GPS
  retirée). Questions similaires proposées pendant la saisie du titre.
- **Formules** : `$…$` dans le texte, `$$…$$` centrée (KaTeX). Code entre ```.
- **Réponses** : 👍 Utile (vote négatif discret), 🙏 Merci, meilleure réponse
  choisie par l'auteur, « Validée par un professeur ».
- **Modifier / supprimer** : sa question (tant qu'elle n'a pas de réponse pour
  la suppression), sa réponse (la réputation gagnée est retirée). Mention
  « modifiée ».
- **Partager sur WhatsApp** sur chaque question.
- **Réputation** : +5 par 👍 sur une question, +10 sur une réponse, +15 pour la
  meilleure réponse, +2 par Merci ; un vote négatif retire 1 ou 2. Toutes les
  variations sont réversibles.
- **Signalements** : un contenu signalé par 3 membres est masqué en attendant
  la modération.

### Notifications

- **Sur le site** : cloche 🔔 avec compteur (nouvelle réponse, meilleure
  réponse, validation prof, merci). Ouvrir la cloche marque tout comme lu.
- **Sur WhatsApp** : un seul message court, *« STOUDENT : quelqu'un a répondu à
  ta question « … » »* + le lien. **Une fois par question**, à la première
  réponse, pour les membres qui ont donné leur accord. Plafond de 3 messages par
  heure et par personne, pour protéger le numéro gowa.

### Professeurs et modération (SignManager)

- Se déclarer professeur ne donne aucun droit. Un admin attribue le rôle
  **professeur vérifié** dans SignManager ; il débloque « Valider (prof) ».
- SignManager : membres (recherche par pseudo, numéro, e-mail ; filière ;
  « infos WhatsApp ✓ »), activation des comptes, rôles, **onglet Modération**
  (masquer, rejeter, rétablir), suivi du labo.

### Landing et identité

Noir et blanc, couleurs Kortex (comme security.kortex.sbs), animations GSAP
portées de shaapi, « Backed by Kortex ». La démo animée fait tourner une
question IDA, FC et RIT ; une section « Exemples » montre des questions types
par filière et matière (RIT, IDA, FC). Pages `/regles` et `/confidentialite`.

**Filières** (`client/lib/community.ts`) : RIT, IDA, ELT, SEI, MSP, FC, GC,
RHC, LOG, AD. Un membre peut en saisir une autre.

---

## 3. Architecture

```
signlab/                       dépôt github.com/Shalom-302/stoudent
├── sign/                      API  FastAPI (socle shaapi) · PostgreSQL · Redis · MinIO
│   └── backend/
│       ├── app/client/        API publique (/api/v1) : auth, community, labs…
│       ├── app/admin/         back-office (/admin/api/v1) : SignManager, moderation
│       ├── models/            community.py (questions, réponses, votes, notifications…)
│       ├── seeder/            signallab.py (labos), demo.py (comptes de démo)
│       └── services/          moteur scientifique du labo
├── client/                    web  Next.js 15 · Tailwind 4 · GSAP · KaTeX · React Three Fiber
│   ├── app/(community)/       questions, confidentialité, règles
│   ├── app/api, app/admin/api relais vers l'API (lib/server/proxy.ts)
│   └── components/            community/, landing/, student/, world3d/…
├── compose.image.yml          production Dokploy
└── .github/workflows/build.yml  images GHCR à chaque push sur main
```

**Le navigateur ne parle qu'au site.** Le serveur Next relaie `/api/v1` et
`/admin/api/v1` vers `API_INTERNAL_URL`, lu au démarrage et non figé à la build :
une même image sert n'importe quel domaine, et le cookie de session reste sur le
domaine du site. L'API n'a pas de domaine public.

**Photos** : stockées dans MinIO sous un nom aléatoire, servies par l'API
(`/api/v1/community/uploads/<nom>.jpg`). MinIO n'est jamais exposé.

---

## 4. Déploiement

### Chaîne

`git push` sur `main` → GitHub Actions construit `ghcr.io/shalom-302/stoudent`
(API) et `ghcr.io/shalom-302/stoudent-web` (client) → **Deploy** dans Dokploy
(projet Compose sur `compose.image.yml`).

### Variables Dokploy (onglet Environment)

| Variable | Rôle |
|---|---|
| `PUBLIC_DOMAIN` | `stoudent.kortex.sbs` (sert aussi aux liens envoyés sur WhatsApp) |
| `TOKEN_SECRET_KEY`, `OPERA_LOG_ENCRYPT_SECRET_KEY` | Secrets, à générer une fois |
| `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY` | Mots de passe des services (MinIO : 8 caractères min.) |
| `OTP_ENABLED`, `GOWA_URL`, `GOWA_BASIC_USER`, `GOWA_BASIC_PASS` | WhatsApp, mêmes valeurs que shasec |

Si une variable obligatoire manque, le compose refuse de démarrer et la nomme.
En production, l'API refuse aussi de démarrer avec les valeurs de dev
(`postgres`, `minioadmin`…).

Domaine : **`stoudent.kortex.sbs` → service `web`, port 3000**, HTTPS.
L'API rejoint le réseau `whatsapp-shared-network` pour joindre gowa
(`http://shalom-gowa:3080`).

### Commandes sur le VPS

```bash
API=shalom-stoudent-ap4f77-api-1
docker exec $API python -m backend.cli seed-labs      # TP du labo (idempotent)
docker exec $API python -m backend.cli seed-demo      # 6 comptes de démo + 12 questions (idempotent)
docker exec $API python -m backend.cli create-admin \
    --email admin@stoudent.kortex.sbs --password '…' --pseudo stoudent.admin
```

**Comptes de démo** : un par filière (`yao.rit`, `awa.ida`, `kone.elt`,
`fatou.sei`, `bamba.msp`, `marie.fc`), deux questions chacun. Leurs numéros
sont dans la plage `225 00…`, attribuée à aucun opérateur.

### Lancer en local

```bash
cd sign && docker compose up -d          # API sur :8000, migrations au démarrage
cd client && npm install && npm run dev  # site sur :3000, relaie vers :8000
```

> Ne pas lancer `next build` pendant que `next dev` tourne : utiliser
> `NEXT_DIST_DIR=.next-check npx next build`.

---

## 5. Sécurité et données personnelles

| Mesure | Détail |
|---|---|
| Numéros jamais publics | Visibles par leur propriétaire (profil) et les admins (SignManager) uniquement. Vérifié sur le fil public. |
| Pas d'énumération de comptes | Numéro inconnu et mauvais mot de passe : même réponse. Idem pour « mot de passe oublié ». |
| Force brute | Limite par IP **et** blocage du compte 15 min après 8 mots de passe faux. |
| Mots de passe | bcrypt, politique 10 caractères et deux types de caractères. |
| Jetons | PyJWT, `jti` unique, révocables (Redis), rotation du jeton de rafraîchissement. |
| Changements sensibles | Mot de passe actuel exigé pour changer de mot de passe, de numéro ou supprimer le compte. |
| Photos | Réencodées (un faux fichier image est refusé), EXIF et GPS retirés, 8 Mo max, aucune URL externe acceptée. |
| Formules | KaTeX avec `trust` désactivé : seul le rendu KaTeX est injecté, le texte des membres reste du texte. |
| Suppression de compte | Numéro, pseudo, e-mail, profil, consentement et journaux de connexion effacés ; les messages restent sous « Membre supprimé ». |
| Infrastructure | En-têtes de sécurité, hôtes de confiance, Postgres et MinIO non exposés, refus de démarrer avec des secrets de dev. |

La politique de confidentialité (`/confidentialite`) décrit tout cela. Contact
données : `contact@kortex.sbs` (constante `PRIVACY_CONTACT`, à confirmer).

---

## 6. Décisions et écarts assumés

- **Ressources fermées au lancement.** Le module (liens attribués par filière)
  est codé et testé, mais caché : page redirigée, API en 404 tant que
  `COMMUNITY_RESOURCES_ENABLED=false`. Le code est dans
  `client/components/community/resources-view.tsx`.
- **WhatsApp volontairement rare.** Un message par question, jamais pour les
  votes, merci, validations : tout le reste passe par la cloche. Objectif : ne
  pas être perçu comme du spam, et ne pas faire bannir le numéro gowa.
- **Suppression = anonymisation.** Effacer une question détruirait les réponses
  des autres ; les données personnelles, elles, disparaissent.
- **Plus aucune mention de SignalLab** côté utilisateur : les labos s'appellent
  « Labo Signal » et « Labo Télécom ». Le nom subsiste dans du code interne
  (dossiers, identifiants), invisible.
- **Noir et blanc Kortex** plutôt que le jaune initial (choix de marque).

---

## 7. Tests

Tous reproductibles, lancés avant chaque push :

| Suite | Contenu | Dernier passage |
|---|---|---|
| API communauté | inscription, questions, réponses, votes, réputation, signalements, ressources fermées | 34/34 |
| API sessions | cookie seul, rotation, multi-appareils, mot de passe oublié, blocage | 18/18 |
| API fonctions | photos, notifications, merci, modification, suppression | 21/21 |
| API compte | mot de passe, numéro, suppression et anonymisation | 21/21 |
| Navigateur (Playwright) | parcours complet, nouvelles fonctions, compte, session, absence de « SignalLab » | tout vert, 0 erreur console |
| Base neuve | migrations + création des tables + `seed-demo` sur une base vide, comme en production | OK |
| WhatsApp | faux serveur gowa : 1 message à la 1re réponse, 0 à la 2e, 0 sans accord | OK |

Bugs trouvés par ces tests et corrigés : rafraîchissement de session qui
n'avait jamais marché depuis le navigateur, jetons identiques dans la même
seconde, réputation bloquée à 0, vues comptées plusieurs fois, migrations qui
plantaient sur une base neuve, verrou SQL incompatible avec une jointure.

---

## 8. Ce qui reste

### Reporté volontairement

- [ ] **Sauvegardes automatiques de Postgres** (Dokploy, vers un stockage
      externe) : à mettre en place quand le trafic le justifiera.
- [ ] Déclaration ARTCI (base de numéros de téléphone).
- [ ] Confirmer l'adresse de contact données (`PRIVACY_CONTACT`).

### Prochaines fonctions

- [ ] Profil public d'un membre (questions, réponses, réputation)
- [ ] Classement des entraideurs par filière
- [ ] Fil « Ma filière » par défaut, questions sans réponse en premier
- [ ] Suivre une question
- [ ] Commentaires courts sous une réponse
- [ ] Référencement Google (pages de questions rendues côté serveur)

### Plus tard (note de concept)

Assistant IA (payant, avec quota gratuit), messagerie privée, application
mobile, réouverture des ressources, envois WhatsApp groupés (examens) aux
membres consentants, à rythme limité.

---

## 9. Où regarder

| Sujet | Fichier |
|---|---|
| Questions, réponses, votes, merci | `sign/backend/app/client/service/community_service.py` |
| Notifications et WhatsApp | `sign/backend/app/client/service/notify_service.py` |
| Codes WhatsApp (gowa) | `sign/backend/app/client/service/otp_service.py` |
| Photos | `sign/backend/app/client/service/upload_service.py` |
| Compte (mot de passe, numéro, suppression) | `sign/backend/app/client/service/account_service.py` |
| Connexion, sessions, blocage | `sign/backend/app/admin/service/auth_service.py` |
| Modèles communauté | `sign/backend/models/community.py` |
| Comptes de démo | `sign/backend/seeder/demo.py` |
| Réglages (OTP, WhatsApp, photos, ressources) | `sign/backend/core/conf.py` |
| Filières, exemples, contact | `client/lib/community.ts`, `client/components/landing/example-questions.tsx` |
| Page question, formulaire | `client/app/(community)/questions/`, `client/components/community/` |
| Relais vers l'API | `client/lib/server/proxy.ts` |
| Production | `compose.image.yml`, `.github/workflows/build.yml` |

---

# Annexe — le labo virtuel (onglet Lab)

Ex-SignalLab, intégré à STOUDENT sans changement de fond. Point d'avancement du
labo au **18 septembre 2026**, toujours valable.

## A. En une phrase

Un étudiant entre dans une salle de TP en 3D, pilote son avatar jusqu'à un
poste, y ouvre un TP sans quitter la salle, règle des instruments dont les
écrans affichent la vraie courbe calculée par le moteur scientifique, se fait
noter **sur ce qu'il a manipulé**, gagne de l'XP et des badges.

## B. Le contrat 3D ↔ simulation

Le 3D (React Three Fiber) **ne calcule rien** : il affiche ce que FastAPI a
renvoyé. Toute la physique du signal est en Python (NumPy / SciPy / SymPy).

```
Étudiant → manipulation 3D → paramètres → FastAPI → NumPy/SciPy/SymPy
                                                         ↓
              écran de l'instrument  ←  Three.js  ←  résultats
```

## C. Ce qui fonctionne

**Moteur scientifique** : six services purs (`sign/backend/services/`),
**41 contrôles de physique** passent (fondamentale d'un carré `4A/π`,
Butterworth −3 dB à la coupure et −80 dB/décade à l'ordre 4, repliement 5 kHz
@ 6 kHz → 1 kHz, résolution 50 Hz sur 20 ms, pôle d'un RC). Une expression
Laplace malveillante est refusée (400), une demande de 10⁸ échantillons aussi
(422).

**Parcours** : 5 TP publiés (signaux élémentaires, série de Fourier,
transformée de Fourier, échantillonnage, filtrage) ; convolution et Laplace
seedés mais non publiés. Chaque TP : rappel de cours, exemple résolu en
6 étapes, protocole, **jalons de manipulation**, questions de lecture.

**Salle 3D** aux cotes de la spécification (12 × 10 × 3,20 m, 4 postes, baie
42U, grand écran, tableau blanc). Avatar piloté comme dans un jeu (3ᵉ/1ʳᵉ
personne, ZQSD/flèches, manche virtuel, collisions).

## D. Décisions

- **React Three Fiber au lieu de Babylon.js** : meilleure maquette, Babylon
  retiré. React épinglé en `~19.2.0` (`@react-three/fiber@9` exige `< 19.3`).
- **La formule est donnée avant la manipulation**, avec un exercice corrigé ;
  la synthèse est débloquée à la fin.
- **La note vient du geste** : 60 à 75 % des points viennent du banc. Un jalon
  atteint reste acquis ; conditions déclaratives, jamais évaluées.

## E. Ce qui reste pour le labo

- [ ] Test automatisé de l'ouverture d'un poste dans la salle 3D
- [ ] Brancher les écrans des instruments de la salle sur l'API (synthèse
      locale aujourd'hui)
- [ ] Tests unitaires du moteur de jalons et de la notation
- [ ] Publier convolution et Laplace (changement de drapeau)
- [ ] Labo Télécom (PABX, SIP, VoIP, GSM), labos pour d'autres filières
- [ ] Assets Blender à la place de la géométrie procédurale (`useGLTF`)

| Sujet | Fichier |
|---|---|
| Cotes de la salle (source unique) | `client/lib/lab3d/specs.ts` |
| Pilotage de l'avatar | `client/components/world3d/Player.tsx` |
| Poste de travail en salle | `client/components/world3d/StationPanel.tsx` |
| Contenu pédagogique | `sign/backend/seeder/signallab.py` |
| Notation par la manipulation | `sign/backend/app/client/service/milestones.py` |
| Moteur scientifique | `sign/backend/services/` |
