"""Polite metadata crawl of fomesoutra BTS listing pages (titles + page URLs only)."""
import html, json, re, sys, time, urllib.request

BASE = 'https://www.fomesoutra.com'
ROOT = sys.argv[2] if len(sys.argv) > 2 else '/sujets/superieur-1/bts'
STARTS = sys.argv[3].split(',') if len(sys.argv) > 3 else [ROOT]
UA = 'STOUDENT-catalogue/1.0 (+https://stoudent.kortex.sbs; contact@kortexdigital.net)'
DELAY = 6
out_path = sys.argv[1]

ITEM = re.compile(
    r'<a href="(' + re.escape(ROOT) + r'/(?:[a-z][a-z0-9-]*/)*(\d+)-[^"/]+)" title="[^"]*"\s+class="[^"]*"\s+data-title="([^"]*)"', re.S)
DL = re.compile(r'UserDownloads:(\d+)')
CAT = re.compile(r'href="(' + re.escape(ROOT) + r'/[a-z][a-z0-9-]*(?:/[a-z][a-z0-9-]*)*)\?limit=100"')

def get(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            print('retry', path, e, flush=True)
            time.sleep(30 * (attempt + 1))
    return ''

docs, seen_cats = {}, set()
queue = [(p, None if p == ROOT else p[len(ROOT) + 1:]) for p in STARTS]
while queue:
    path, cat = queue.pop(0)
    if path in seen_cats:
        continue
    seen_cats.add(path)
    start = 0
    while True:
        page = get(f'{path}?limit=100&limitstart={start}')
        time.sleep(DELAY)
        items = ITEM.findall(page)
        # downloads appear after each item, in order
        chunks = re.split(r'<tr class="docman_item"', page)[1:]
        new = 0
        for chunk in chunks:
            m = ITEM.search(chunk)
            if not m:
                continue
            url, did, title = m.groups()
            d = DL.search(chunk)
            if did not in docs:
                new += 1
                docs[did] = {'id': int(did), 'title': html.unescape(title).strip(), 'url': BASE + url,
                             'category': cat, 'downloads': int(d.group(1)) if d else 0}
            elif cat and not docs[did]['category']:
                docs[did]['category'] = cat
        print(path, start, len(chunks), 'new', new, 'total', len(docs), flush=True)
        for sub in CAT.findall(page):
            if sub not in seen_cats and sub.startswith(path) and sub != path:
                queue.append((sub, sub[len(ROOT) + 1:]))
        if len(chunks) < 100:
            break
        start += 100

json.dump(sorted(docs.values(), key=lambda d: d['id']), open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('done', len(docs))
