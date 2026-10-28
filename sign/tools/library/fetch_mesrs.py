"""Official BTS épreuves per filière, from the DECO site (bts.mesrs-ci.net).

usage: python -I fetch_mesrs.py out.json

Reads /filieres/cat/1 (industrielles) and /filieres/cat/2 (tertiaires), then
each /examen/epreuves/<id> table: épreuve, nature, coefficient. Public
information; one page every 3 seconds.
"""
import html
import json
import re
import sys
import time
import urllib.request

BASE = 'https://bts.mesrs-ci.net'
UA = 'STOUDENT/1.0 (+https://stoudent.kortex.sbs; contact@kortexdigital.net)'
DELAY = 3

CARD = re.compile(r'href="/examen/epreuves/(\d+)">\s*<div class="bts-card">\s*<h3>\s*<b>\s*([^<]+?)\s*</b>\s*</h3>\s*<p>\s*([^<]+?)\s*</p>', re.S)
ROW = re.compile(r'<tr>\s*<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]+?)\s*</td>\s*</tr>', re.S)


def get(path: str) -> str:
    req = urllib.request.Request(BASE + path, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode('utf-8', 'replace')
    time.sleep(DELAY)
    return text


def clean(text: str) -> str:
    return ' '.join(html.unescape(text).split())


def main() -> None:
    filieres = []
    for cat, family in ((1, 'industrielle'), (2, 'tertiaire')):
        for fid, code, name in CARD.findall(get(f'/filieres/cat/{cat}')):
            filieres.append({'id': int(fid), 'code': clean(code), 'name': clean(name), 'family': family})
    for f in filieres:
        page = get(f'/examen/epreuves/{f["id"]}')
        f['epreuves'] = [
            {
                'name': clean(name),
                'nature': 'pratique' if 'pratique' in nature.lower() else 'orale' if 'orale' in nature.lower() else 'écrite',
                'coefficient': float(coef) if '.' in coef else int(coef),
            }
            for name, nature, _duration, coef in ROW.findall(page)
        ]
        print(f['code'], len(f['epreuves']), flush=True)
    json.dump(filieres, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
