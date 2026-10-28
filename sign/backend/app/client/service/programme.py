"""The official BTS programme: filières and their épreuves (DECO / MESRS).

Loaded once from ``seeder/data/programme_bts.json`` (built by
``sign/tools/library/align.py``). The library is organised on it: a filière
shows its épreuves, each fed by the filière's own documents and by the shared
shelves of its family (FI or FT) and of every filière (Tronc commun).
"""
import json

from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[3] / 'seeder' / 'data' / 'programme_bts.json'

# Codes used before the alignment on the official list.
LEGACY_CODES = {'FC': 'FCGE', 'GC': 'GEC', 'GCB': 'GBAT', 'MMA': '2MA', 'CJ': 'CJPI', 'SDI': 'SIN'}


@lru_cache(maxsize=1)
def programme() -> dict:
    return json.loads(DATA.read_text(encoding='utf-8'))


def filiere(code: str | None) -> dict | None:
    if not code:
        return None
    code = LEGACY_CODES.get(code.upper(), code)
    return next((f for f in programme()['filieres'] if f['code'].lower() == code.lower()), None)


def epreuve(code: str | None, name: str | None) -> dict | None:
    f = filiere(code)
    if f is None or not name:
        return None
    return next((e for e in f['epreuves'] if e['name'].lower() == name.lower()), None)


def codes() -> list[str]:
    return [f['code'] for f in programme()['filieres']]
