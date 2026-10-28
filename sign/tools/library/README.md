# Catalogue de la bibliothèque BTS

Ces deux scripts produisent `backend/seeder/data/library_bts.json`, chargé au
démarrage de l'API par `python -m backend.cli seed-library`.

Seuls les **titres et liens** sont relevés, jamais les fichiers : l'étudiant
ouvre le document sur fomesoutra.com, crédité comme source. Le relevé respecte
le délai de 5 s du robots.txt (6 s entre deux pages) et s'identifie par son
User-Agent. Les livres d'éditeurs sont écartés.

```bash
# 1. Relever les listes (environ 5 min par passe)
python -I crawl_fome.py sujets.json
MSYS_NO_PATHCONV=1 python -I crawl_fome.py cours.json /cours/superieur \
  /cours/superieur/bts-droit,/cours/superieur/bts-electronique,...   # dossiers de cours BTS

# 2. Classer (filière, matière, chapitre, type, session, auteur)
python -I classify.py sujets.json cours.json ../../backend/seeder/data/library_bts.json
```

Pour retirer un document (demande de l'auteur, lien mort), on l'enlève du
JSON : au démarrage suivant, le seeder le passe en `withdrawn` et il disparaît
de la bibliothèque. Un masquage fait par la modération est conservé.
