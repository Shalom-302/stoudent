"""Demo community: one student per filière, each asking questions in its matières.

Run once on a fresh deployment so the feed is not empty on day one:

    python -m backend.cli seed-demo

Idempotent: an account is matched on its pseudo, a question on its title, so
running it again creates nothing twice. The accounts use numbers in the 225 00
range, which no Ivorian operator assigns, so no real person is ever messaged.
"""
from sqlalchemy import select

from backend.app.admin.schema.user import UserRegister
from backend.crud.crud_student import avatar_dao, student_dao
from backend.crud.crud_user import user_dao
from backend.database.db_postgres import async_db_session
from backend.models.community import Question

DEMO_ACCOUNTS: list[dict] = [
    {
        'pseudo': 'yao.rit',
        'phone': '2250000000101',
        'filiere': 'RIT',
        'level': 'BTS 2',
        'questions': [
            {
                'subject': 'Traitement du signal',
                'tags': ['shannon', 'echantillonnage'],
                'title': 'Pourquoi mon signal à 5 kHz apparaît à 1 kHz quand j’échantillonne à 6 kHz ?',
                'body': (
                    "En TP j'ai généré une sinusoïde à 5 kHz et je l'échantillonne à 6 kHz. "
                    "Sur l'analyseur de spectre la raie sort à 1 kHz au lieu de 5 kHz. "
                    "Je ne comprends pas d'où vient ce 1 kHz ni quelle fréquence choisir."
                ),
            },
            {
                'subject': 'GSM',
                'tags': ['gsm', 'hlr', 'vlr'],
                'title': 'Quelle est la différence entre le HLR et le VLR dans un réseau GSM ?',
                'body': (
                    "Dans le cours on parle de HLR et de VLR pour la localisation de l'abonné. "
                    "Les deux stockent des infos sur l'abonné, alors à quoi sert chacun, "
                    "et lequel est interrogé quand je reçois un appel ?"
                ),
            },
        ],
    },
    {
        'pseudo': 'awa.ida',
        'phone': '2250000000102',
        'filiere': 'IDA',
        'level': 'BTS 1',
        'questions': [
            {
                'subject': 'Merise',
                'tags': ['merise', 'mcd', 'mld'],
                'title': 'Comment passer du MCD au MLD avec une association plusieurs-à-plusieurs ?',
                'body': (
                    "J'ai un MCD avec ÉTUDIANT et COURS reliés par l'association SUIVRE (0,n - 0,n). "
                    "Au passage au MLD je ne sais pas où mettre les clés : dans ÉTUDIANT, dans COURS, "
                    "ou faut-il une nouvelle table ?"
                ),
            },
            {
                'subject': 'Bases de données',
                'tags': ['sql', 'group-by'],
                'title': 'Quelle requête SQL pour compter le nombre de commandes par client ?',
                'body': (
                    "J'ai une table commande(id, client_id, date, montant). Je veux afficher chaque "
                    "client avec son nombre de commandes, y compris ceux qui n'en ont aucune. "
                    "Mon GROUP BY oublie les clients sans commande."
                ),
            },
        ],
    },
    {
        'pseudo': 'kone.elt',
        'phone': '2250000000103',
        'filiere': 'ELT',
        'level': 'BTS 2',
        'questions': [
            {
                'subject': 'Machines électriques',
                'tags': ['moteur-asynchrone', 'glissement'],
                'title': 'Comment calculer le glissement d’un moteur asynchrone à 1440 tr/min ?',
                'body': (
                    "Moteur asynchrone 4 pôles alimenté en 50 Hz, il tourne à 1440 tr/min en charge. "
                    "Je dois trouver la vitesse de synchronisme et le glissement en pourcentage. "
                    "Je ne sais pas d'où sortir la vitesse de synchronisme."
                ),
            },
            {
                'subject': 'Schémas électriques',
                'tags': ['demarrage', 'etoile-triangle'],
                'title': 'Pourquoi utilise-t-on le démarrage étoile-triangle sur les gros moteurs ?',
                'body': (
                    "Dans le schéma de puissance on passe d'abord en étoile puis en triangle. "
                    "Quel est l'intérêt par rapport à un démarrage direct, et quand bascule-t-on ?"
                ),
            },
        ],
    },
    {
        'pseudo': 'fatou.sei',
        'phone': '2250000000104',
        'filiere': 'SEI',
        'level': 'BTS 1',
        'questions': [
            {
                'subject': 'Électronique numérique',
                'tags': ['logique', 'karnaugh'],
                'title': 'Comment simplifier une équation logique avec un tableau de Karnaugh ?',
                'body': (
                    "J'ai la fonction S = A'B'C + A'BC + AB'C + ABC. On me demande de la simplifier "
                    "avec un tableau de Karnaugh. Je n'arrive pas à faire les regroupements."
                ),
            },
            {
                'subject': 'Microcontrôleurs',
                'tags': ['arduino', 'pwm'],
                'title': 'Comment faire varier la luminosité d’une LED avec la PWM sur Arduino ?',
                'body': (
                    "Je veux que la LED s'allume progressivement. digitalWrite ne fait que allumer "
                    "ou éteindre. Quelle broche et quelle fonction utiliser ?"
                ),
            },
        ],
    },
    {
        'pseudo': 'bamba.msp',
        'phone': '2250000000105',
        'filiere': 'MSP',
        'level': 'BTS 2',
        'questions': [
            {
                'subject': 'Maintenance',
                'tags': ['amdec', 'criticite'],
                'title': 'Comment calculer la criticité dans une AMDEC ?',
                'body': (
                    "Pour une AMDEC machine on a la fréquence, la gravité et la détection notées de 1 à 4. "
                    "Comment calcule-t-on la criticité et à partir de quelle valeur faut-il agir ?"
                ),
            },
            {
                'subject': 'Pneumatique',
                'tags': ['verin', 'distributeur'],
                'title': 'Quelle différence entre un distributeur 5/2 et un 3/2 pour commander un vérin ?',
                'body': (
                    "Sur le banc pneumatique on a un vérin simple effet et un double effet. "
                    "Lequel se commande avec un 3/2 et lequel avec un 5/2, et pourquoi ?"
                ),
            },
        ],
    },
    {
        'pseudo': 'marie.fc',
        'phone': '2250000000106',
        'filiere': 'FCGE',
        'level': 'BTS 2',
        'questions': [
            {
                'subject': 'Fiscalité',
                'tags': ['tva', 'facturation'],
                'title': 'Comment retrouver la TVA d’une facture de 590 000 F TTC ?',
                'body': (
                    "Le client a payé 590 000 F TTC. Je dois retrouver le montant HT et la TVA "
                    "collectée au taux normal. Je ne sais pas s'il faut multiplier ou diviser."
                ),
            },
            {
                'subject': 'Comptabilité générale',
                'tags': ['immobilisation', 'journal'],
                'title': 'Comment enregistrer au journal l’achat d’un véhicule de société à crédit ?',
                'body': (
                    "L'entreprise achète un véhicule de 12 000 000 F HT, payable dans 60 jours. "
                    "Quels comptes débiter et créditer, et la TVA se récupère-t-elle sur un véhicule ?"
                ),
            },
        ],
    },
]


async def seed(password: str) -> int:
    created_users = created_questions = 0
    async with async_db_session.begin() as db:
        for account in DEMO_ACCOUNTS:
            user = await user_dao.get_by_pseudo(db, account['pseudo'])
            if user is None:
                user = await user_dao.add(
                    db,
                    UserRegister(
                        phone=account['phone'],
                        pseudo=account['pseudo'],
                        password=password,
                        filiere=account['filiere'],
                        level=account['level'],
                    ),
                )
                created_users += 1
            profile = await student_dao.get_by_user_id(db, user.id) or await student_dao.create_for_user(db, user.id)
            profile.filiere = account['filiere']
            profile.level = account['level']
            if await avatar_dao.get_by_student(db, profile.id) is None:
                await avatar_dao.create_default(db, profile.id)

            for q in account['questions']:
                exists = (await db.execute(select(Question.id).where(Question.title == q['title']))).first()
                if exists:
                    continue
                db.add(
                    Question(
                        author_id=user.id,
                        title=q['title'],
                        body=q['body'],
                        filiere=account['filiere'],
                        subject=q['subject'],
                        tags=q['tags'],
                    )
                )
                created_questions += 1

    print(f"[ok] demo accounts: {created_users} created, {len(DEMO_ACCOUNTS) - created_users} already there")
    print(f"[ok] demo questions: {created_questions} created")
    return 0
