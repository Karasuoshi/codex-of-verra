"""Attach icon paths to the built data.

Inputs:
  build/icon_links.json  {record guid: '/Game/UI/Icons/...'}  (tools/icon_links.py on CacheDB.dbc)
  build/icon_files.json  {'/Game/UI/Icons/...': 'Items/.../TUI_Icon_x.webp'}  (icons/ folder)
Adds 'ic': 'icons/....webp' to list rows, records, loot items, linked chips and class cards.
Recipes get the icon of their first output item. Run after build_site.py and build_classes.py.
"""
import json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DATA = os.path.join(ROOT, 'data')


def jload(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def jsave(p, v):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(v, f, ensure_ascii=False, separators=(',', ':'))


links = jload(os.path.join(ROOT, 'build', 'icon_links.json'))
files = jload(os.path.join(ROOT, 'build', 'icon_files.json'))
ICON = {g: 'icons/' + files[p] for g, p in links.items()
        if p in files and os.path.exists(os.path.join(ROOT, 'icons', files[p]))}
LINK = re.compile(r'^(?:items|abilities|effects)/(\d+)$')


def icon_for(obj):
    if not isinstance(obj, dict):
        return None
    for k in ('guid', 'id'):
        v = obj.get(k)
        if v is not None and str(v) in ICON:
            return ICON[str(v)]
    m = LINK.match(str(obj.get('link', '')))
    if m and m.group(1) in ICON:
        return ICON[m.group(1)]
    return None


def walk(v):
    n = 0
    if isinstance(v, dict):
        ic = icon_for(v)
        if ic and 'ic' not in v:
            v['ic'] = ic; n += 1
        for x in v.values():
            n += walk(x)
    elif isinstance(v, list):
        for x in v:
            n += walk(x)
    return n


def main():
    idx = jload(os.path.join(DATA, 'index.json'))
    total = 0
    for sec in idx['sections']:
        sid = sec['id']
        rows = jload(os.path.join(DATA, sid + '.json'))
        shards = {}
        for i in range(sec.get('shards', 1)):
            shards[i] = jload(os.path.join(DATA, sid, f'{i}.json'))
        added = 0
        for i, sh in shards.items():
            added += walk(sh)
            if sid == 'recipes':
                for rec in sh.values():
                    out = next((o for o in rec.get('outputs', []) if o.get('ic')), None)
                    if out and 'ic' not in rec:
                        rec['ic'] = out['ic']
            jsave(os.path.join(DATA, sid, f'{i}.json'), sh)
        allrec = {k: v for sh in shards.values() for k, v in sh.items()}
        lst = 0
        for r in rows:
            ic = ICON.get(str(r['id'])) or (allrec.get(r['id']) or {}).get('ic')
            if ic:
                r['ic'] = ic; lst += 1
        jsave(os.path.join(DATA, sid + '.json'), rows)
        print(f'{sid:10} list {lst:5}/{len(rows):5}  nested {added}')
        total += lst
    cp = os.path.join(DATA, 'classes.json')
    if os.path.exists(cp):
        c = jload(cp)
        print('classes  nested', walk(c))
        jsave(cp, c)
    print('records with icons', total, 'icon files', len(set(ICON.values())))


if __name__ == '__main__':
    main()
