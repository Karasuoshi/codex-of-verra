"""Build 'what drops from whom' from DesignData: loot tables (255) + every record that references them."""
import sys, os, json, struct, re, collections
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import load, read_fstring, texts
from dbc_rows import table_rows
from loot import decode_table

SRC_TABLES = {229: 'npc', 230: 'npc_spawn', 226: 'poi', 363: 'zone', 60: 'quest', 365: 'quest_step', 203: 'quest_objective',
              366: 'quest_objective', 10: 'dialogue_action', 140: 'gathering_node', 245: 'gathering_node', 73: 'recipe',
              63: 'commodity_recipe', 117: 'event', 119: 'event', 112: 'event', 201: 'dialogue', 33: 'building', 19: 'poi',
              161: 'item_container', 89: 'deconstruction', 331: 'treasure_hunt', 353: 'war_reward', 159: 'contribution', 227: 'discovery'}

def main(dbc, out_dir):
    d, T, pool = load(dbc); P, PS = pool
    tid2idx = {t['id']: t['index'] for t in T}
    idx_u64 = {struct.unpack('<Q', bytes.fromhex(t['id']))[0]: t['index'] for t in T}
    loot, errs = decode_table(d, T[255], pool, tid2idx)
    L = {int(r['guid']): r for r in loot}
    rows = {}; titles = {}
    for t in T:
        rr = table_rows(d, t, pool); rows[t['index']] = rr
        tx = texts(d, t)
        if tx:
            import bisect
            ends = [r['end'] for r in rr]
            for x in tx:
                i = bisect.bisect_left(ends, x['pos'])
                if i < len(rr): titles.setdefault((t['index'], rr[i]['guid']), x['text'])
    names = {(ti, r['guid']): r['name'] for ti, rr in rows.items() for r in rr}
    lid = bytes.fromhex(T[255]['id'])

    def refs(ti, r, target=None):
        s = T[ti]['offset']; a, b = s + r['start'], s + r['end'] - 20; out = []
        p = a
        while True:
            p = d.find(b'\x63\x00\x00\x00', p, b)
            if p < 0: break
            q = p - 16
            if q >= a:
                tid = d[q + 8:q + 16].hex()
                if tid in tid2idx and (target is None or tid2idx[tid] == target):
                    g = struct.unpack('<Q', d[q:q + 8])[0]
                    if g: out.append((tid2idx[tid], g))
            p += 4
        return out

    # formulas: table 300 -> 298 expression text
    expr = {}
    t298 = T[298]; s = t298['offset']
    for r in rows[298]:
        seg = d[s + r['start']:s + r['end'] - 20]
        for o in range(len(seg) - 3):
            v = struct.unpack('<I', seg[o:o + 4])[0]
            if 0x43 < v < PS - 4:
                st, _ = read_fstring(d, P + v, P + PS)
                if st and len(st) > 1 and st != 'None': expr[r['guid']] = st; break
    formula = {}
    for r in rows[300]:
        tgt = refs(300, r, 298)
        if tgt: formula[r['guid']] = {'name': r['name'], 'expression': expr.get(tgt[0][1])}
    def resolve(e):
        def rep(m):
            tab, g = int(m.group(1)), int(m.group(2)); ti = idx_u64.get(tab)
            if ti == 300 and g in formula: return '{%s}' % formula[g]['name']
            return '{%s}' % (names.get((ti, g)) or g)
        return re.sub(r'\$#(\d+):(\d+)\$', rep, e) if isinstance(e, str) else e

    item_title = {g: titles.get((161, g)) for (ti, g) in names if ti == 161}
    def item_label(ref):
        g = int(ref['guid']); return {'guid': str(g), 'name': item_title.get(g) or names.get((161, g)) or str(g),
                                       'internal_name': names.get((161, g))}

    # flatten loot tables into item lists (with path of rules)
    memo = {}
    def flatten(g, depth=0, seen=()):
        if g in memo: return memo[g]
        if depth > 12 or g in seen or g not in L: return []
        t = L[g]; out = []
        for ci, c in enumerate(t.get('containers', [])):
            rule = {'table': t['name'], 'selection': c['selection'], 'grant': c['grant']}
            if c.get('predicate'): rule['condition'] = resolve(c['predicate'])
            for ri, rw in enumerate(c['rewards']):
                r2 = dict(rule)
                if c.get('weights') and ri < len(c['weights']): r2['weight'] = c['weights'][ri]; r2['weight_total'] = sum(c['weights'])
                if c.get('drop_percent') and ri < len(c['drop_percent']): r2['chance'] = resolve(c['drop_percent'][ri])
                if c.get('weight_expressions') and ri < len(c['weight_expressions']): r2['weight_expr'] = resolve(c['weight_expressions'][ri])
                for it in rw.get('items', []):
                    out.append({'item': item_label(it['item']), 'quantity': resolve(it['quantity']), 'path': [r2]})
                for cu in rw.get('currency', []):
                    out.append({'currency': names.get((82, int(cu['currency']['guid']))) or cu['currency']['guid'], 'amount': resolve(cu['amount']), 'path': [r2]})
        st = t.get('subtables')
        if st:
            for i, sub in enumerate(st['tables']):
                step = {'table': t['name'], 'selection': st['selection']}
                if t.get('predicate'): step['condition'] = resolve(t['predicate'])
                if st.get('weights') and i < len(st['weights']): step['weight'] = st['weights'][i]; step['weight_total'] = sum(st['weights'])
                if st.get('percent') and i < len(st['percent']): step['chance'] = resolve(st['percent'][i])
                if st.get('weight_expressions') and i < len(st['weight_expressions']): step['weight_expr'] = resolve(st['weight_expressions'][i])
                for e in flatten(int(sub['guid']), depth + 1, seen + (g,)):
                    out.append({**e, 'path': [step] + e['path']})
        if t.get('predicate') and not st:
            for e in out: e['path'][0].setdefault('condition', resolve(t['predicate']))
        memo[g] = out
        return out

    # sources: who references each loot table
    def label(ti, g):
        return {'kind': SRC_TABLES.get(ti, 'table_%d' % ti), 'table': ti, 'guid': str(g),
                'internal_name': names.get((ti, g)), 'name': titles.get((ti, g))}
    sources = collections.defaultdict(list)
    for ti in SRC_TABLES:
        for r in rows[ti]:
            for (_, lg) in refs(ti, r, 255):
                sources[lg].append(label(ti, r['guid']))
    # spawn -> asset set (17) -> npc (229): give spawns an NPC display name
    set2npc = {}
    for r in rows[17]:
        n = [g for (_, g) in refs(17, r, 229)]
        if n: set2npc[r['guid']] = n[0]
    spawn_npc = {}
    for r in rows[230]:
        a = [g for (_, g) in refs(230, r, 17)]
        if a and a[0] in set2npc: spawn_npc[r['guid']] = set2npc[a[0]]
    for lg, srcs in sources.items():
        for s_ in srcs:
            if s_['table'] == 230 and int(s_['guid']) in spawn_npc:
                ng = spawn_npc[int(s_['guid'])]; s_['npc'] = titles.get((229, ng)) or names.get((229, ng))

    # outputs
    os.makedirs(out_dir, exist_ok=True)
    tables_out = []
    for g, t in L.items():
        tables_out.append({'guid': str(g), 'name': t['name'], 'used_by': sources.get(g, []), 'drops': flatten(g)})
    json.dump(tables_out, open(f'{out_dir}/loot_tables_flat.json', 'w'), ensure_ascii=False)
    json.dump(loot, open(f'{out_dir}/loot_tables_raw.json', 'w'), ensure_ascii=False)
    # readable loot tables: names instead of guids, formula references resolved
    def readable(o):
        if isinstance(o, str): return resolve(o)
        if isinstance(o, list): return [readable(x) for x in o]
        if not isinstance(o, dict): return o
        if set(o) == {'guid', 'table'}:
            g = int(o['guid'])
            if o['table'] == 255: return {'guid': o['guid'], 'loot_table': names.get((255, g))}
            if o['table'] == 161 and (161, g) in names:
                return {'guid': o['guid'], 'item': item_title.get(g) or names[(161, g)], 'internal_name': names[(161, g)]}
            return o
        return {k: readable(v) for k, v in o.items()}
    json.dump([readable(t) for t in loot], open(f'{out_dir}/loot_tables.json', 'w'), ensure_ascii=False)
    json.dump({str(k): v for k, v in formula.items()}, open(f'{out_dir}/formulas.json', 'w'), ensure_ascii=False, indent=1)
    by_item = collections.defaultdict(list)
    for t in tables_out:
        if not t['used_by']: continue
        for e in t['drops']:
            if 'item' in e:
                for s_ in t['used_by']:
                    by_item[e['item']['guid']].append({'source': s_, 'via_table': t['name'], 'quantity': e['quantity'], 'path': e['path']})
    items_out = [{'item': {'guid': g, 'name': item_title.get(int(g)) or names.get((161, int(g))), 'internal_name': names.get((161, int(g)))},
                  'sources': v} for g, v in by_item.items()]
    json.dump(items_out, open(f'{out_dir}/drops_by_item.json', 'w'), ensure_ascii=False)
    by_src = collections.defaultdict(lambda: {'source': None, 'loot_tables': [], 'items': {}})
    for t in tables_out:
        for s_ in t['used_by']:
            k = (s_['table'], s_['guid']); e = by_src[k]; e['source'] = s_; e['loot_tables'].append(t['name'])
            for x in t['drops']:
                if 'item' in x: e['items'].setdefault(x['item']['guid'], x['item']['name'])
    src_out = [{**v, 'items': [{'guid': g, 'name': n} for g, n in v['items'].items()]} for v in by_src.values()]
    json.dump(src_out, open(f'{out_dir}/drops_by_source.json', 'w'), ensure_ascii=False)
    kinds = collections.Counter(v['source']['kind'] for v in src_out)
    print('loot tables', len(L), 'decode errors', len(errs), '| formulas', len(formula), '| items with known sources', len(items_out),
          '| sources', len(src_out), dict(kinds))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
