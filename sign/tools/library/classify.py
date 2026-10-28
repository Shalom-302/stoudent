"""Turn the raw fomesoutra listing into STOUDENT library entries.

usage: python -I classify.py catalog.json [cours.json ...] out.json
"""
import json
import re
import sys
import unicodedata

SOURCE = 'fomesoutra.com'
TC = 'Tronc commun'

# Top-level folder -> filière code.
FILIERE_BY_FOLDER = {
    'bts-industriel-1': 'FI',
    'bts-filieres-finances': 'FA',
    'bts-filieres-comptabilite': 'FC',
    'bts-filieres-ressources-humaines-et-communication': 'RHC',
    'bts-filieres-sciences-de-l-information': 'SDI',
    'bts-filieres-logistique': 'LOG',
    'bts-filieres-assistanat-de-direction': 'AD',
    'bts-filieres-carrieres-juridiques': 'CJ',
    'bts-filieres-gestion-commerciale': 'GC',
    'bts-filieres-gestion-des-collectives-territoriales': 'GCT',
    'bts-filieres-tourisme-hotellerie': 'TH',
    # Entrepreneuriat is a paper every filière sits, not a filière.
    'entreprenariat': None,
    'bts-entrepreneuriat': None,
    'bts-filieres-g2': 'FT',
    # Fourier, Laplace, équations différentielles: the industrial maths programme.
    'bts-go': 'FI',
    'bts-genie-civil-option-batiment': 'GCB',
    'bts-filieres-moteur-et-mecanique-automobile': 'MMA',
    'bts-filieres-maintenance-des-systemes-de-production': 'MSP',
    'bts-filieres-reseaux-informatique': 'RIT',
    'bts-electrotechnique': 'ELT',
    # cours
    'bts-droit': 'CJ',
    'bts-electronique': 'SEI',
    'bts-industriel': 'FI',
    'bts-tourisme': 'TH',
    'cours-de-comptabilite-analytique-niveau-bts': 'FC',
    'cours-de-comptabilite-analytique-2eme-annee': 'FC',
    'cours-informatiques-sup': 'IDA',
    'cours-licence-systemes-et-reseaux-informatiques-et-telecommunications-srit-esatic': 'RIT',
    'cours-du-centre-des-metiers-de-l-electricite-cme': 'ELT',
}

# Sub-folder slug (numbers stripped) -> matière, or (matière, chapitre).
SUBJECT_BY_FOLDER = {
    'economie': 'Économie générale',
    'techniques-d-expression-francaises': 'Techniques d’expression française',
    'anglais': 'Anglais',
    'anglais-bts-finances-comptabilite': 'Anglais',
    'anglais-direction': 'Anglais',
    'mathematiques-statistiques-et-probabilite': 'Maths : statistiques et probabilités',
    'mathematiques-financieres-et-recherche-operationnelle': 'Maths financières et recherche opérationnelle',
    'mathematiques-bts-filieres-industrielles': 'Mathématiques',
    'gestion-financiere': 'Gestion financière',
    'informatique': 'Informatique',
    'marketing': 'Marketing',
    'fiscalite': 'Fiscalité',
    'etude-de-cas': 'Étude de cas',
    'etude-de-cas-bts-indus': 'Étude de cas',
    'etude-de-cas-bts-finance-assurance': 'Étude de cas',
    'etude-de-cas-finances-comptabilite': 'Étude de cas',
    'etude-de-cas-bts-ressources': 'Étude de cas',
    'cas-assistanat-direction': 'Étude de cas',
    'enquete-de-satisfaction': 'Enquête de satisfaction',
    'developpement-des-ressources-humaines': 'Développement des ressources humaines',
    'legislation-bts': 'Législation',
    'psychologie-appliquee': 'Psychologie appliquée',
    'management-des-transports-et-gestion-des-moyens-generaux': 'Management des transports',
    'tqg-bts': 'Techniques quantitatives de gestion',
    'droit-et-contentieux-bancaire-bts-finances-assurance': 'Droit et contentieux bancaire',
    'gestion': 'Gestion',
    'reseaux-informatiques': 'Réseaux informatiques',
    'probabilite-bts-g2': ('Mathématiques', 'Probabilités'),
    'suites-numeriques-bts-g2': ('Mathématiques', 'Suites numériques'),
    'maths-bts-go': 'Mathématiques',
    'maths-blanc-bts-go': 'Mathématiques',
    'maths-tp-bts-go': 'Mathématiques',
    'management-de-la-force-de-vente': 'Management de la force de vente',
    'communication-et-gestion-des-ressources-humaines': 'Communication et GRH',
    'etude-de-cas-tourisme': 'Étude de cas',
    'cours-d-economie': 'Économie générale',
    'cours-d-electronique-de-puissance': 'Électronique de puissance',
    'cours-d-electrotechnique': 'Électrotechnique',
    'cours-de-maintenance-industrielle': 'Maintenance industrielle',
    'cours-de-mathematiques': 'Mathématiques',
    'cours-sur-l-installation-industrielle': 'Installations industrielles',
    'electronique-licence-systemes-et-reseaux-informatiques-et-telecommunications-srit': 'Électronique',
    'td-electronique-srit-esatic': 'Électronique',
    'td-electronique-portant-sur-les-diodes': ('Électronique', 'Diodes'),
    'td-electronique-portant-sur-les-quadripoles': ('Électronique', 'Quadripôles'),
    'td-electronique-portant-sur-les-transistors-esatic': ('Électronique', 'Transistors'),
    'informatique-licence-systemes-et-reseaux-informatiques-et-telecommunications-srit': 'Informatique',
    'td-informatique-srit-esatic': 'Informatique',
    'systeme-lineaire-mathematiques': ('Mathématiques', 'Systèmes linéaires'),
}

# Folders that say what kind of document they hold.
KIND_BY_FOLDER = {
    'td-electronique-srit-esatic': 'td',
    'td-informatique-srit-esatic': 'td',
    'bts-electrotechnique-anciens-sujets-dexamens-et-devoirs': 'sujet',
    'bts-electrotechnique-td-tp': 'td',
    'maths-tp-bts-go': 'td',
    'maths-blanc-bts-go': 'sujet',
}

TOP_SUBJECT = {
    'bts-droit': 'Droit',
    'cours-de-comptabilite-analytique-niveau-bts': 'Comptabilité analytique',
    'cours-de-comptabilite-analytique-2eme-annee': 'Comptabilité analytique',
}

SRIT = 'cours-licence-systemes-et-reseaux-informatiques-et-telecommunications-srit-esatic'

CHAPTER_NOISE = {'bts', 'g2', 'go', 'tp', 'maths', 'math'}


def chapter_from(slug: str) -> str:
    words = [w for w in slug.split('-') if w not in CHAPTER_NOISE and not w.isdigit()]
    text = ' '.join(words).replace('integral', 'intégrales').replace('equations differentielles', 'équations différentielles')
    text = text.replace('transformee', 'transformée').replace('fonctions reelles', 'fonctions réelles')
    text = text.replace('suites numeriques', 'suites numériques').replace('probabilite', 'probabilités')
    text = text.replace('calcul d intégrales', 'calcul intégral')
    return text[:1].upper() + text[1:]

# Title keywords -> matière, tried in order when the folder does not say.
SUBJECT_BY_TITLE = [
    (r'entrepren', 'Entrepreneuriat'),
    (r'anglais|english|\bangl', 'Anglais'),
    (r'espagnol', 'Espagnol'),
    (r'syst[eè]mes? d.exploitation', 'Systèmes d’exploitation'),
    (r'physique appliqu|pysique appliqu|\bpa\b', 'Physique appliquée'),
    (r'\bepp\b', 'Épreuve professionnelle pratique'),
    (r'\bese\b', 'Étude de systèmes électriques'),
    (r'\bge\b|g[ée]nie [ée]lectrique', 'Génie électrique'),
    (r'\bgee?\b|genie elect?r?ique|disjoncteur', 'Génie électrique'),
    (r'etude des systemes electriques', 'Étude de systèmes électriques'),
    (r'onduleur|courant continu|hacheur|redresseur', 'Électronique de puissance'),
    (r'technologie (des structures|de la construction)', 'Technologie de la construction'),
    (r'\bmetre\b', 'Métré'),
    (r'materiaux', 'Matériaux'),
    (r'routes|ouvrages? d.art', 'Routes et ouvrages'),
    (r'commerce international|import export', 'Commerce international'),
    (r'comptabilit', 'Comptabilité'),
    (r'enquete de satisfaction', 'Enquête de satisfaction'),
    (r'fourier', 'Mathématiques'),
    (r'commutation', 'Commutation'),
    (r'optocoupl|transistor|amplificateur|diode', 'Électronique'),
    (r'alternateur|moteur asynchrone|transformateur|machine', 'Machines électriques'),
    (r'psycholog', 'Psychologie appliquée'),
    (r'hydraulique', 'Hydraulique'),
    (r'technologie du b[âa]timent', 'Technologie du bâtiment'),
    (r'\btca\b', 'TCA'),
    (r'r[ée]seaux? t[ée]l[ée]phon', 'Réseaux téléphoniques'),
    (r'reseaux? d.acces|gsm|reseaux? mobiles?|telecom|telephonie|fibre optique|wifi', 'Réseaux téléphoniques'),
    (r'traitement (du|des|de) signa', 'Traitement du signal'),
    (r'analyse economique', 'Économie générale'),
    (r'algebre|diagonalis|integral|derivee|equations? diff', 'Mathématiques'),
    (r'transmission', 'Transmissions'),
    (r'[ée]lectronique', 'Électronique'),
    (r'[ée]lectrotechn', 'Électrotechnique'),
    (r'r[ée]seaux? (info|locaux)|r[ée]seau informatique', 'Réseaux informatiques'),
    (r'algo', 'Algorithmique'),
    (r'base de donn[ée]es|\bsql\b|merise', 'Bases de données'),
    (r'programmation|langage c\b|java|python', 'Programmation'),
    (r'recherche op[ée]rationnelle|maths? fin|math[ée]matiques? financi', 'Maths financières et recherche opérationnelle'),
    (r'stat|proba', 'Maths : statistiques et probabilités'),
    (r'\bmaths?\b|math[ée]matique', 'Mathématiques'),
    (r'comptabilit[ée] analytique|compta analytique', 'Comptabilité analytique'),
    (r'comptabilit[ée] (g[ée]n[ée]rale|des soci)|\bcompta\b', 'Comptabilité'),
    (r'fiscal', 'Fiscalité'),
    (r'gestion financi', 'Gestion financière'),
    (r'marketing|mercatique', 'Marketing'),
    (r'[ée]tude de cas', 'Étude de cas'),
    (r'informatique', 'Informatique'),
    (r'fran[çc]ais|\bfra?n?\b|expression|\btef\b|culture g[ée]n[ée]rale', 'Techniques d’expression française'),
    (r'[ée]conomie', 'Économie générale'),
    (r'droit', 'Droit'),
    (r'management', 'Management'),
    (r'r[ée]sistance des mat[ée]riaux|b[ée]ton', 'RDM et béton armé'),
    (r'topograph', 'Topographie'),
    (r'dessin', 'Dessin technique'),
    (r'm[ée]canique', 'Mécanique'),
    (r'automatisme', 'Automatisme'),
    (r'rapport de stage', 'Rapport de stage'),
]

# A filière named in a title (BTS root folder, FI / FT shelves).
FILIERE_BY_TITLE = [
    (r'\bida\b|d[ée]veloppeur d.?application', 'IDA'),
    (r'\brit\b|r[ée]seaux? info(rmatiques?)? et t[ée]l[ée]com', 'RIT'),
    (r'g[ée]nie civil|esbtp|\bbtp\b|b[âa]timent', 'GCB'),
    (r'tertiaire', 'FT'),
    (r'industriel', 'FI'),
    (r'[ée]lectrotechn', 'ELT'),
    (r'\bmsp\b|maintenance des syst', 'MSP'),
    (r'finances? compta|\bfcge\b|comptabilit[ée] et gestion', 'FC'),
    (r'gestion commerciale', 'GC'),
    (r'logistique', 'LOG'),
    (r'ressources humaines', 'RHC'),
    (r'assistanat|assistant de direction', 'AD'),
    (r'hygi[èe]ne et s[ée]curit[ée]', 'FI'),
    (r'\bfi\b', 'FI'),
    (r'\bft\b', 'FT'),
]

YEAR = re.compile(r'(?<!\d)(19[9]\d|20[0-2]\d)(?!\d)')
AUTHOR = re.compile(r'\bby\s+([A-Za-zÀ-ÿ]+)', re.I)


def fold(text: str) -> str:
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()


def kind_of(title: str) -> str:
    t = fold(title)
    if 'corrig' in t:
        return 'corrige'
    if re.search(r'\bcours\b|resume|polycop|support', t):
        return 'cours'
    if re.search(r'\btd\b|travaux dirig|exercice|serie|fiche de td', t):
        return 'td'
    if re.search(r'rapport de stage|liste des epreuves|memoire|programme', t):
        return 'autre'
    return 'sujet'


def clean_title(raw: str, subject: str | None, kind: str, year: int | None) -> str:
    t = re.sub(r'\.pdf$', '', raw.strip(), flags=re.I)
    t = AUTHOR.sub('', t)
    t = re.sub(r'\bBTS\s+CI\b', 'BTS', t, flags=re.I)
    t = re.sub(r'\s+', ' ', t).strip(' -_.,')
    # Names like "BTS FR 555" or "bts angl6666": rebuild a readable one.
    words = [w for w in re.findall(r'[A-Za-zÀ-ÿ]{3,}', t) if fold(w) not in ('bts', 'sujet', 'session')]
    if len(words) < 2 or re.search(r'\d{3,}', re.sub(YEAR, '', t)):
        labels = {'sujet': 'Sujet', 'corrige': 'Corrigé', 'cours': 'Cours', 'td': 'TD', 'autre': 'Document'}
        t = f"{labels[kind]} de {subject[0].lower() + subject[1:] if subject else 'BTS'}"
        if year:
            t += f' · session {year}'
    elif t.isupper() or sum(c.isupper() for c in t) > 0.6 * sum(c.isalpha() for c in t):
        t = t.capitalize()
        t = re.sub(r'\bbts\b', 'BTS', t, flags=re.I)
    return t[:200]


PUBLISHERS = re.compile(r'\b(livre|dunod|nathan|foucher|hachette|ellipses|eyrolles|breal|vuibert|bordas|casteilla|delagrave|pearson)\b')


def is_published_book(title: str) -> bool:
    return bool(PUBLISHERS.search(fold(title)))


def classify(doc: dict) -> dict:
    title = doc['title']
    t = fold(title)
    parts = (doc.get('category') or '').split('/')
    top = parts[0] if parts and parts[0] else None
    sub = re.sub(r'-\d+$', '', parts[-1]) if len(parts) > 1 else None

    filiere = FILIERE_BY_FOLDER.get(top) if top else None
    if top in ('entreprenariat', 'bts-entrepreneuriat'):
        # Their filière, when the title names one; otherwise the shared shelf.
        for pattern, code in FILIERE_BY_TITLE:
            if re.search(pattern, t):
                filiere = code
                break
    if filiere in (None, 'FI', 'FT'):
        for pattern, code in FILIERE_BY_TITLE:
            if re.search(pattern, t):
                if code not in ('FI', 'FT') or filiere is None:
                    filiere = code
                break

    subject = chapter = None
    folder_kind = next((KIND_BY_FOLDER[p] for p in reversed(parts) if p in KIND_BY_FOLDER), None)
    folder_subject = SUBJECT_BY_FOLDER.get(sub) if sub else None
    # bts-go/maths-bts-go/maths-tp-bts-go/<chapitre>: matière above, chapitre last.
    if folder_subject is None and len(parts) >= 3:
        folder_subject = SUBJECT_BY_FOLDER.get(re.sub(r'-\d+$', '', parts[1]))
        if folder_subject:
            chapter = chapter_from(parts[-1])
    if isinstance(folder_subject, tuple):
        subject, chapter = folder_subject
    elif folder_subject:
        subject = folder_subject
    if subject is None and top in TOP_SUBJECT:
        subject = TOP_SUBJECT[top]
    if subject is None:
        for pattern, name in SUBJECT_BY_TITLE:
            if re.search(pattern, t):
                subject = name
                break
    if top in ('entreprenariat', 'bts-entrepreneuriat') and subject in (None, 'Mathématiques'):
        subject = 'Entrepreneuriat'

    common = {'Techniques d’expression française', 'Anglais', 'Espagnol', 'Économie générale'}
    if filiere is None:
        filiere = TC if subject in common or subject in ('Mathématiques', 'Entrepreneuriat', None) else 'FT'

    years = [int(y) for y in YEAR.findall(title) if 1995 <= int(y) <= 2026]
    year = max(years) if years else None
    kind = kind_of(title)
    if kind == 'sujet' and folder_kind:
        kind = folder_kind
    if kind == 'sujet' and doc.get('section') == 'cours':
        kind = 'cours'
    author = AUTHOR.search(title)

    return {
        'title': clean_title(title, subject, kind, year),
        'url': doc['url'],
        'filiere': filiere,
        'subject': subject,
        'chapter': chapter,
        'kind': kind,
        'session_year': year,
        'source': SOURCE,
        'original_author': author.group(1).upper() if author else None,
        'description': ' '.join(
            part
            for part in (
                'Cours de licence SRIT (ESATIC), utile en BTS RIT.' if top == SRIT else None,
                f'Titre d’origine : {title}' if clean_title(title, subject, kind, year) != title else None,
            )
            if part
        )
        or None,
    }


def main() -> None:
    *inputs, out = sys.argv[1:]
    docs = []
    for path in inputs:
        section = 'cours' if 'cours' in path else 'sujets'
        for d in json.load(open(path, encoding='utf-8')):
            d['section'] = section
            docs.append(d)
    seen, entries = set(), []
    for d in docs:
        if d['url'] in seen or is_published_book(d['title']):
            continue
        seen.add(d['url'])
        entries.append(classify(d))
    entries.sort(key=lambda e: (e['filiere'], e['subject'] or '~', -(e['session_year'] or 0), e['title']))
    json.dump(entries, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    from collections import Counter

    print(len(entries), 'entries')
    print(Counter(e['filiere'] for e in entries).most_common())
    print(Counter(e['kind'] for e in entries).most_common())
    print('no subject:', sum(1 for e in entries if not e['subject']))


if __name__ == '__main__':
    main()
