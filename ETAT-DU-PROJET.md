# STOUDENT — état du projet

> Le mini réseau social d'entraide des étudiants **de toutes les filières du BTS**.
> Concept : `STOUDENT_note_de_concept_MVP.docx`. Backed by Kortex.

Point d'avancement au **30 octobre 2026**. En production sur
**https://stoudent.kortex.sbs** (Dokploy, images GHCR). Ce document décrit ce
qui tourne, comment c'est déployé, ce qui reste à faire et les décisions prises.

---

## 1. En une phrase

Un étudiant s'inscrit avec son numéro WhatsApp et sa filière, pose une question
(avec la photo de l'exercice et des formules), reçoit des réponses votées
(👍 Utile), choisit la meilleure, remercie (🙏 Merci), est prévenu une fois sur
WhatsApp quand on lui répond, et reste connecté sur son téléphone. Le labo
virtuel 3D (ex-SignalLab) est inclus sous l'onglet **Lab**.

Il prépare aussi ses examens dans la **Bibliothèque BTS** : le programme
officiel de sa filière (épreuves et coefficients du MESRS) et, pour chaque
épreuve, les sujets, corrigés, cours et TD qui la préparent (1 230 documents,
source citée). L'équipe annonce les nouveautés par **WhatsApp** depuis
SignManager, aux seuls membres qui l'ont accepté.

Côté labo, il sort de la salle : le **Labo Terrain** (`/terrain`) est un quartier
où il découvre les télécoms de la rue (faisceau hertzien, fibre, relais GSM)
avec des missions calculées par le moteur scientifique.

Le périmètre MVP de la note de concept est couvert, ressources comprises.

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

- **Fil d'actualité façon réseau social** (V2.0, 30 octobre) : chaque question
  est une carte avec l'auteur, la photo de l'exercice, **qui a aimé**
  (« Toi, Awa et 12 autres trouvent ça utile », liste complète au clic ; les
  👎 restent anonymes), les compteurs réponses · commentaires · partages · vues,
  et la **meilleure réponse déjà lisible** dessous. On **aime, commente, répond
  et partage sans quitter le fil**.
- **Commentaires** courts (600 caractères) sous une question ou une réponse :
  pas de vote ni de réputation, notification à l'auteur, suppression par son
  auteur, signalables (masqués après 3 signalements, modération SignManager).
- **Photo dans les réponses** : une résolution manuscrite se joint à une réponse
  (depuis le fil ou la page question, modifiable), avec les mêmes règles que la
  photo d'une question ; elle s'affiche aussi sous la meilleure réponse du fil.
- **Partages** : chaque appui sur « Partager sur WhatsApp » est compté, une fois
  par membre (ou adresse) et par heure ; WhatsApp ne dit pas si le message part.
- **Filtres** : filière, matière et tag, recherche plein texte
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
- **Réputation** : +5 par 👍 sur une question, +10 sur une réponse, +15 pour la
  meilleure réponse, +2 par Merci ; un vote négatif retire 1 ou 2. Toutes les
  variations sont réversibles.
- **Signalements** : un contenu signalé par 3 membres est masqué en attendant
  la modération.

### Bibliothèque BTS (`/bibliotheque`)

Organisée sur le **programme officiel** de la Direction des Examens et Concours
(bts.mesrs-ci.net) : filière → épreuves officielles avec coefficient, nature et
poids dans la note → documents qui préparent chaque épreuve.

- **33 filières officielles** (23 industrielles, 10 tertiaires), codes du MESRS.
  Les anciens codes (FC, GC, GCB, MMA, CJ, SDI) sont convertis par la migration
  `f3b8d4e6a7c9` et restent acceptés dans les liens (`?filiere=FC` → FCGE).
- **1 230 documents** repérés sur fomesoutra.com (sujets, corrigés, cours, TD),
  rattachés à l'épreuve qu'ils préparent (« Électronique » en RIT →
  *Électronique analogique et numérique*). Les épreuves communes (français,
  anglais, économie, gestion, maths, entrepreneuriat…) reçoivent aussi les
  documents des rayons partagés *FI*, *FT* et *Tronc commun*. Ce qui ne se
  rattache à aucune épreuve reste visible sous « Autres documents ».
- Chaque filière affiche sa couverture (« 8/10 épreuves avec des documents ») ;
  une épreuve vide invite à proposer un document. Le membre connecté voit sa
  filière en premier.
- **Liens, jamais de copie.** Chaque fiche ouvre la page du document chez son
  hébergeur et affiche la source et l'auteur. Les livres d'éditeurs sont
  écartés. Encadré « Droits d'auteur », signalement « Je suis l'auteur ».
- **« Poser une question »** sur une fiche préremplit le formulaire.
- **Proposer un document** : validation par un admin (SignManager > Modération).
- Données dans l'image : `seeder/data/library_bts.json` et
  `seeder/data/programme_bts.json`, rechargées à chaque démarrage
  (`seed-library`). Les régénérer : `sign/tools/library/README.md`.

### Annonces WhatsApp (SignManager > WhatsApp)

- Modèles prêts (nouvelle mise à jour, nouveaux sujets et cours, révisions
  d'examen, message libre), aperçu en bulle WhatsApp, destinataires : tous,
  une filière, ou des membres choisis.
- **Seulement les membres qui ont accepté** les infos WhatsApp (compte actif,
  numéro). Les autres sont comptés et affichés, jamais contactés. Comptes de
  démo (`22500…`) exclus.
- **Anti-bannissement** : envoi un par un, 8 à 15 s entre deux messages, pause
  de 2 à 4 min tous les 20, arrêt après 3 échecs d'affilée, 500 destinataires
  max par envoi, un seul envoi à la fois, durée estimée avant confirmation.
  Réglages `WHATSAPP_BROADCAST_*` dans `core/conf.py`.
- Chaque message rappelle pourquoi il est reçu et comment arrêter (profil).
- L'envoi tourne dans le processus de l'API : un redémarrage pendant un envoi
  l'interrompt (il est clos au bout de 15 min, le reste n'est pas envoyé).

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
  (signalements : masquer, rejeter, rétablir ; **documents proposés** :
  publier, refuser), **onglet WhatsApp** (annonces), suivi du labo.

### Landing et identité

Noir et blanc, couleurs Kortex (comme security.kortex.sbs), animations GSAP
portées de shaapi, « Backed by Kortex ». La démo animée fait tourner une
question IDA, FCGE et RIT ; une section « Exemples » montre des questions types
par filière et matière. Menu : Questions, Bibliothèque (« Sujets & cours » sur
la landing). Pages `/regles` et `/confidentialite`.

**Filières** (`client/lib/community.ts`) : les **33 filières officielles** du
MESRS avec leurs codes (RIT, IDA, ELT, SEI, MSP, FCGE, GEC, RHC, LOG, AD, FA,
CJPI, TH, GBAT, 2MA, SIN, GCT…), groupées industrielles / tertiaires à
l'inscription. Un membre peut en saisir une autre. Les anciens codes (FC, GC,
GCB, MMA, CJ, SDI) ont été convertis et restent acceptés dans les liens.

---

## 3. Architecture

```
signlab/                       dépôt github.com/Shalom-302/stoudent
├── sign/                      API  FastAPI (socle shaapi) · PostgreSQL · Redis · MinIO
│   └── backend/
│       ├── app/client/        API publique (/api/v1) : auth, community (+ bibliothèque), labs…
│       ├── app/admin/         back-office (/admin/api/v1) : SignManager, moderation, broadcast
│       ├── models/            community.py (questions, réponses, ressources…), broadcast.py
│       ├── seeder/            signallab.py (labos), demo.py (démo), library.py (bibliothèque)
│       │   └── data/          library_bts.json (catalogue), programme_bts.json (MESRS)
│       └── services/          moteur scientifique du labo
│   └── tools/library/         relevé fomesoutra, programme MESRS, rattachement aux épreuves
├── client/                    web  Next.js 15 · Tailwind 4 · GSAP · KaTeX · React Three Fiber
│   ├── app/(community)/       questions, bibliotheque, confidentialité, règles
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
| `OTP_ENABLED`, `GOWA_URL`, `GOWA_BASIC_USER`, `GOWA_BASIC_PASS` | WhatsApp (codes, notifications, annonces), mêmes valeurs que shasec |

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
docker exec $API python -m backend.cli seed-library   # bibliothèque : déjà lancé à chaque démarrage
docker exec $API python -m backend.cli create-admin \
    --email admin@stoudent.kortex.sbs --password '…' --pseudo stoudent.admin
```

**Comptes de démo** : un par filière (`yao.rit`, `awa.ida`, `kone.elt`,
`fatou.sei`, `bamba.msp`, `marie.fc` en FCGE), deux questions chacun. Le compte
`bibliotheque` porte le catalogue. Leurs numéros sont dans la plage `225 00…`,
attribuée à aucun opérateur, et sont exclus des annonces WhatsApp.

Au démarrage, l'API applique les migrations puis recharge la bibliothèque : un
déploiement ne demande aucune commande à la main.

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
données : `contact@kortexdigital.net` (constante `PRIVACY_CONTACT`).

---

## 6. Décisions et écarts assumés

- **Bibliothèque en liens, pas en fichiers.** Citer la source ne donne pas le
  droit de recopier un PDF : STOUDENT relève titre et lien (en respectant le
  robots.txt de fomesoutra), l'étudiant télécharge chez l'hébergeur. Héberger
  des fichiers demanderait l'accord écrit des auteurs ou du site. Scribd est
  exclu (conditions d'utilisation, compte requis).
  `COMMUNITY_RESOURCES_ENABLED=false` referme la bibliothèque si besoin.
- **WhatsApp volontairement rare.** Un message par question, jamais pour les
  votes, merci, validations : tout le reste passe par la cloche. Les annonces
  groupées vont aux seuls membres consentants, un message à la fois, lentement.
  Objectif : ne pas être perçu comme du spam, et ne pas faire bannir le numéro
  gowa.
- **Le programme officiel fait foi.** Filières, codes, épreuves et coefficients
  viennent de bts.mesrs-ci.net ; la bibliothèque se range dessus, et une
  épreuve sans document reste affichée (« propose-le ») plutôt que cachée.
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
| API communauté | inscription, questions, réponses, votes, réputation, signalements | 34/34 |
| API photo des réponses | envoi, URL étrangère refusée, fil et page question, modification qui retire la photo | 7/7 |
| API Labo Terrain | affaiblissement en espace libre, rayon de Fresnel, renflement terrestre, gain d'une parabole, +6 dB pour une distance doublée, obstacle qui coupe la liaison et hauteur suggérée, budget GPON, limite de 128 abonnés par port, bornes refusées | 20/20 |
| Navigateur, Labo Terrain | page Laboratoires, scène, marche jusqu'au PBO, mission fibre réussie, quiz, carnet ; carte et « Y aller » au pylône FH, mission FH ; téléphone 390 px ; salle de TP inchangée (marche jusqu'au poste D, TP ouvert) | 13/13 + salle OK, 0 erreur console |
| API fil social (V2.0) | qui a aimé (3 noms, total, 👎 anonymes), meilleure réponse dans le fil, partages dédoublonnés, commentaires (droits, notifications, signalement, compteurs), suppression d'une réponse commentée | 39/39 |
| Navigateur, fil social | visiteur et membre, ordinateur et téléphone 390 px : aimer, voir qui a aimé, commenter, répondre et partager depuis le fil, page question | 15/15, 0 erreur console |
| API bibliothèque | programme officiel (33 filières, épreuves, coefficients), rayons par épreuve et rayons partagés, anciens codes, facettes, recherche, visites, propositions, validation admin, signalement droits d'auteur | 30/30 |
| Annonces WhatsApp | faux serveur gowa : consentement seul, exclusions, délais, pause, arrêt sur échecs, un envoi à la fois ; API admin | 11/11 + 10/10 |
| Bibliothèque, base neuve | migrations + `seed-library` avant la création des tables par l'API ; 2ᵉ passage sans doublon | OK |
| Navigateur (bibliothèque, SignManager WhatsApp) | filières, programme RIT, rayon d'épreuve, ancien code FC, mobile 390 px ; onglet WhatsApp avec aperçu : 0 erreur console | OK |
| API sessions | cookie seul, rotation, multi-appareils, mot de passe oublié, blocage | 18/18 |
| API fonctions | photos, notifications, merci, modification, suppression | 21/21 |
| API compte | mot de passe, numéro, suppression et anonymisation | 21/21 |
| Navigateur (Playwright) | parcours complet, nouvelles fonctions, compte, session, absence de « SignalLab » | tout vert, 0 erreur console |
| Base neuve | migrations + création des tables + `seed-demo` sur une base vide, comme en production | OK |
| WhatsApp | faux serveur gowa : 1 message à la 1re réponse, 0 à la 2e, 0 sans accord | OK |

Bugs trouvés par ces tests et corrigés : rafraîchissement de session qui
n'avait jamais marché depuis le navigateur, jetons identiques dans la même
seconde, réputation bloquée à 0, vues comptées plusieurs fois, migrations qui
plantaient sur une base neuve, verrou SQL incompatible avec une jointure,
anciennes ressources de test (`example.org`) devenues visibles en local à
l'ouverture de la bibliothèque (retirées), crawl des cours cassé par la
conversion de chemins de Git Bash (`MSYS_NO_PATHCONV=1`).

---

## 8. Ce qui reste

### Reporté volontairement

- [ ] **Sauvegardes automatiques de Postgres** (Dokploy, vers un stockage
      externe) : à mettre en place quand le trafic le justifiera.
- [ ] Déclaration ARTCI (base de numéros de téléphone).
- [x] Adresse de contact données confirmée : contact@kortexdigital.net.

### Prochaines fonctions

- [ ] Profil public d'un membre (questions, réponses, réputation)
- [ ] Classement des entraideurs par filière
- [ ] Fil « Ma filière » par défaut, questions sans réponse en premier
- [ ] Suivre une question
- [x] Commentaires courts sous une question ou une réponse (V2.0)
- [ ] Référencement Google (pages de questions rendues côté serveur)
- [ ] Bibliothèque : compléter les filières sans documents propres
      (agriculture, cosmétologie, géomètre…) et les épreuves vides (EPP)
- [ ] Bibliothèque : revoir les 105 « Autres documents » et les 58 sans matière
- [ ] Annonces WhatsApp : reprendre un envoi interrompu par un redémarrage

### Plus tard (note de concept)

Assistant IA (payant, avec quota gratuit), messagerie privée, application
mobile, partenariat avec fomesoutra, dépôt de cours par les professeurs
vérifiés (hébergés par STOUDENT, avec leur accord).

---

## 9. Où regarder

| Sujet | Fichier |
|---|---|
| Questions, réponses, votes, merci | `sign/backend/app/client/service/community_service.py` |
| Fil social (carte, qui a aimé, commentaires) | `client/components/community/feed-card.tsx`, `client/components/community/social.tsx` |
| Notifications et WhatsApp | `sign/backend/app/client/service/notify_service.py` |
| Codes WhatsApp (gowa) | `sign/backend/app/client/service/otp_service.py` |
| Photos | `sign/backend/app/client/service/upload_service.py` |
| Compte (mot de passe, numéro, suppression) | `sign/backend/app/client/service/account_service.py` |
| Connexion, sessions, blocage | `sign/backend/app/admin/service/auth_service.py` |
| Modèles communauté | `sign/backend/models/community.py` |
| Comptes de démo | `sign/backend/seeder/demo.py` |
| Réglages (OTP, WhatsApp, photos, ressources) | `sign/backend/core/conf.py` |
| Filières, exemples, contact | `client/lib/community.ts`, `client/components/landing/example-questions.tsx` |
| Annonces WhatsApp | `sign/backend/app/admin/api/v1/broadcast.py`, `client/components/admin/whatsapp-broadcast.tsx` |
| Programme officiel | `sign/backend/app/client/service/programme.py`, `seeder/data/programme_bts.json` |
| Bibliothèque (page, API, catalogue) | `client/components/community/library-view.tsx`, `community_service.py` (Resources), `seeder/library.py`, `seeder/data/library_bts.json` |
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

## E. Labo Terrain (30 octobre 2026)

**Une ville câblée qui remplace la sortie terrain** (`/terrain`, carte « Dehors »
sur la page Laboratoires). L'étudiant n'a plus besoin d'aller dans la rue : en
quelques minutes il voit ce qu'une visite montrerait. L'idée vient du projet
d'un ami (ville d'Abidjan en three.js) ; **aucun code n'a été repris**, tout est
sur notre stack (React Three Fiber, même `Player` que la salle).

- **Catalogue d'équipements** (`client/lib/terrain/city.ts`, `EQUIPMENT`) :
  2 pylônes FH reliés au-dessus de l'immeuble Sigma, 4 FH de collecte sur les
  toits, 3 relais 2G/4G sur toit, 2 small cells sur lampadaires, le central
  optique (NRO), 2 armoires de rue (SRO), 4 chambres de tirage le long du
  parcours de la fibre, 3 PBO sur poteaux avec leurs câbles de branchement.
  Ajouter un équipement = ajouter un objet.
- **Les réseaux rendus visibles** (bouton « Réseaux », activé par défaut) :
  liaisons radio entre paraboles (la liaison principale passe au vert ou au
  rouge selon le dernier calcul), fibre enterrée du NRO aux chambres et aux
  armoires, fibre aérienne sur les poteaux. **Étiquettes 3D** au-dessus de
  chaque équipement, cachées par les immeubles.
- **Carte** : la mini-carte s'ouvre en plein écran (tous les équipements par
  type, la fibre, les liaisons) ; **« Y aller »** dépose l'avatar devant
  l'équipement, caméra tournée vers le haut pour ce qui est en hauteur.
- **8 types de fiches** (`client/lib/terrain/sites.ts`) : ce que tu vois,
  chiffres clés, quiz corrigé, « Demande à la communauté ». Le carnet compte les
  types vus et maîtrisés (gardé sur l'appareil pour l'instant).
- **Missions calculées par l'API** (`sign/backend/services/link_budget_service.py`,
  `POST /signals/microwave-link` et `/signals/fibre-drop`) : liaison FH au-dessus
  de Sigma avec 20 dB de marge, 64 abonnés GPON avec 3 dB de marge.
- **Rue réaliste mais au second plan** : textures dessinées par le code (bitume,
  pavés et bordures, latérite, façades avec fenêtres et climatiseurs, tôles,
  polytanks), ciel et soleil dont les ombres suivent l'avatar, brume, ville au
  loin, cocotiers, lampadaires, poteaux et câbles, voitures qui roulent à droite
  et s'arrêtent devant l'étudiant (taxis orange, woro-woro bleus), passants.
- **Téléphones** : murs, toits, routes et trottoirs fusionnés en quelques
  maillages, pylône en un seul maillage, arbres et équipements répétés
  instanciés, passants dessinés seulement à moins de 45 m, résolution plafonnée.
- **Autres filières** : ELT, GBAT, LOG, FCGE, GEC affichées « Labo en cours de
  développement » sur la page Laboratoires.

## F. Ce qui reste pour le labo

- [ ] Test automatisé de l'ouverture d'un poste dans la salle 3D
- [ ] Brancher les écrans des instruments de la salle sur l'API (synthèse
      locale aujourd'hui)
- [ ] Tests unitaires du moteur de jalons et de la notation
- [ ] Publier convolution et Laplace (changement de drapeau)
- [ ] Labo Télécom (PABX, SIP, VoIP, GSM), labos pour d'autres filières
- [ ] Assets Blender à la place de la géométrie procédurale (`useGLTF`)
- [ ] Labo Terrain : carnet enregistré côté serveur (XP, badges), mission
      relais GSM (azimuts, tilt), monter dans une voiture / un taxi, avatar
      plus réaliste (modèle 3D riggé)

| Sujet | Fichier |
|---|---|
| Cotes de la salle (source unique) | `client/lib/lab3d/specs.ts` |
| Pilotage de l'avatar | `client/components/world3d/Player.tsx` |
| Poste de travail en salle | `client/components/world3d/StationPanel.tsx` |
| Contenu pédagogique | `sign/backend/seeder/signallab.py` |
| Notation par la manipulation | `sign/backend/app/client/service/milestones.py` |
| Moteur scientifique | `sign/backend/services/` |
