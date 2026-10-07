#!/usr/bin/env python3
"""Build the Codex of Verra site data (data/) from the DesignData exports.

Inputs (EXPORT dir, produced by the aoc-data tools):
  dataset/<category>.json         texts per record (export_texts.py + build_dataset.py)
  drops/loot_tables.json          decoded loot tables with names resolved (drops.py)
  drops/drops_by_item.json        item -> sources
  drops/drops_by_source.json      source -> loot tables + items
  drops/formulas.json             named formulas
  build/xp.json                   XP curves (kept from the AshesCodex sample)
Usage: python3 tools/build_site.py <EXPORT dir> [out dir]
"""
import json, os, re, sys, shutil, collections, datetime, zlib

EXP = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'data')
BUILD = 'client build 2026-01-20'
DEV = re.compile(r'(^|_)(z?legacy|test|testing|notused|obsolete|deprecated|zdelete|debug|ptr_only|placeholder|temp|wip)(_|$|\d)|^(gm_|z[A-Z]|ncs_|aimi|kyle|dmiller|jasong|devon|andrew|zach)', re.I)
KIND_LABEL = {
    'npc': 'Creature', 'npc_spawn': 'Creature spawn', 'poi': 'Point of interest', 'zone': 'Zone',
    'quest': 'Quest', 'quest_step': 'Quest step', 'quest_objective': 'Quest objective', 'dialogue_action': 'Dialogue',
    'dialogue': 'Dialogue', 'gathering_node': 'Gathering', 'recipe': 'Recipe', 'commodity_recipe': 'Commodity recipe',
    'event': 'Event', 'building': 'Building', 'item_container': 'Container item', 'deconstruction': 'Deconstruction',
    'treasure_hunt': 'Treasure hunt', 'war_reward': 'War reward', 'contribution': 'Contribution', 'discovery': 'Discovery'}

def j(p): return json.load(open(p, encoding='utf-8'))
def dev(name): return bool(name and DEV.search(name))
def clean(t):
    if not isinstance(t, str): return t
    t = re.sub(r'<[^>]+>', '', t).replace('\r\n', '\n').strip()
    return t

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
index = {'built': datetime.date.today().isoformat(), 'source': BUILD, 'sections': []}

SHARD_BYTES = 4_000_000  # GitHub web upload takes up to 100 files per batch, so records are packed into shards

def shard_of(rid, n):
    return zlib.crc32(str(rid).encode()) % n

def write_section(sid, title, blurb, rows, details):
    os.makedirs(f'{OUT}/{sid}', exist_ok=True)
    rows.sort(key=lambda r: (r.get('d', 0), (r['n'] or '').lower()))
    json.dump(rows, open(f'{OUT}/{sid}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    enc = {rid: json.dumps(det, ensure_ascii=False, separators=(',', ':')) for rid, det in details.items()}
    n = max(1, -(-sum(len(v) for v in enc.values()) // SHARD_BYTES))
    shards = [[] for _ in range(n)]
    for rid, txt in enc.items():
        shards[shard_of(rid, n)].append(json.dumps(str(rid)) + ':' + txt)
    for i, parts in enumerate(shards):
        open(f'{OUT}/{sid}/{i}.json', 'w', encoding='utf-8').write('{' + ','.join(parts) + '}')
    index['sections'].append({'id': sid, 'title': title, 'blurb': blurb, 'count': sum(1 for r in rows if not r.get('d')),
                              'count_all': len(rows), 'shards': n})
    print(f'{sid:12s} {len(rows):6d} rows')

ds = lambda c: j(f'{EXP}/dataset/{c}.json') if os.path.exists(f'{EXP}/dataset/{c}.json') else []
by_item = {x['item']['guid']: x for x in j(f'{EXP}/drops/drops_by_item.json')}
by_src = {(s['source']['table'], s['source']['guid']): s for s in j(f'{EXP}/drops/drops_by_source.json')}
loot = j(f'{EXP}/drops/loot_tables.json')
formulas = j(f'{EXP}/drops/formulas.json')
item_names = {r['guid']: r['title'] for r in ds('items')}

def step_text(p):
    bits = []
    if p.get('weight') is not None: bits.append(f"weight {p['weight']}/{p['weight_total']}")
    if p.get('chance'): bits.append('chance: ' + p['chance'])
    if p.get('weight_expr'): bits.append('weight: ' + p['weight_expr'])
    if p.get('condition') and p['condition'] not in ('true', ''): bits.append('if ' + p['condition'])
    return {'table': p['table'], 'rule': p.get('selection'), 'notes': bits}

def source_entry(s):
    src = s['source']
    name = src.get('npc') or src.get('name') or src.get('internal_name')
    e = {'kind': KIND_LABEL.get(src['kind'], src['kind']), 'name': clean(name), 'internal': src.get('internal_name'),
         'via': s.get('via_table'), 'qty': s.get('quantity')}
    if s.get('path'): e['path'] = [step_text(p) for p in s['path']]
    if dev(src.get('internal_name')) or dev(s.get('via_table')): e['d'] = 1
    if src['kind'] in ('npc', 'npc_spawn'): e['link'] = 'creatures/' + slug(name or src['guid'])
    if src['kind'] == 'quest' or src['kind'] == 'quest_step': e['link'] = ('quests/' + src['guid']) if src['kind'] == 'quest' else None
    if src['kind'] in ('recipe', 'commodity_recipe'): e['link'] = 'recipes/' + src['guid']
    if src['kind'] in ('zone', 'poi'): e['link'] = 'places/' + src['guid']
    if src['kind'] == 'item_container': e['link'] = 'items/' + src['guid']
    return {k: v for k, v in e.items() if v not in (None, '', [])}

def slug(s): return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')[:80] or 'unnamed'

def text_block(r):
    t = [clean(x) for x in r['texts']]
    return {'title': (t[0] if t and t[0] else r['internal_name']), 'description': t[1] if len(t) > 1 else None, 'more': t[2:12]}

# ---------- items ----------
rows, det = [], {}
for r in ds('items'):
    tb = text_block(r); g = r['guid']; d = 1 if (r.get('dev_or_unused') or dev(r['internal_name'])) else 0
    srcs = [source_entry(s) for s in by_item.get(g, {}).get('sources', [])]
    srcs.sort(key=lambda e: (e.get('d', 0), e['kind'], e.get('name') or ''))
    contains = by_src.get((161, g))
    kind = re.sub(r'_.*', '', r['internal_name'])
    rows.append({'id': g, 'n': tb['title'], 's': kind, 'q': f"{r['internal_name']} {g}".lower(), **({'d': 1} if d else {}),
                 **({'o': 1} if any(not e.get('d') for e in srcs) else {})})
    det[g] = {'guid': g, 'internal': r['internal_name'], **tb, 'dev': d,
              'sources': srcs[:400], 'sources_total': len(srcs),
              'contains': [{'name': clean(i['name']), 'link': 'items/' + i['guid']} for i in (contains or {}).get('items', []) if i['guid'] != '0'][:300],
              'contains_tables': (contains or {}).get('loot_tables', [])}
write_section('items', 'Items', 'Gear, resources, consumables, recipes and quest items, with every known source.', rows, det)

# ---------- loot tables ----------
used = collections.defaultdict(list)
for (ti, g), s in by_src.items():
    for ln in s['loot_tables']: used[ln].append(source_entry({'source': s['source']}))
rows, det = [], {}
for t in loot:
    d = 1 if dev(t['name']) else 0
    rows.append({'id': t['guid'], 'n': t['name'], 's': ', '.join(sorted({c['selection'] for c in t.get('containers', [])} | ({t['subtables']['selection']} if t.get('subtables') else set()))),
                 'q': t['guid'], **({'d': 1} if d else {})})
    det[t['guid']] = {**t, 'used_by': used.get(t['name'], [])[:200], 'dev': d}
write_section('loot', 'Loot tables', 'Every reward table: rolls, weights, drop chances, subtables and items.', rows, det)

# ---------- recipes (outputs from loot) ----------
rows, det = [], {}
pr = {r['guid']: r for r in ds('processing_recipes') + ds('commodity_recipes')}
for (ti, g), s in by_src.items():
    if ti not in (73, 63): continue
    r = pr.get(g); nm = clean(r['title']) if r else None
    name = nm or s['source']['internal_name']
    d = 1 if dev(s['source']['internal_name']) else 0
    rows.append({'id': g, 'n': name, 's': 'Commodity' if ti == 63 else re.sub(r'_.*', '', s['source']['internal_name']), 'q': (s['source']['internal_name'] or '').lower(), **({'d': 1} if d else {})})
    det[g] = {'guid': g, 'internal': s['source']['internal_name'], 'title': name, 'description': clean(r['texts'][1]) if r and len(r['texts']) > 1 else None,
              'outputs': [{'name': clean(i['name']), 'link': 'items/' + i['guid']} for i in s['items'] if i['guid'] != '0'], 'loot_tables': s['loot_tables'], 'dev': d}
write_section('recipes', 'Recipes', 'Processing and crafting recipes and what they produce. Ingredients are not decoded yet.', rows, det)

# ---------- creatures (by display name) ----------
groups = collections.defaultdict(lambda: {'internals': set(), 'loot': collections.OrderedDict(), 'tables': set(), 'kinds': set()})
for r in ds('npcs') + ds('npc_populations'):
    t = clean(r['title']);
    if not t: continue
    g = groups[slug(t)]; g['name'] = t; g['internals'].add(r['internal_name'])
for (ti, gid), s in by_src.items():
    if ti not in (229, 230): continue
    t = clean(s['source'].get('npc') or s['source'].get('name') or s['source']['internal_name'])
    g = groups[slug(t)]; g.setdefault('name', t); g['internals'].add(s['source']['internal_name']); g['kinds'].add(ti)
    for ln in s['loot_tables']: g['tables'].add(ln)
    for i in s['items']:
        if i['guid'] != '0': g['loot'][i['guid']] = clean(i['name'])
rows, det = [], {}
for sid, g in groups.items():
    ints = sorted(g['internals']); d = 1 if all(dev(x) for x in ints) else 0
    rows.append({'id': sid, 'n': g['name'], 's': f"{len(ints)} spawn record{'s' if len(ints) != 1 else ''}" + (', known loot' if g['loot'] else ''),
                 'q': ' '.join(ints[:20]).lower(), **({'d': 1} if d else {}), **({'o': 1} if g['loot'] else {})})
    det[sid] = {'title': g['name'], 'internal_names': ints[:200], 'internal_total': len(ints), 'loot_tables': sorted(g['tables']),
                'loot': [{'name': n, 'link': 'items/' + k} for k, n in list(g['loot'].items())[:400]], 'dev': d}
write_section('creatures', 'Creatures', 'Monsters, animals and NPCs by name. Loot is shown where the client data links it.', rows, det)

# ---------- quests ----------
rows, det = [], {}
for r in ds('quests') + ds('quests_story'):
    tb = text_block(r); g = r['guid']; d = 1 if (r.get('dev_or_unused') or dev(r['internal_name'])) else 0
    s = by_src.get((r['table'], g))
    rows.append({'id': g, 'n': tb['title'], 's': re.sub(r'_.*', '', r['internal_name']), 'q': r['internal_name'].lower(), **({'d': 1} if d else {})})
    det[g] = {'guid': g, 'internal': r['internal_name'], **tb, 'dev': d,
              'rewards': [{'name': clean(i['name']), 'link': 'items/' + i['guid']} for i in (s or {}).get('items', []) if i['guid'] != '0'][:200],
              'reward_tables': (s or {}).get('loot_tables', [])}
write_section('quests', 'Quests', 'Quests and story arcs with their texts and item rewards.', rows, det)

# ---------- abilities & effects & lore ----------
for sid, cats, title, blurb in [('abilities', ['abilities'], 'Abilities', 'Archetype, weapon, mount and creature abilities.'),
                                ('effects', ['status_effects'], 'Status effects', 'Buffs, debuffs, procs and passives.'),
                                ('lore', ['lore_books'], 'Lore', 'Books and chapters found in Verra.')]:
    rows, det = [], {}
    for c in cats:
        for r in ds(c):
            tb = text_block(r); g = r['guid']; d = 1 if (r.get('dev_or_unused') or dev(r['internal_name'])) else 0
            rows.append({'id': g, 'n': tb['title'], 's': re.sub(r'_.*', '', r['internal_name']), 'q': r['internal_name'].lower(), **({'d': 1} if d else {})})
            det[g] = {'guid': g, 'internal': r['internal_name'], **tb, 'dev': d}
    write_section(sid, title, blurb, rows, det)

# ---------- places ----------
rows, det = [], {}
for c, kind in [('locations', 'Location'), ('points_of_interest', 'Point of interest'), ('zones_of_influence', 'Zone')]:
    for r in ds(c):
        tb = text_block(r); g = r['guid']; d = 1 if (r.get('dev_or_unused') or dev(r['internal_name'])) else 0
        s = by_src.get((r['table'], g))
        rows.append({'id': g, 'n': tb['title'], 's': kind, 'q': r['internal_name'].lower(), **({'d': 1} if d else {}), **({'o': 1} if s else {})})
        det[g] = {'guid': g, 'internal': r['internal_name'], **tb, 'kind': kind, 'dev': d,
                  'loot': [{'name': clean(i['name']), 'link': 'items/' + i['guid']} for i in (s or {}).get('items', []) if i['guid'] != '0'][:300],
                  'loot_tables': (s or {}).get('loot_tables', [])}
# zones referenced by loot but not in text categories
for (ti, g), s in by_src.items():
    if ti in (363, 226) and g not in det:
        nm = clean(s['source'].get('name') or s['source']['internal_name'])
        rows.append({'id': g, 'n': nm, 's': 'Zone' if ti == 363 else 'Point of interest', 'q': (s['source']['internal_name'] or '').lower(), 'o': 1})
        det[g] = {'guid': g, 'internal': s['source']['internal_name'], 'title': nm, 'kind': 'Zone' if ti == 363 else 'Point of interest',
                  'loot': [{'name': clean(i['name']), 'link': 'items/' + i['guid']} for i in s['items'] if i['guid'] != '0'][:300], 'loot_tables': s['loot_tables'], 'dev': 0}
write_section('places', 'Places', 'Regions, nodes, points of interest and their zone-wide drops.', rows, det)

# ---------- formulas ----------
rows, det = [], {}
for g, f in formulas.items():
    d = 1 if dev(f['name']) else 0
    rows.append({'id': g, 'n': f['name'], 's': (f['expression'] or '').split('\n')[0][:80], 'q': (f['expression'] or '').lower()[:400], **({'d': 1} if d else {})})
    det[g] = {'guid': g, 'title': f['name'], 'expression': f['expression'], 'dev': d}
write_section('formulas', 'Formulas', 'Named game formulas used for drop chances, quantities, damage and other rules.', rows, det)

shutil.copy(os.path.join(ROOT, 'build', 'xp.json'), f'{OUT}/xp.json'); index['xp'] = True
json.dump(index, open(f'{OUT}/index.json', 'w'), indent=1)
print('done', sum(s['count_all'] for s in index['sections']))
