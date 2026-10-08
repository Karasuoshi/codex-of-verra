"""Skill tree panels -> data/trees.json (index) + data/trees/<id>.json.

Input: build/skill_trees.json (tools/skill_trees.py), data/abilities*, data/effects*,
build/icon_links.json + build/icon_files.json, build/ability_stats.json.
Run after build_site.py, build_classes.py and build_icons.py.

Layout: nodes are laid out as a layered graph. Row = (tier, depth), where depth is the
longest prerequisite chain inside the tree; inside a row nodes follow their parents.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_classes as bc  # noqa: E402

ROOT = os.path.join(HERE, '..')
DATA = os.path.join(ROOT, 'data')
BUILD = os.path.join(ROOT, 'build')


def jl(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def jw(p, v):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(v, f, ensure_ascii=False, separators=(',', ':'))


ARCHETYPES = [('tank', 'Tank', 'Tank', 'Tank'), ('fighter', 'Fighter', 'Fighter', 'Fighter'),
              ('rogue', 'Rogue', 'Rogue', 'Rogue'), ('ranger', 'Ranger', 'Mage', 'Ranger'),
              ('mage', 'Mage', 'Mage', 'Mage'), ('cleric', 'Cleric', 'Cleric', 'Cleric'),
              ('summoner', 'Summoner', 'Summoner', 'Summoner'), ('bard', 'Bard', 'Bard', 'Bard')]
WEAPONS = [('greatsword', 'Greatsword', 'Weapon_2H_Sword'), ('sword', 'Sword', 'Weapon_1H_Sword_Slash'),
           ('rapier', 'Rapier', 'Weapon_1H_Sword_Pierce'), ('axe', 'Axe', 'Weapon_1H_Axe'),
           ('greataxe', 'Greataxe', 'Weapon_2H_Axe'), ('mace', 'Mace', 'Weapon_1H_Mace'),
           ('greatmace', 'Greatmace', 'Weapon_2H_Mace'), ('spear', 'Spear', 'Weapon_2H_Spear'),
           ('daggers', 'Daggers', 'Weapon_DW_Daggers'), ('scepter', 'Scepter', 'Weapon_1H_Scepter'),
           ('wand', 'Wand', 'Weapon_Ranged_Wand'), ('spellbook', 'Spellbook', 'Weapon_Ranged_Book'),
           ('shortbow', 'Shortbow', 'Weapon_Ranged_Shortbow'), ('longbow', 'Longbow', 'Weapon_Ranged_Longbow')]
POINTS = {'Combat_Archetype': 'Archetype Skill Pt.', 'Combat_Weapon': 'Weapon Skill Pt.', 'Combat_Stamina': 'Stamina Skill Pt.'}


def section(sid):
    idx = {s['id']: s for s in jl(os.path.join(DATA, 'index.json'))['sections']}
    out = {}
    for i in range(idx[sid].get('shards', 1)):
        out.update(jl(os.path.join(DATA, sid, f'{i}.json')))
    return out


def main():
    trees = jl(os.path.join(BUILD, 'skill_trees.json'))
    abil = section('abilities')
    eff = section('effects')
    ab_by_internal = {r['internal']: (g, r) for g, r in abil.items()}
    links = jl(os.path.join(BUILD, 'icon_links.json'))
    files = jl(os.path.join(BUILD, 'icon_files.json'))
    eff_by_internal = {}
    for gid, e in eff.items():
        if e.get('internal') and e.get('title'):
            eff_by_internal.setdefault(e['internal'], (gid, e['title']))
    eff_name = {gid: e['title'] for gid, e in eff.items() if e.get('title')}

    def icon_path(guid=None, path=None):
        for p in (path, links.get(str(guid)) if guid else None):
            if p and p in files and os.path.exists(os.path.join(ROOT, 'icons', files[p])):
                return 'icons/' + files[p]
        return None

    def describe(sk, fallback_name):
        """Return dict with title, kind, link, icon, stats, text segments, cost."""
        if not sk:
            return None
        ref, kind = sk.get('ref'), sk.get('kind')
        rec = None
        if ref and kind == 'active' and ref in abil:
            rec = abil[ref]
        elif ref and kind == 'passive' and ref in eff:
            rec = eff[ref]
        if not rec:
            for nmx in (sk.get('skill'), fallback_name):
                if nmx in ab_by_internal:
                    ref, rec = ab_by_internal[nmx]
                    kind = 'active'
                    break
        title = (rec or {}).get('title') or re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', sk.get('skill') or fallback_name).split('_')[-1]
        out = {'n': title, 'k': 'a' if kind == 'active' else 'p'}
        if ref and rec:
            out['l'] = ('abilities/' if kind == 'active' else 'effects/') + ref
        ic = icon_path(ref, sk.get('icon')) or (rec or {}).get('ic')
        if ic:
            out['ic'] = ic
        if kind == 'active' and rec:
            if rec.get('st'):
                out['st'] = rec['st']
            if rec.get('x'):
                out['x'] = rec['x']
        if 'x' not in out:
            txt = sk.get('text') or (rec or {}).get('description')
            if txt:
                out['x'] = bc.segments(txt.strip(), eff_by_internal, None, eff_name)
        if sk.get('cost'):
            out['c'] = sk['cost']
        if sk.get('points') in POINTS:
            out['pt'] = POINTS[sk['points']]
        return out

    def build(tree_name, nodes_filter=None):
        t = trees[tree_name]
        src = t['nodes']
        keep = [i for i, nd in enumerate(src) if nodes_filter is None or nodes_filter(nd)]
        nodes = []
        for i in keep:
            nd = src[i]
            if nd.get('kind') == 'choice':
                opts = [describe(c, nd['name']) for c in nd.get('choice', [])]
                opts = [o for o in opts if o]
                if not opts:
                    continue
                d = {'n': ' / '.join(o['n'] for o in opts), 'k': 'c', 'opts': opts}
                for key in ('ic', 'c', 'pt'):
                    if opts[0].get(key):
                        d[key] = opts[0][key]
            else:
                d = describe(nd, nd['name'])
                if not d:
                    continue
            d['_src'] = i
            d['_name'] = nd['name']
            d['_tier'] = nd.get('tier') or 0
            d['_srcpre'] = nd.get('pre', [])
            nodes.append(d)
        pos = {d['_src']: k for k, d in enumerate(nodes)}
        for d in nodes:
            d['pre'] = sorted({pos[p] for p in d['_srcpre'] if p in pos and pos[p] != pos[d['_src']]})
        # passives named X_Passive_<Ability>_<Mod> attach to X_<Ability> when no prerequisite is given
        by_name = {d['_name'].lower(): k for k, d in enumerate(nodes)}
        for k, d in enumerate(nodes):
            if d['pre'] or d['k'] == 'a':
                continue
            m = re.match(r'^([A-Za-z]+)_Passive_([A-Za-z]+)(?:[_-].*)?$', d['_name'])
            if m:
                cand = (m.group(1) + '_' + m.group(2)).lower()
                if cand in by_name and by_name[cand] != k:
                    d['pre'] = [by_name[cand]]
        # depth = longest prerequisite chain
        depth = {}

        def dep(k, seen=()):
            if k in depth:
                return depth[k]
            if k in seen:
                return 0
            ps = nodes[k]['pre']
            depth[k] = 0 if not ps else 1 + max(dep(p, seen + (k,)) for p in ps)
            return depth[k]
        for k in range(len(nodes)):
            dep(k)
        # rows: roots grouped by tier, children follow parents in the next rows
        tiers = sorted({d['_tier'] for d in nodes})
        rows = {}
        for k, d in enumerate(nodes):
            root_tier = d['_tier']
            p = k
            while nodes[p]['pre']:
                p = nodes[p]['pre'][0]
                if p == k:
                    break
            root_tier = nodes[p]['_tier']
            rows.setdefault((tiers.index(root_tier), depth[k]), []).append(k)
        order = sorted(rows)
        xs = {}
        out_rows = []
        for key in order:
            ks = rows[key]
            want = {}
            for k in ks:
                ps = [p for p in nodes[k]['pre'] if p in xs]
                want[k] = sum(xs[p] for p in ps) / len(ps) if ps else None
            if all(v is None for v in want.values()):
                ks.sort()
                for i, k in enumerate(ks):
                    xs[k] = float(i)
            else:
                ks.sort(key=lambda k: (want[k] if want[k] is not None else 1e9, k))
                # siblings of one parent spread around it; then push right to avoid overlaps
                groups = {}
                for k in ks:
                    groups.setdefault(want[k], []).append(k)
                cur = -1e9
                for k in ks:
                    w = want[k]
                    g = groups[w]
                    j = g.index(k)
                    x = (w if w is not None else cur + 1) + (j - (len(g) - 1) / 2.0)
                    x = max(x, cur + 1)
                    xs[k] = x
                    cur = x
            out_rows.append({'t': key[0], 'nodes': [[k, round(xs[k], 2)] for k in ks]})
        mn = min(xs.values()) if xs else 0
        for r in out_rows:
            for it in r['nodes']:
                it[1] = round(it[1] - mn, 2)
        for d in nodes:
            for kk in [x for x in d if x.startswith('_')]:
                del d[kk]
        return nodes, out_rows, t.get('bg')

    os.makedirs(os.path.join(DATA, 'trees'), exist_ok=True)
    index = []

    BG_OVERRIDE = {'mage': 'TUI_ArchetypeTreeBG_MageWide', 'ranger': 'TUI_ArchetypeTreeBG_Ranger'}

    def emit(tid, group, name, tree, flt=None):
        nodes, rows, bg = build(tree, flt)
        bg = BG_OVERRIDE.get(tid, bg)
        bgp = None
        if bg:
            for ext in ('webp', 'jpg'):
                if os.path.exists(os.path.join(ROOT, 'art', bg + '.' + ext)):
                    bgp = 'art/' + bg + '.' + ext
                    break
        jw(os.path.join(DATA, 'trees', tid + '.json'), {'id': tid, 'name': name, 'group': group, 'bg': bgp, 'nodes': nodes, 'rows': rows})
        index.append({'id': tid, 'group': group, 'name': name, 'count': len(nodes), 'ic': next((n.get('ic') for n in nodes if n.get('ic')), None)})
        print(f'{tid:12} {len(nodes):3} nodes {len(rows):2} rows bg={bgp}')

    for tid, name, tree, prefix in ARCHETYPES:
        emit(tid, 'Archetype', name, tree, lambda nd, p=prefix: nd['name'].startswith(p + '_') and not nd['name'].startswith('TEMP'))
    for tid, name, tree in WEAPONS:
        emit(tid, 'Weapon', name, tree)
    emit('stamina', 'Stamina', 'Stamina', 'Universal')
    jw(os.path.join(DATA, 'trees.json'), {'trees': index})


if __name__ == '__main__':
    main()
