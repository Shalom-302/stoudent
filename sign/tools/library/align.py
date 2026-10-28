"""Align the library on the official BTS programme (DECO / MESRS).

usage: python -I align.py mesrs.json library_raw.json library_bts.json programme_bts.json

- Filière codes become the official ones (FC -> FCGE, GC -> GEC...).
- A document of a filière gets, as matière, the official épreuve it prepares
  ("Électronique" in RIT -> "Électronique analogique et numérique").
- Documents shared by a family of filières (FI, FT) or by all (Tronc commun)
  keep a common matière; the programme says which épreuves they feed.
- What maps to no épreuve stays in the filière as "Autres documents".
"""
import json
import re
import sys
import unicodedata

TC = 'Tronc commun'
SHELVES = {'industrielle': ['FI', TC], 'tertiaire': ['FT', TC]}
# Documents the source files under one filière but that prepare another's épreuve.
MOVE = {('ELT', 'Maintenance industrielle'): 'MSP'}
OUR_TO_OFFICIAL = {'FC': 'FCGE', 'GC': 'GEC', 'GCB': 'GBAT', 'MMA': '2MA', 'CJ': 'CJPI', 'SDI': 'SIN'}

# Common matières, as stored on shared-shelf documents.
COMMON = {
    'Techniques d’expression française',
    'Anglais',
    'Espagnol',
    'Économie générale',
    'Gestion',
    'Entrepreneuriat',
    'Mathématiques',
    'Maths : statistiques et probabilités',
    'Maths financières et recherche opérationnelle',
    'Informatique',
    'Droit',
    'Comptabilité',
    'Psychologie appliquée',
}

# Classifier matière -> patterns of épreuve names, best first. The first
# épreuve of the filière matching a pattern wins.
RULES: dict[str, list[str]] = {
    'Techniques d’expression française': [r'expression francaise'],
    'Anglais': [r'^anglais'],
    'Espagnol': [r'espagnol'],
    'Économie générale': [r'^economie$'],
    'Gestion': [r'^gestion$'],
    'Entrepreneuriat': [r'entrepreneuriat'],
    'Mathématiques': [r'^mathematiques$', r'traitement des signaux et math', r'mathematiques financieres et stat'],
    'Maths : statistiques et probabilités': [r'^mathematiques$', r'financieres et stat', r'traitement des signaux et math'],
    'Maths financières et recherche opérationnelle': [r'financieres et recherche', r'recherche operationnelle', r'financieres et stat', r'techniques quantitatives'],
    'Techniques quantitatives de gestion': [r'techniques quantitatives'],
    'Physique appliquée': [r'physiques? appliquee'],
    'Étude de systèmes électriques': [r'systemes electriques'],
    'Génie électrique': [r'genie electrique', r'systemes electriques'],
    'Machines électriques': [r'systemes electriques', r'genie electrique', r'physiques? appliquee'],
    'Électrotechnique': [r'systemes electriques', r'genie electrique', r'physiques? appliquee'],
    'Installations industrielles': [r'etude des installations', r'systemes electriques'],
    'Maintenance industrielle': [r'maintenance industrielle'],
    'Épreuve professionnelle pratique': [r'^epp \(theorie'],
    'Électronique': [r'electronique analogique', r'physiques? appliquee', r'systemes techniques'],
    'Électronique de puissance': [r'physiques? appliquee', r'electronique analogique'],
    'Réseaux informatiques': [r'telecommunication et reseaux', r'teleinformatique'],
    'Réseaux téléphoniques': [r'telecommunication et reseaux'],
    'Transmissions': [r'telecommunication et reseaux', r'teleinformatique'],
    'Commutation': [r'telecommunication et reseaux'],
    'Informatique': [r'^informatique$', r'architecture des systemes informatiques', r'^etude de cas$'],
    'Algorithmique': [r'^etude de cas$', r'^informatique$'],
    'Programmation': [r'^etude de cas$', r'^informatique$'],
    'Bases de données': [r'^etude de cas$', r'^informatique$'],
    'Systèmes d’exploitation': [r'architecture des systemes informatiques', r'^etude de cas$', r'^informatique$'],
    'Étude de cas': [r'^etude de cas'],
    'Fiscalité': [r'fiscalite'],
    'Gestion financière': [r'gestion financiere'],
    'Marketing': [r'^marketing', r'mercatique', r'concepts marketing'],
    'Comptabilité': [r'^comptabilite', r'^etude de cas$', r'gestion financiere'],
    'Comptabilité analytique': [r'^comptabilite', r'^etude de cas$', r'gestion financiere'],
    'Traitement du signal': [r'traitement des signaux', r'physiques? appliquee'],
    'Droit': [r'^droit des affaires', r'^droit', r'legislation'],
    'Droit et contentieux bancaire': [r'contentieux bancaire'],
    'Législation': [r'legislation', r'^droit des affaires'],
    'Psychologie appliquée': [r'psychologie'],
    'Enquête de satisfaction': [r'enquete de satisfaction'],
    'Développement des ressources humaines': [r'developpement des ressources'],
    'Management des transports': [r'management des transports'],
    'Management de la force de vente': [r'force de vente'],
    'Commerce international': [r'commerce international'],
    'Communication et GRH': [r'communication et grh'],
    'RDM et béton armé': [r'resistance des materiaux'],
    'Topographie': [r'topographie'],
    'Technologie de la construction': [r'technologie des structures', r'technique du batiment'],
    'Technologie du bâtiment': [r'technologie des structures', r'technique du batiment'],
    'Matériaux': [r'geotechniques'],
    'Métré': [r'metre'],
    'Routes et ouvrages': [r'routes'],
    'Hydraulique': [r'hydraulique'],
}
# Shelf documents of these matières are too specific to feed another filière.
NOT_SHARED = {'Étude de cas', 'Épreuve professionnelle pratique'}

ACCENTS = [
    (r'^Economie', 'Économie'),
    (r'^Etude', 'Étude'),
    (r'^Electronique', 'Électronique'),
    (r'^Epreuve', 'Épreuve'),
    (r'^Enquête', 'Enquête'),
    (r'Fran�aise', 'Française'),
]


def fold(text: str) -> str:
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower().strip()


def pretty(name: str) -> str:
    name = name.replace("'", '’').strip()
    for pattern, repl in ACCENTS:
        name = re.sub(pattern, repl, name)
    return name


def epreuve_for(subject: str | None, epreuves: list[dict]) -> dict | None:
    if not subject:
        return None
    for pattern in RULES.get(subject, []):
        for e in epreuves:
            if re.search(pattern, fold(e['name'])):
                return e
    # The matière is already an épreuve name (a member's suggestion).
    for e in epreuves:
        if fold(e['name']) == fold(subject):
            return e
    return None


def main() -> None:
    mesrs_path, raw_path, library_out, programme_out = sys.argv[1:]
    mesrs = json.load(open(mesrs_path, encoding='utf-8'))
    programme = []
    for f in mesrs:
        epreuves = [
            {'name': pretty(e['name']), 'nature': e['nature'], 'coefficient': e['coefficient'], 'shared_subjects': []}
            for e in f['epreuves']
        ]
        programme.append(
            {
                'code': f['code'],
                'name': f['name'][:1].upper() + f['name'][1:],
                'family': f['family'],
                'shelves': SHELVES[f['family']],
                'epreuves': epreuves,
            }
        )
    by_code = {p['code']: p for p in programme}

    # Which common matières feed each épreuve.
    for p in programme:
        for subject in sorted(COMMON - NOT_SHARED):
            e = epreuve_for(subject, p['epreuves'])
            if e is not None:
                e['shared_subjects'].append(subject)

    entries = json.load(open(raw_path, encoding='utf-8'))
    stats = {'matched': 0, 'shared': 0, 'other': 0}
    for entry in entries:
        code = OUR_TO_OFFICIAL.get(entry['filiere'], entry['filiere'])
        code = MOVE.get((code, entry['subject']), code)
        entry['filiere'] = code
        programme_f = by_code.get(code)
        if programme_f is None:
            # A shelf (FI, FT, Tronc commun): keep the common matière.
            stats['shared'] += 1
            continue
        e = epreuve_for(entry['subject'], programme_f['epreuves'])
        if e is not None:
            # Keep the finer topic as chapter when it says more than the épreuve.
            if entry['subject'] and fold(entry['subject']) != fold(e['name']) and not entry.get('chapter'):
                if entry['subject'] not in COMMON and entry['subject'] != 'Étude de cas':
                    entry['chapter'] = entry['subject']
            entry['subject'] = e['name']
            stats['matched'] += 1
        else:
            stats['other'] += 1

    entries.sort(key=lambda e: (e['filiere'], e['subject'] or '~', -(e['session_year'] or 0), e['title']))
    json.dump(entries, open(library_out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(
        {'source': 'Direction des Examens et Concours (DECO), bts.mesrs-ci.net', 'filieres': programme},
        open(programme_out, 'w', encoding='utf-8'),
        ensure_ascii=False,
        indent=1,
    )
    print(stats)


if __name__ == '__main__':
    main()
