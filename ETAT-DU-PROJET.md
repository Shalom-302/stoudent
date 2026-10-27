# STOUDENT — état du projet

> Le mini réseau social d'entraide étudiante (voir `STOUDENT_note_de_concept_MVP.docx`).
> SignalLab, le labo virtuel 3D décrit plus bas, en est l'onglet **Lab**.

## 0. Le virage STOUDENT (27 octobre 2026)

Tout SignalLab est conservé. Ce qui a été ajouté par-dessus :

| | |
|---|---|
| **Comptes** | Identifiant = numéro WhatsApp (+ pseudo public, filière obligatoire, établissement, niveau, « étudiant » ou « professeur »). E-mail facultatif ; les anciens comptes se connectent toujours par e-mail. |
| **OTP WhatsApp** | Porté de shaapi (gowa). `OTP_ENABLED=false` par défaut ; à `true`, le compte reste bloqué jusqu'au code. |
| **Communauté** | Fil de questions (filtres filière / matière / tag, recherche plein texte française), réponses, votes, meilleure réponse, réputation, ressources (lien + source, jamais le contenu), signalements (masquage auto à 3). Lecture publique, écriture connectée. |
| **Professeurs** | Se déclarer prof ne donne aucun droit. Un admin attribue le rôle `teacher` dans SignManager, qui débloque « Validée par un professeur ». |
| **SignManager** | Recherche par pseudo / numéro, onglet **Modération** (masquer, rejeter, rétablir). |
| **Front** | Landing GSAP en noir et blanc, couleurs Kortex comme security.kortex.sbs (portée de shaapi), « Backed by Kortex », pages `/questions`, `/questions/ask`, `/questions/[id]`, `/resources`, `/regles`. Le labo vit sous l'onglet Lab avec sa sous-navigation. |
| **Déploiement** | `.github/workflows/build.yml` pousse `ghcr.io/<owner>/<repo>` (API) et `<repo>-web` (client) sur GHCR ; `compose.image.yml` est prêt pour Dokploy. Le client relaie `/api/v1` et `/admin/api/v1` vers `API_INTERNAL_URL` : une seule image pour tous les domaines. |

Fichiers clés : `sign/backend/models/community.py`,
`sign/backend/app/client/service/community_service.py`,
`sign/backend/app/client/service/otp_service.py`,
`sign/backend/app/admin/api/v1/moderation.py`, `client/app/(community)/`,
`client/components/landing/landing.tsx`, `client/lib/server/proxy.ts`.

### Mise en ligne sur Dokploy

1. Pousser le dépôt sur GitHub (branche `main`) : la CI publie les deux images.
2. Dans Dokploy, créer un projet *Compose* sur `compose.image.yml`, et définir
   `PUBLIC_DOMAIN`, `TOKEN_SECRET_KEY`, `OPERA_LOG_ENCRYPT_SECRET_KEY`,
   `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY` (et `STOUDENT_IMAGE` si le dépôt
   ne s'appelle pas `shalom-302/stoudent`).
3. Router le domaine vers le service `web`, port 3000.
4. Pour l'OTP : `OTP_ENABLED=true` et les `GOWA_*`, comme pour shaapi (réseau
   `whatsapp-shared-network`).

---

Point d'avancement SignalLab au **18 septembre 2026**. Ce document décrit ce qui tourne
aujourd'hui, ce qui reste à faire, et les décisions prises en cours de route —
y compris celles qui s'écartent de la fiche technique.

---

## 1. En une phrase

Un étudiant peut créer un compte, entrer dans une salle de TP en 3D, piloter son
avatar jusqu'à un poste, y ouvrir un TP sans quitter la salle, régler des
instruments dont les écrans affichent la vraie courbe calculée par le moteur
scientifique, se faire noter **sur ce qu'il a manipulé**, gagner de l'XP et des
badges, et retrouver sa progression à la reconnexion.

Le critère de validation du MVP v0.1 de la fiche technique est atteint.

---

## 2. Architecture

```
signlab/
├── sign/          backend   FastAPI + Shaapi · PostgreSQL · Redis · MinIO
│   └── backend/
│       ├── app/client/      API étudiante   (28 routes, montée à la racine)
│       ├── app/admin/       back-office     (26 routes, dont SignManager)
│       ├── services/        moteur scientifique NumPy / SciPy / SymPy
│       ├── models/          7 modèles SignalLab + le socle auth
│       └── seeder/          catalogue pédagogique (idempotent)
└── client/        frontend  Next.js 15 · TypeScript · Tailwind · React Three Fiber
    ├── app/                 13 pages (App Router)
    ├── components/world3d/  la salle 3D
    ├── components/experiments/  instruments 2D
    └── lib/lab3d/           cotes, signal, écrans, ancrages
```

| | |
|---|---|
| Backend | 139 fichiers Python, 3 migrations Alembic |
| Frontend | 92 fichiers TS/TSX, 13 pages |
| API étudiante | 28 routes · API admin 26 routes (dont 5 SignManager) |
| Données seedées | 2 labos, 7 expériences (5 publiées), 8 badges |

### Le contrat 3D ↔ simulation

Babylon.js a été remplacé par **React Three Fiber** (voir §6). Quel que soit le
moteur, la règle de la fiche technique tient : le 3D **ne calcule rien**. Il
affiche ce que FastAPI a renvoyé. Toute la physique du signal est en Python.

```
Étudiant → manipulation 3D → paramètres → FastAPI → NumPy/SciPy/SymPy
                                                         ↓
              écran de l'instrument  ←  Three.js  ←  résultats
```

---

## 3. Ce qui fonctionne

### Moteur scientifique — vérifié

Six services purs (`backend/services/`), sans base ni framework.
**41 contrôles de physique passent**, dont les valeurs exactes sur lesquelles
les TP notent :

| Contrôle | Attendu | Obtenu |
|---|---|---|
| Fondamentale d'un carré | `4A/π` = 1,273 | ✓ |
| Butterworth à la coupure | −3 dB | ✓ |
| Butterworth ordre 4 | −80 dB/décade | ✓ |
| Repliement 5 kHz @ 6 kHz | 1 kHz | ✓ |
| Résolution sur 20 ms | 50 Hz | ✓ |
| Pôle d'un RC 1 kΩ/1 µF | −1000, stable | ✓ |

Deux garde-fous testés : une expression Laplace malveillante est refusée (400),
et une demande de 10⁸ échantillons est refusée (422).

### Parcours pédagogique

Les 5 TP du MVP sont seedés, en français correct et accentué :

1. Signaux élémentaires · 2. Série de Fourier · 3. Transformée de Fourier ·
4. Échantillonnage · 5. Filtrage

*(Convolution et Laplace sont seedés mais `is_published = false` — V0.2 est un
changement de drapeau.)*

Chaque TP contient : un **rappel de cours** (la formule), un **exemple résolu**
en 6 étapes avec les nombres réels du moteur, un protocole pas à pas, des
**jalons de manipulation** et une ou deux questions de lecture d'instrument.

### La salle 3D

Construite aux cotes du document de spécification : **12 × 10 × 3,20 m**, tables
1,60 × 0,75 × 0,75 m, œil à 1,60 m, FOV 90°, interaction à 0,80 m. Murs
réellement percés, 4 postes étudiants, table centrale, baie 42U, grand écran,
tableau blanc, câblage en spline.

L'avatar (1,75 m, hiérarchie de rig standard) se pilote **comme dans un jeu** :
3ᵉ personne par défaut, bascule 1ʳᵉ personne, cycle de marche, caméra qui se
rapproche quand un mur passerait devant. Clavier ZQSD/WASD/flèches, **manche
virtuel à l'écran**, glisser pour regarder. Collisions sur le mobilier.

Le grand écran et le tableau blanc portent la consigne en cours, une mesure
vivante et ce qu'il reste à faire.

### Back-office SignManager

`/signmanager`, réservé aux administrateurs : compteurs plateforme, **entonnoir
par TP** (où une promotion bloque), table des étudiants avec recherche,
activation/désactivation des comptes et attribution des rôles.

---

## 4. Sécurité

Un audit a été mené en parallèle du développement. Corrigé :

| Problème | Gravité | État |
|---|---|---|
| **Toute inscription publique recevait le rôle `admin`** | critique | corrigé, vérifié (nouveau compte → `user`, SignManager → 403) |
| `python-jose` non maintenu | élevée | remplacé par **PyJWT** |
| `passlib` non maintenu, cassé avec bcrypt 4.x | élevée | **bcrypt** direct, hashes existants compatibles |
| Course à la création du profil étudiant (3 requêtes parallèles → 500) | moyenne | `INSERT … ON CONFLICT DO NOTHING` |
| Réponses de TP exposées au navigateur | moyenne | correction 100 % serveur, vérifié |
| Expression Laplace évaluable | moyenne | liste blanche de symboles, aucune évaluation |
| Endpoints de calcul sans borne | moyenne | plafond `durée × fréquence`, limitation de débit |
| En-têtes de sécurité absents | faible | CSP, HSTS, TrustedHost, gzip |
| Secrets de dev acceptés en production | faible | refus de démarrage explicite |

Trois comptes portent encore le rôle `admin` parce qu'ils ont été créés **avant**
le correctif. À rétrograder depuis SignManager.

---

## 5. Comment le lancer

```bash
# Backend
cd sign
shaapi up              # ou docker compose up -d
shaapi db apply
docker exec sign_api python -m backend.cli seed-labs
docker exec sign_api python -m backend.cli create-admin \
    --email vous@exemple.fr --password 'MotDePasseSolide2026!'

# Frontend
cd client
npm install
cp .env.local.example .env.local
npm run dev
```

| | |
|---|---|
| Application | http://localhost:3000 |
| Salle 3D | http://localhost:3000/world |
| Swagger étudiant | http://localhost:8000/api/v1/docs |
| Swagger admin | http://localhost:8000/admin/api/v1/docs |

> **Attention** : ne pas lancer `next build` pendant que `next dev` tourne — les
> deux écrivent dans `.next` et se corrompent mutuellement. Utiliser
> `NEXT_DIST_DIR=.next-check npx next build`.

---

## 6. Décisions et écarts assumés

Trois choix s'écartent des documents de référence. Ils sont volontaires.

### React Three Fiber au lieu de Babylon.js

La fiche technique retient Babylon.js. Une maquette R3F faite par l'équipe
produisait une salle nettement meilleure que l'implémentation Babylon. Elle a
été portée, et Babylon **retiré** : la fiche technique interdit explicitement
d'utiliser deux moteurs pour le même monde 3D.

Conséquence : React est épinglé en `~19.2.0`, car `@react-three/fiber@9` exige
`react < 19.3`.

### La formule est donnée avant la manipulation

La fiche technique (§4) dit « la formule arrive après l'expérience ». C'est
l'inverse qui a été retenu : sans formule ni exemple résolu, un étudiant ne
pratique pas, il tâtonne. Chaque TP donne donc la formule et un exercice
entièrement corrigé, puis demande de refaire le raisonnement au banc.

Ce qui reste débloqué à la fin est la **synthèse** (le raisonnement complet et
ses limites), pas la formule.

### La note vient du geste, pas du questionnaire

Un TP sert à pratiquer. La notation a été rééquilibrée : **60 à 75 % des points
viennent de ce qui a été fait au banc**, le reste de questions de lecture
d'instrument.

Un jalon se verrouille : atteindre l'état une fois suffit, remettre le bouton en
arrière ne l'enlève pas. Les conditions sont déclaratives (`{left, op, right}`),
sans évaluation d'expression — une règle écrite dans les données ne peut jamais
devenir un chemin d'exécution.

```
Score 100/100     manipulation 9/9     lecture 3/3
  [x] Observer un repliement (fe sous le critère de Shannon)
  [x] Corriger fe pour respecter fe > 2·fmax
  [x] Refaire l'essai sur une autre fréquence de signal
```

---

## 7. Tests

Deux harnais, tous deux reproductibles.

**Moteur scientifique** — 41 assertions sur les valeurs physiques exactes.

**Navigateur** — Playwright + Chromium (`scratchpad/e2e/lab.mjs`) : inscription
par l'API, jeton injecté dans `localStorage`, pilotage de la salle 3D, captures
d'écran, erreurs console. Dernier passage : **0 erreur console**.

Ce harnais a trouvé quatre bugs invisibles à la lecture du code :

- le `lookAt` d'un `Object3D` oriente +Z vers la cible, une caméra regarde en −Z
  → **180° exactement**, on voyait le mur ;
- signe inversé sur le rig 3ᵉ personne → la caméra était **devant** l'avatar, qui
  marchait vers elle ;
- strafe inversé à tous les angles → **D allait à gauche** ;
- la course sur la création du profil étudiant.

---

## 8. Ce qui reste

### Vérifications en attente

- [ ] **Ouvrir un poste dans la salle 3D en test automatisé** — le script ne sait
      pas encore marcher jusqu'au rayon d'un mètre. L'onglet « Cours » du panneau
      en salle est vérifié par le build et par la version 2D, pas à l'œil.
- [ ] Ressenti du pilotage (vitesse, distance caméra, sensibilité du glisser).
      Constantes groupées en haut de `components/world3d/Player.tsx`.

### Court terme

- [ ] Rétrograder les 3 comptes `admin` hérités
- [ ] Brancher les écrans des instruments de la salle sur l'API plutôt que sur la
      synthèse locale (aujourd'hui locale à 60 fps, ce que prévoyait la maquette)
- [ ] Tests unitaires Python sur le moteur de jalons et la notation
- [ ] Décider du sort de la page 2D `/labs/signal/[experiment]` : conservée pour
      l'accessibilité (écran étroit, clavier seul, pas de WebGL), à retirer si la
      salle doit être le seul chemin

### Suite produit (fiche technique §13)

| Version | Contenu |
|---|---|
| **V0.1** *(ici)* | Auth, profil, avatar, salle 3D, SignalLab, 5 TP, scoring, XP |
| V0.2 | Laplace, convolution, filtres avancés — déjà seedés, à publier |
| V0.3 | Espace professeur, classes, analytics — SignManager en est la base |
| V0.4 | AI Tutor contextualisé |
| V0.5 | TelecomLab : PABX, SIP, VoIP, GSM |
| V1 | Laboratoires collaboratifs, campus virtuel RIT |

### Dette connue

- Géométrie 3D **procédurale**, pas d'assets Blender. Le code est structuré pour
  la bascule : noms de meshes, points d'ancrage et colliders suivent déjà la
  convention d'export, `useGLTF` remplacera `Room`/`Furniture`/`Instruments`.
- Pas de LOD ni de normal maps.
- Pas de WebSocket ni de multi-utilisateur — hors périmètre MVP, assumé.

---

## 9. Où regarder

| Sujet | Fichier |
|---|---|
| Cotes de la salle — **source unique** | `client/lib/lab3d/specs.ts` |
| Pilotage de l'avatar | `client/components/world3d/Player.tsx` |
| Poste de travail en salle | `client/components/world3d/StationPanel.tsx` |
| Contenu pédagogique | `sign/backend/seeder/signallab.py` |
| Notation par la manipulation | `sign/backend/app/client/service/milestones.py` |
| Moteur scientifique | `sign/backend/services/` |
| Garde par rôle | `sign/backend/common/security/roles.py` |

Une cote ne s'écrit jamais dans un composant : déplacer un poste ou changer une
dimension se fait dans `specs.ts` et se propage à la géométrie, aux collisions
et aux points d'ancrage. Un énoncé se corrige dans le seeder, puis
`seed-labs` — c'est idempotent, la progression des étudiants est préservée.
