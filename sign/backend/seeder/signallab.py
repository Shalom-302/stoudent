"""Seed the SignalLab catalogue: labs, experiments and badges.

Idempotent: run it as often as you like. Existing rows are updated in place,
so fixing a typo in a question is a re-run rather than a migration.

    python -m backend.cli seed-labs
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from backend.common.enums import (
    AchievementCriteriaType,
    DifficultyType,
    LabStatusType,
    LabType,
)
from backend.database.db_postgres import async_db_session
from backend.models import Achievement, Experiment, Lab

# ---------------------------------------------------------------------------
# Labs
# ---------------------------------------------------------------------------

LABS: list[dict] = [
    {
        'slug': 'signal-lab',
        'name': 'SignalLab',
        'type': LabType.signal.value,
        'status': LabStatusType.available.value,
        'order': 1,
        'description': (
            "Laboratoire de traitement du signal : générateur, oscilloscope, "
            "analyseur de spectre et banc de filtrage."
        ),
        'scene_config': {
            'building': 'signal_lab',
            'position': {'x': -12, 'y': 0, 'z': 8},
            'rotation': 0,
            'accent': '#F5D547',
            'entrance': {'x': -12, 'y': 0, 'z': 2},
            'equipment': [
                {'id': 'generator', 'label': 'Générateur de signaux', 'position': {'x': -2, 'y': 1, 'z': 0}},
                {'id': 'oscilloscope', 'label': 'Oscilloscope', 'position': {'x': 0, 'y': 1, 'z': 0}},
                {'id': 'spectrum', 'label': 'Analyseur de spectre', 'position': {'x': 2, 'y': 1, 'z': 0}},
                {'id': 'filter_bench', 'label': 'Banc de filtrage', 'position': {'x': 4, 'y': 1, 'z': 0}},
            ],
        },
    },
    {
        'slug': 'telecom-lab',
        'name': 'TelecomLab',
        'type': LabType.telecom.value,
        # Present in the world from day one, but explicitly not playable:
        # section 12 of the fiche technique asks for a preview, not a stub.
        'status': LabStatusType.coming_soon.value,
        'order': 2,
        'description': (
            "Simulation téléphonie / PABX / GSM - bientôt disponible. "
            "Zone de découverte : BTS, antenne, téléphone, PABX."
        ),
        'scene_config': {
            'building': 'telecom_lab',
            'position': {'x': 14, 'y': 0, 'z': 8},
            'rotation': 0,
            'accent': '#C9CDD4',
            'entrance': {'x': 14, 'y': 0, 'z': 2},
            'locked_message': 'Simulation téléphonie / PABX / GSM - bientôt disponible',
            'equipment': [
                {'id': 'bts', 'label': 'BTS', 'position': {'x': 12, 'y': 0, 'z': 14}},
                {'id': 'antenna', 'label': 'Antenne', 'position': {'x': 17, 'y': 0, 'z': 14}},
                {'id': 'phone', 'label': 'Téléphone', 'position': {'x': 13, 'y': 1, 'z': 10}},
                {'id': 'pabx', 'label': 'PABX', 'position': {'x': 16, 'y': 1, 'z': 10}},
            ],
            'panels': [
                {'id': 'panel_gsm', 'text': 'Téléphone -> BTS -> Réseau'},
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Experiments
#
# `validation_rules` never leaves the backend. `type: parameter` rules grade the
# state of the bench itself, which is how a TP can require a manipulation and
# not just an answer.
# ---------------------------------------------------------------------------

EXPERIMENTS: list[dict] = [
    {
        'lab_slug': 'signal-lab',
        'slug': 'signaux-elementaires',
        'title': '01 - Signaux élémentaires',
        'order': 1,
        'difficulty': DifficultyType.beginner.value,
        'duration_minutes': 20,
        'xp_reward': 120,
        'description': "Sinusoïde, carré, triangle, impulsion : amplitude, fréquence, phase.",
        'objective': (
            "Manipuler un générateur virtuel et relier chaque réglage à ce que "
            "l'oscilloscope affiche."
        ),
        'instructions': [
            {
                'title': 'Observer',
                'content': (
                    "Le générateur est réglé sur une sinusoïde de 1 kHz. Regardez "
                    "l'oscilloscope : combien de périodes tiennent dans la fenêtre ?"
                ),
                'hint': "La fenêtre affiche 5 ms.",
            },
            {
                'title': 'Amplitude et offset',
                'content': "Faites varier l'amplitude puis l'offset. Que bouge, que ne bouge pas ?",
            },
            {
                'title': 'Phase',
                'content': "Changez la phase. La forme change-t-elle ? Et la position ?",
            },
            {
                'title': 'Changer de forme',
                'content': (
                    "Passez en carré, puis en triangle. Réglez la fréquence sur 2 kHz "
                    "et comptez les périodes."
                ),
            },
        ],
        'guide': {'formula': 'x(t) = A·sin(2·pi·f·t + phi) + C', 'formula_note': 'T = 1 / f     Veff = A / racine(2)     Vpp = 2A', 'example': [{'title': 'Énoncé', 'text': "Un générateur délivre une sinusoïde d'amplitude A = 2 V à f = 500 Hz, sans offset. La fenêtre de l'oscilloscope fait 5 ms."}, {'title': '1. Période', 'text': 'T = 1 / f = 1 / 500', 'result': 'T = 2 ms'}, {'title': '2. Nombre de périodes visibles', 'text': 'fenêtre / T = 5 ms / 2 ms', 'result': '2,5 périodes à l’écran'}, {'title': '3. Valeur crête à crête', 'text': 'Vpp = 2A = 2 × 2', 'result': 'Vpp = 4 V'}, {'title': '4. Valeur efficace', 'text': 'Veff = A / racine(2) = 2 / 1,414', 'result': 'Veff = 1,41 V'}, {'title': '5. Vérification à l’écran', 'text': "L'oscilloscope doit afficher 2,5 motifs, Vpp = 4 V et Veff = 1,41 V dans les mesures sous la courbe. Si c'est le cas, le calcul est bon."}], 'your_turn': "À vous : réglez le générateur sur 2 kHz. Calculez T, puis le nombre de périodes attendu dans la fenêtre de 5 ms, avant de regarder l'écran."},
        'initial_parameters': {
            'signal_type': 'sine',
            'amplitude': 1.0,
            'frequency': 1000.0,
            'phase': 0.0,
            'offset': 0.0,
            'duration': 0.005,
            'sample_rate': 200000.0,
            'pass_score': 70,
        },
        'theory': (
            "Un signal sinusoïdal s'écrit x(t) = A sin(2 pi f t + phi) + C.\n\n"
            "- A fixe la hauteur (amplitude),\n"
            "- f fixe le nombre de périodes par seconde, avec T = 1 / f,\n"
            "- phi décale la courbe dans le temps sans la déformer,\n"
            "- C est la composante continue (offset).\n\n"
            "La valeur efficace d'une sinusoïde pure vaut A / racine(2), soit environ 0,707 A : "
            "c'est ce que lit un multimètre en mode AC."
        ),
        'validation_rules': [
            {
                'id': 'm_freq',
                'type': 'milestone',
                'label': 'Régler le générateur sur 2 kHz',
                'points': 3,
                'check': {'left': 'frequency', 'op': '>=', 'right': {'value': 1900}},
            },
            {
                'id': 'm_forme',
                'type': 'milestone',
                'label': 'Essayer une autre forme d’onde que la sinusoïde',
                'points': 2,
                'check': {'left': 'signal_type', 'op': 'in', 'right': ['square', 'triangle', 'sawtooth']},
            },
            {
                'id': 'm_ampl',
                'type': 'milestone',
                'label': 'Faire varier l’amplitude',
                'points': 2,
                'check': {'left': 'amplitude', 'op': '!=', 'right': {'value': 1.0}},
            },
            {
                'id': 'q1',
                'type': 'numeric',
                'question': "Lecture : quelle est la période d'une sinusoïde de 1 kHz, en millisecondes ?",
                'answer': 1.0,
                'tolerance': 0.05,
                'unit': 'ms',
                'points': 3,
                'feedback_ok': 'Exact : T = 1 / f = 1 / 1000 = 1 ms.',
                'feedback_ko': 'Revoyez la relation T = 1 / f.',
            },
        ],
    },
    {
        'lab_slug': 'signal-lab',
        'slug': 'serie-de-fourier',
        'title': '02 - Série de Fourier',
        'order': 2,
        'difficulty': DifficultyType.beginner.value,
        'duration_minutes': 30,
        'xp_reward': 150,
        'description': "Harmoniques et reconstruction progressive d'une onde carrée.",
        'objective': (
            "Reconstruire une onde carrée harmonique par harmonique et voir la "
            "formule apparaitre a la fin, pas au debut."
        ),
        'instructions': [
            {
                'title': 'La cible',
                'content': "L'oscilloscope affiche une onde carrée de 1 kHz. Retenez sa forme.",
            },
            {
                'title': 'Harmonique 1',
                'content': (
                    "Activez seulement l'harmonique 1. Vous obtenez une sinusoïde : "
                    "c'est la fondamentale."
                ),
            },
            {
                'title': 'Ajouter 3, 5, 7...',
                'content': (
                    "Activez les harmoniques impaires une par une et regardez l'erreur "
                    "quadratique descendre."
                ),
                'hint': "Les harmoniques paires d'un carré valent zero.",
            },
            {
                'title': 'Les oreilles',
                'content': (
                    "Zoomez près des fronts. Les petites oscillations qui restent portent "
                    "un nom : cherchez-le."
                ),
            },
        ],
        'guide': {'formula': 'f(t) = (4A/pi) · [ sin(wt) + (1/3)·sin(3wt) + (1/5)·sin(5wt) + ... ]', 'formula_note': 'Onde carrée : harmoniques IMPAIRES seulement.   Amplitude de l’harmonique n :  a(n) = 4A / (n·pi)', 'example': [{'title': 'Énoncé', 'text': 'Onde carrée d’amplitude A = 1 V, fondamentale f = 1 kHz. Calculez l’amplitude des quatre premières harmoniques non nulles.'}, {'title': '1. Fondamentale (n = 1)', 'text': 'a(1) = 4A / (1·pi) = 4 / 3,1416', 'result': 'a(1) = 1,273 V   à 1 kHz'}, {'title': '2. Harmonique 3', 'text': 'a(3) = 4 / (3·pi) = 1,273 / 3', 'result': 'a(3) = 0,424 V   à 3 kHz'}, {'title': '3. Harmonique 5', 'text': 'a(5) = 4 / (5·pi) = 1,273 / 5', 'result': 'a(5) = 0,255 V   à 5 kHz'}, {'title': '4. Harmonique 7', 'text': 'a(7) = 4 / (7·pi) = 1,273 / 7', 'result': 'a(7) = 0,182 V   à 7 kHz'}, {'title': '5. Ce qu’on doit voir', 'text': 'Le spectre montre des raies à 1, 3, 5 et 7 kHz de ces hauteurs. Rien à 2 kHz ni à 4 kHz : les harmoniques paires d’un carré sont nulles. Chaque harmonique ajoutée rapproche la courbe du carré, et l’erreur quadratique affichée diminue.'}], 'your_turn': 'À vous : refaites le calcul pour A = 2 V. a(1) doit valoir 2,546 V. Montez ensuite les harmoniques une à une et vérifiez chaque raie.'},
        'initial_parameters': {
            'signal_type': 'square',
            'amplitude': 1.0,
            'frequency': 1000.0,
            'n_harmonics': 1,
            'sample_rate': 200000.0,
            'pass_score': 70,
        },
        'theory': (
            "f(t) = (4A / pi) [ sin(wt) + (1/3) sin(3wt) + (1/5) sin(5wt) + ... ]\n\n"
            "Une onde carrée impaire ne contient que des harmoniques impaires, "
            "d'amplitude 4A / (n pi). Pour A = 1 : 1,273 pour n = 1, 0,424 pour n = 3, "
            "0,255 pour n = 5.\n\n"
            "La somme converge vers le carré partout sauf aux discontinuités, ou subsiste "
            "un dépassement d'environ 9 % : le phénomène de Gibbs. Il ne disparait jamais, "
            "il se resserre."
        ),
        'validation_rules': [
            {
                'id': 'm_h7',
                'type': 'milestone',
                'label': 'Monter jusqu’à l’harmonique 7 au moins',
                'points': 4,
                'check': {'left': 'n_harmonics', 'op': '>=', 'right': {'value': 7}},
            },
            {
                'id': 'm_h21',
                'type': 'milestone',
                'label': 'Pousser au-delà de l’harmonique 21 et observer Gibbs',
                'points': 2,
                'check': {'left': 'n_harmonics', 'op': '>=', 'right': {'value': 21}},
            },
            {
                'id': 'm_cible',
                'type': 'milestone',
                'label': 'Comparer avec une autre onde cible',
                'points': 2,
                'check': {'left': 'signal_type', 'op': 'in', 'right': ['triangle', 'sawtooth']},
            },
            {
                'id': 'q1',
                'type': 'numeric',
                'question': 'Lecture : amplitude de la fondamentale affichée pour A = 1 ?',
                'answer': 1.2732,
                'tolerance': 0.06,
                'points': 3,
                'feedback_ok': '4A / pi = 1,273.',
            },
        ],
    },
    {
        'lab_slug': 'signal-lab',
        'slug': 'transformee-de-fourier',
        'title': '03 - Transformée de Fourier',
        'order': 3,
        'difficulty': DifficultyType.intermediate.value,
        'duration_minutes': 30,
        'xp_reward': 170,
        'description': "Domaine temporel, spectre, FFT.",
        'objective': "Lire un signal dans les deux domaines et passer de l'un a l'autre.",
        'instructions': [
            {
                'title': 'Le signal',
                'content': (
                    "x(t) = sin(2 pi 1000 t) + 0,5 sin(2 pi 3000 t). Dans le temps, "
                    "c'est illisible."
                ),
            },
            {
                'title': "Passer à l'analyseur",
                'content': "Activez l'analyse spectrale. Combien de raies voyez-vous ?",
            },
            {
                'title': 'Lire les raies',
                'content': "Relevez la fréquence et la hauteur de chaque pic.",
                'hint': "La hauteur d'une raie est l'amplitude de la composante.",
            },
            {
                'title': 'Resolution',
                'content': (
                    "Changez la durée d'acquisition. Les raies s'affinent ou s'élargissent : "
                    "pourquoi ?"
                ),
            },
        ],
        'guide': {'formula': 'x(t) = sin(2·pi·1000·t) + 0,5·sin(2·pi·3000·t)', 'formula_note': 'Résolution de l’analyseur :  df = 1 / T   (T = durée d’acquisition)', 'example': [{'title': 'Énoncé', 'text': 'On analyse ce signal sur une fenêtre T = 20 ms. Que doit afficher l’analyseur de spectre ?'}, {'title': '1. Combien de raies ?', 'text': 'Deux sinusoïdes pures = deux composantes', 'result': '2 raies'}, {'title': '2. À quelles fréquences ?', 'text': 'Les fréquences des deux termes', 'result': '1 kHz et 3 kHz'}, {'title': '3. De quelle hauteur ?', 'text': 'La hauteur d’une raie est l’amplitude de la composante', 'result': '1,0 à 1 kHz   et   0,5 à 3 kHz'}, {'title': '4. Résolution', 'text': 'df = 1 / T = 1 / 0,020', 'result': 'df = 50 Hz'}, {'title': '5. Les raies sont-elles séparables ?', 'text': 'Écart entre les raies = 3000 − 1000 = 2000 Hz, très supérieur aux 50 Hz de résolution : elles sont nettement séparées. Avec T = 5 ms on aurait df = 200 Hz, encore séparées mais plus larges.'}], 'your_turn': 'À vous : quelle durée d’acquisition faut-il pour une résolution de 10 Hz ? (T = 1 / df = 100 ms). Réglez-la et regardez les raies s’affiner.'},
        'initial_parameters': {
            'components': [
                {'signal_type': 'sine', 'frequency': 1000.0, 'amplitude': 1.0},
                {'signal_type': 'sine', 'frequency': 3000.0, 'amplitude': 0.5},
            ],
            'duration': 0.02,
            'sample_rate': 200000.0,
            'window': 'none',
            'max_frequency': 8000.0,
            'pass_score': 70,
        },
        'theory': (
            "La transformée de Fourier associe à un signal temporel son contenu "
            "fréquentiel. Une somme de deux sinusoïdes donne deux raies, l'une a 1 kHz "
            "de hauteur 1, l'autre a 3 kHz de hauteur 0,5.\n\n"
            "Avec une fenêtre d'observation de durée T, la résolution fréquentielle vaut "
            "df = 1 / T. Observer 20 ms donne 50 Hz de résolution : deux raies plus proches "
            "que cela se confondent."
        ),
        'validation_rules': [
            {
                'id': 'm_duree',
                'type': 'milestone',
                'label': 'Allonger la fenêtre d’acquisition pour affiner les raies',
                'points': 4,
                'check': {'left': 'duration', 'op': '>=', 'right': {'value': 0.05}},
            },
            {
                'id': 'm_etendue',
                'type': 'milestone',
                'label': 'Élargir l’étendue affichée au-delà de 10 kHz',
                'points': 2,
                'check': {'left': 'max_frequency', 'op': '>=', 'right': {'value': 10000}},
            },
            {
                'id': 'q1',
                'type': 'numeric',
                'question': 'Lecture : fréquence du pic le plus haut, en Hz ?',
                'answer': 1000,
                'tolerance': 0.05,
                'unit': 'Hz',
                'points': 2,
            },
            {
                'id': 'q2',
                'type': 'numeric',
                'question': "Lecture : résolution affichée pour une acquisition de 20 ms, en Hz ?",
                'answer': 50,
                'tolerance': 0.1,
                'unit': 'Hz',
                'points': 2,
                'feedback_ok': 'df = 1 / T = 1 / 0,02 = 50 Hz.',
            },
        ],
    },
    {
        'lab_slug': 'signal-lab',
        'slug': 'echantillonnage',
        'title': '04 - Échantillonnage',
        'order': 4,
        'difficulty': DifficultyType.intermediate.value,
        'duration_minutes': 35,
        'xp_reward': 180,
        'description': "Nyquist, repliement, reconstruction.",
        'objective': (
            "Constater le repliement avant de lire le critère de Shannon, puis "
            "régler le banc pour le respecter."
        ),
        'instructions': [
            {
                'title': 'Le piège',
                'content': (
                    "Un signal de 5 kHz est échantillonné à 6 kHz. Regardez la courbe "
                    "reconstruite : quelle fréquence semble-t-elle avoir ?"
                ),
            },
            {
                'title': 'Le spectre',
                'content': "Ouvrez le spectre des échantillons. Où est passée la raie de 5 kHz ?",
                'hint': "Elle s'est repliée autour de la moitié de fe.",
            },
            {
                'title': 'Corriger',
                'content': (
                    "Montez la fréquence d'échantillonnage jusqu'à ce que la reconstruction "
                    "colle au signal d'origine."
                ),
            },
        ],
        'guide': {'formula': 'Critère de Shannon :  fe > 2·fmax', 'formula_note': 'Si le critère est violé, la fréquence apparente est |f − k·fe| repliée dans [0 ; fe/2]', 'example': [{'title': 'Énoncé', 'text': 'Un signal de f = 5 kHz est échantillonné à fe = 6 kHz. Que va-t-on voir à l’écran ?'}, {'title': '1. Le critère est-il respecté ?', 'text': 'fe/2 = 6000 / 2 = 3000 Hz, or f = 5000 Hz > 3000 Hz', 'result': 'NON — il y aura repliement'}, {'title': '2. Fréquence apparente', 'text': 'On cherche |f − k·fe| avec k = 1 :  |5000 − 6000|', 'result': '1000 Hz'}, {'title': '3. Est-elle bien dans la bande ?', 'text': '1000 Hz < fe/2 = 3000 Hz, donc c’est la valeur finale', 'result': 'fapp = 1 kHz'}, {'title': '4. Ce qu’on doit voir', 'text': 'La courbe reconstruite oscille à 1 kHz alors que le signal d’origine est à 5 kHz. Sur le spectre des échantillons, la raie est à 1 kHz : l’information de départ est perdue, et rien dans les échantillons ne permet de la retrouver.'}, {'title': '5. Correction', 'text': 'Il faut fe > 2 × 5000', 'result': 'fe > 10 kHz'}], 'your_turn': 'À vous : f = 8 kHz échantillonné à fe = 20 kHz. Vérifiez le critère (20000 > 16000, donc pas de repliement), puis faites-le sur le banc.'},
        'initial_parameters': {
            'signal_type': 'sine',
            'amplitude': 1.0,
            'frequency': 5000.0,
            'sampling_rate': 6000.0,
            'duration': 0.002,
            'reconstruct': True,
            'pass_score': 70,
        },
        'theory': (
            "Critère de Nyquist-Shannon : fe > 2 fmax.\n\n"
            "En dessous, les composantes au-delà de fe / 2 se replient dans la bande utile. "
            "Un signal de 5 kHz échantillonné à 6 kHz réapparaît à |5000 - 6000| = 1000 Hz : "
            "l'information originale est perdue, et rien dans les échantillons ne permet de "
            "la retrouver.\n\n"
            "La reconstruction ideale est l'interpolation par sinus cardinal, qui est "
            "exactement la courbe tracee par le laboratoire."
        ),
        'validation_rules': [
            {
                'id': 'm_alias',
                'type': 'milestone',
                'label': 'Observer un repliement (fe sous le critère de Shannon)',
                'points': 3,
                'check': {
                    'left': 'sampling_rate',
                    'op': '<',
                    'right': {'param': 'frequency', 'factor': 2},
                },
            },
            {
                'id': 'm_shannon',
                'type': 'milestone',
                'label': 'Corriger fe pour respecter fe > 2·fmax',
                'points': 4,
                'check': {
                    'left': 'sampling_rate',
                    'op': '>=',
                    'right': {'param': 'frequency', 'factor': 2},
                },
            },
            {
                'id': 'm_autre',
                'type': 'milestone',
                'label': 'Refaire l’essai sur une autre fréquence de signal',
                'points': 2,
                'check': {'left': 'frequency', 'op': '!=', 'right': {'value': 5000}},
            },
            {
                'id': 'q1',
                'type': 'numeric',
                'question': 'Lecture : fréquence apparente affichée pour 5 kHz échantillonné à 6 kHz, en Hz ?',
                'answer': 1000,
                'tolerance': 0.05,
                'unit': 'Hz',
                'points': 3,
                'feedback_ok': '|5000 - 6000| = 1000 Hz.',
            },
        ],
    },
    {
        'lab_slug': 'signal-lab',
        'slug': 'filtrage',
        'title': '05 - Filtrage',
        'order': 5,
        'difficulty': DifficultyType.intermediate.value,
        'duration_minutes': 35,
        'xp_reward': 190,
        'description': "Passe-bas, passe-haut, passe-bande, réjection.",
        'objective': "Choisir un filtre, lire sa réponse en fréquence et prevoir son effet.",
        'instructions': [
            {
                'title': 'Le signal',
                'content': (
                    "Un carré de 1 kHz contient les harmoniques 1, 3, 5, 7 kHz... "
                    "Vérifiez-le sur le spectre d'entree."
                ),
            },
            {
                'title': 'Passe-bas',
                'content': (
                    "Appliquez un passe-bas Butterworth d'ordre 4 a 2 kHz. Que reste-t-il "
                    "dans le spectre de sortie ?"
                ),
            },
            {
                'title': 'Lire le Bode',
                'content': "Sur la réponse du filtre, relevez la pente au-delà de la coupure.",
                'hint': "Un ordre n donne -20n dB par décade.",
            },
            {
                'title': 'Les autres familles',
                'content': "Essayez passe-haut, passe-bande et réjection sur le meme signal.",
            },
        ],
        'guide': {'formula': 'Butterworth d’ordre n :  |H(f)| = 1 / racine( 1 + (f/fc)^(2n) )', 'formula_note': '−3 dB à f = fc      pente de −20·n dB par décade au-delà', 'example': [{'title': 'Énoncé', 'text': 'Un carré de 1 kHz (A = 1 V) entre dans un passe-bas Butterworth d’ordre 4, coupure fc = 2 kHz. Que reste-t-il en sortie ?'}, {'title': '1. Contenu de l’entrée', 'text': 'Harmoniques du carré : 1 kHz (1,273 V), 3 kHz (0,424 V), 5 kHz (0,255 V)'}, {'title': '2. Gain à 1 kHz', 'text': 'f/fc = 1000/2000 = 0,5 → 0,5^8 = 0,0039 → |H| = 1/racine(1,0039)', 'result': '|H| = 0,998   (la fondamentale passe)'}, {'title': '3. Gain à 3 kHz', 'text': 'f/fc = 1,5 → 1,5^8 = 25,6 → |H| = 1/racine(26,6)', 'result': '|H| = 0,194   (fortement atténuée)'}, {'title': '4. Amplitudes de sortie', 'text': '1,273 × 0,998 = 1,27 V à 1 kHz   et   0,424 × 0,194 = 0,082 V à 3 kHz', 'result': 'la 3e harmonique tombe à 6 % de la fondamentale'}, {'title': '5. Ce qu’on doit voir', 'text': 'Le spectre de sortie montre ~1,27 à 1 kHz et ~0,08 à 3 kHz. La sortie redevient donc quasiment une sinusoïde : le filtre n’a pas agi sur la forme, il a agi sur le spectre, et la forme a suivi.'}], 'your_turn': 'À vous : refaites le calcul du gain à 3 kHz pour un ordre 2. (1,5^4 = 5,06 → |H| = 1/racine(6,06) = 0,406, soit bien moins atténué.) Changez l’ordre sur le banc et comparez.'},
        'initial_parameters': {
            'filter_type': 'low_pass',
            'cutoff': 2000.0,
            'order': 4,
            'family': 'butter',
            'signal_type': 'square',
            'amplitude': 1.0,
            'frequency': 1000.0,
            'duration': 0.02,
            'sample_rate': 200000.0,
            'pass_score': 70,
        },
        'theory': (
            "Un filtre agit sur le spectre, pas sur la forme : c'est la forme qui change "
            "parce que le spectre a change.\n\n"
            "Un Butterworth d'ordre n atténué de -20 n dB par décade au-delà de la fréquence "
            "de coupure, soit -80 dB/décade à l'ordre 4. À la coupure exacte, le gain vaut "
            "-3 dB quel que soit l'ordre.\n\n"
            "Appliqué à un carré de 1 kHz, un passe-bas à 2 kHz ne laisse passer que la "
            "fondamentale : la sortie redevient une sinusoïde."
        ),
        'validation_rules': [
            {
                'id': 'm_coupure',
                'type': 'milestone',
                'label': 'Descendre la coupure sous la 3e harmonique (≤ 2,5 kHz)',
                'points': 3,
                'check': {'left': 'cutoff', 'op': '<=', 'right': {'value': 2500}},
            },
            {
                'id': 'm_famille',
                'type': 'milestone',
                'label': 'Essayer un passe-haut ou un réjecteur',
                'points': 3,
                'check': {'left': 'filter_type', 'op': 'in', 'right': ['high_pass', 'band_stop', 'band_pass']},
            },
            {
                'id': 'm_ordre',
                'type': 'milestone',
                'label': 'Monter l’ordre du filtre à 6 ou plus',
                'points': 2,
                'check': {'left': 'order', 'op': '>=', 'right': {'value': 6}},
            },
            {
                'id': 'q1',
                'type': 'numeric',
                'question': 'Lecture : pente d’un Butterworth d’ordre 4, en dB par décade ?',
                'answer': -80,
                'tolerance': 0.1,
                'unit': 'dB/décade',
                'points': 3,
            },
        ],
    },
    # -- V0.2: seeded but unpublished, so shipping them is a flag flip --------
    {
        'lab_slug': 'signal-lab',
        'slug': 'convolution',
        'title': '06 - Convolution',
        'order': 6,
        'difficulty': DifficultyType.advanced.value,
        'duration_minutes': 40,
        'xp_reward': 200,
        'is_published': False,
        'description': "Convolution et réponse impulsionnelle.",
        'objective': "Comprendre ce qu'un système fait a un signal.",
        'instructions': [
            {'title': 'Réponse impulsionnelle', 'content': "Envoyez une impulsion dans un circuit RC."},
            {'title': 'Glisser', 'content': "Observez le noyau retourné qui balaye le signal."},
        ],
        'initial_parameters': {
            'signal_type': 'square',
            'frequency': 500.0,
            'kernel': 'rc',
            'resistance': 1000.0,
            'capacitance': 1e-6,
            'sample_rate': 50000.0,
            'pass_score': 70,
        },
        'theory': "y(t) = (x * h)(t) = intégrale de x(tau) h(t - tau) d tau.",
        'validation_rules': [
            {
                'id': 'q1',
                'type': 'text',
                'question': "Comment appelle-t-on h(t) ?",
                'answer': ['réponse impulsionnelle', 'impulse response'],
                'points': 2,
            },
        ],
    },
    {
        'lab_slug': 'signal-lab',
        'slug': 'laplace',
        'title': '07 - Laplace',
        'order': 7,
        'difficulty': DifficultyType.advanced.value,
        'duration_minutes': 45,
        'xp_reward': 220,
        'is_published': False,
        'description': "Équations, fonction de transfert, poles et zeros.",
        'objective': "Relier un circuit réel a sa fonction de transfert.",
        'instructions': [
            {'title': 'Le circuit', 'content': "Un RC série, sa réponse a un echelon."},
            {'title': 'H(s)', 'content': "Comparez la réponse mesuree et H(s) = 1 / (RCs + 1)."},
        ],
        'initial_parameters': {
            'resistance': 1000.0,
            'capacitance': 1e-6,
            'pass_score': 70,
        },
        'theory': "H(s) = 1 / (RCs + 1). Un pole en -1 / RC : le système est stable.",
        'validation_rules': [
            {
                'id': 'q1',
                'type': 'numeric',
                'question': "Constante de temps d'un RC avec R = 1 kOhm et C = 1 uF, en ms ?",
                'answer': 1.0,
                'tolerance': 0.05,
                'unit': 'ms',
                'points': 3,
            },
        ],
    },
]

# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

ACHIEVEMENTS: list[dict] = [
    {
        'slug': 'premiers-pas',
        'name': 'Premiers pas',
        'description': 'Valider une première expérience.',
        'icon': 'footprints',
        'xp_reward': 25,
        'criteria': {'type': AchievementCriteriaType.experiment_count.value, 'value': 1},
    },
    {
        'slug': 'fourier-explorer',
        'name': 'Fourier Explorer',
        'description': "Reconstruire une onde carrée à partir de ses harmoniques.",
        'icon': 'waves',
        'xp_reward': 50,
        'criteria': {
            'type': AchievementCriteriaType.experiment_completed.value,
            'experiment_slug': 'serie-de-fourier',
        },
    },
    {
        'slug': 'spectrum-hunter',
        'name': 'Spectrum Hunter',
        'description': 'Lire un spectre et identifier ses raies.',
        'icon': 'activity',
        'xp_reward': 50,
        'criteria': {
            'type': AchievementCriteriaType.experiment_completed.value,
            'experiment_slug': 'transformee-de-fourier',
        },
    },
    {
        'slug': 'gardien-de-nyquist',
        'name': 'Gardien de Nyquist',
        'description': 'Diagnostiquer un repliement et corriger la fréquence de échantillonnage.',
        'icon': 'shield-check',
        'xp_reward': 60,
        'criteria': {
            'type': AchievementCriteriaType.experiment_completed.value,
            'experiment_slug': 'echantillonnage',
        },
    },
    {
        'slug': 'maitre-des-filtres',
        'name': 'Maître des filtres',
        'description': 'Maîtriser les quatre familles de filtres.',
        'icon': 'sliders-horizontal',
        'xp_reward': 60,
        'criteria': {
            'type': AchievementCriteriaType.experiment_completed.value,
            'experiment_slug': 'filtrage',
        },
    },
    {
        'slug': 'signal-lab-complet',
        'name': 'SignalLab complet',
        'description': 'Terminer toutes les expériences publiées de SignalLab.',
        'icon': 'trophy',
        'xp_reward': 150,
        'criteria': {
            'type': AchievementCriteriaType.lab_completed.value,
            'lab_slug': 'signal-lab',
        },
    },
    {
        'slug': 'sans-faute',
        'name': 'Sans faute',
        'description': 'Obtenir 100 % a une expérience.',
        'icon': 'target',
        'xp_reward': 75,
        'criteria': {'type': AchievementCriteriaType.perfect_score.value, 'count': 1},
    },
    {
        'slug': 'mille-xp',
        'name': '1000 XP',
        'description': 'Accumuler 1000 points d expérience.',
        'icon': 'zap',
        'xp_reward': 0,
        'criteria': {'type': AchievementCriteriaType.total_xp.value, 'value': 1000},
    },
]


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------


async def seed() -> int:
    created = {'labs': 0, 'experiments': 0, 'achievements': 0}
    updated = {'labs': 0, 'experiments': 0, 'achievements': 0}

    async with async_db_session.begin() as db:
        lab_ids: dict[str, int] = {}

        for spec in LABS:
            spec = dict(spec)
            slug = spec.pop('slug')
            existing = (
                await db.execute(select(Lab).where(Lab.slug == slug))
            ).unique().scalars().first()
            if existing is None:
                lab = Lab(name=spec.pop('name'), slug=slug, type=spec.pop('type'))
                for field, value in spec.items():
                    setattr(lab, field, value)
                db.add(lab)
                await db.flush()
                lab_ids[slug] = lab.id
                created['labs'] += 1
            else:
                for field, value in spec.items():
                    setattr(existing, field, value)
                db.add(existing)
                lab_ids[slug] = existing.id
                updated['labs'] += 1

        for spec in EXPERIMENTS:
            spec = dict(spec)
            slug = spec.pop('slug')
            lab_id = lab_ids[spec.pop('lab_slug')]
            existing = (
                await db.execute(select(Experiment).where(Experiment.slug == slug))
            ).unique().scalars().first()
            if existing is None:
                experiment = Experiment(lab_id=lab_id, title=spec.pop('title'), slug=slug)
                for field, value in spec.items():
                    setattr(experiment, field, value)
                db.add(experiment)
                created['experiments'] += 1
            else:
                existing.lab_id = lab_id
                for field, value in spec.items():
                    setattr(existing, field, value)
                db.add(existing)
                updated['experiments'] += 1

        for spec in ACHIEVEMENTS:
            spec = dict(spec)
            slug = spec.pop('slug')
            existing = (
                await db.execute(select(Achievement).where(Achievement.slug == slug))
            ).unique().scalars().first()
            if existing is None:
                achievement = Achievement(name=spec.pop('name'), slug=slug)
                for field, value in spec.items():
                    setattr(achievement, field, value)
                db.add(achievement)
                created['achievements'] += 1
            else:
                for field, value in spec.items():
                    setattr(existing, field, value)
                db.add(existing)
                updated['achievements'] += 1

    for kind in ('labs', 'experiments', 'achievements'):
        print(f'[ok] {kind}: {created[kind]} created, {updated[kind]} updated')
    return 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(seed()))
