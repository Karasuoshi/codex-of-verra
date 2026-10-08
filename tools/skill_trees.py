"""Skill trees from DesignData.

272 tree (archetype / weapon / Universal) -> refs to 273 nodes (in tree order)
273 node   -> ref 268 skill (or 274 choice of several 268 skills); prerequisite refs to other 273 nodes;
              byte at (table-id anchor 2f64255ae111c34c) + 13 = tier (0, 1, 4, 9, 10 ...)
268 skill  -> ref 270 skill definition
270 def    -> ref 0 ability or 4 effect; optional text (passive description); icon path;
              ref 269 point type; i32 at (ref 269 offset + 20) = point cost
Output: {tree name: {bg, nodes: [...]}}
"""
import sys, os, json, struct, pickle
sys.path.insert(0, os.path.dirname(__file__))

ANCHOR = bytes.fromhex('2f64255ae111c34c')


def main(pkl, out):
    db = pickle.load(open(pkl, 'rb'))
    nm = lambda g: db.rows.get(g, (0, 0, 0, None))[3]

    def skill(g268):
        if g268 not in db.rows:
            return None
        d70 = next((x for o, tt, x in db.refs(g268) if tt == 270), None)
        if not d70 or d70 not in db.rows:
            return None
        t, a, b, n = db.rows[d70]
        refs = db.refs(d70)
        tgt = next(((tt, x) for o, tt, x in refs if tt in (0, 4)), None)
        pt = next(((o, x) for o, tt, x in refs if tt == 269), None)
        cost = struct.unpack_from('<i', db.d, a + pt[0] + 20)[0] if pt else None
        strs = [s for o, s in db.strings(d70) if s not in ('None', '')]
        icon = next((s.split('.')[0] for s in strs if s.startswith('/Game/UI/Icons/')), None)
        text = next((s for s in strs if not s.startswith('/Game/') and ' ' in s), None)
        return {'skill': n, 'kind': {0: 'active', 4: 'passive'}.get(tgt[0]) if tgt else None,
                'ref': str(tgt[1]) if tgt else None, 'points': nm(pt[1]) if pt else None,
                'cost': cost if cost and 0 < cost < 20 else None, 'icon': icon, 'text': text}

    trees = {}
    for g, v in db.rows.items():
        if v[0] != 272:
            continue
        nodes = [x for o, tt, x in db.refs(g) if tt == 273]
        if not nodes:
            continue
        bg = next((s.split('.')[0].rsplit('/', 1)[-1] for o, s in db.strings(g) if 'TreeBG' in s), None)
        idx = {x: i for i, x in enumerate(nodes)}
        out_nodes = []
        for x in nodes:
            t, a, b, n = db.rows[x]
            row = db.d[a:b]
            k = row.find(ANCHOR)
            tier = row[k + 13] if k >= 0 and k + 13 < len(row) else None
            refs = db.refs(x)
            sk = [y for o, tt, y in refs if tt == 268]
            ch = [y for o, tt, y in refs if tt == 274]
            pre_names = [nm(y) for o, tt, y in refs if tt == 271]
            node = {'name': n, 'tier': tier, 'pre_names': pre_names}
            if ch:
                opts = [skill(y) for o, tt, y in db.refs(ch[0]) if tt == 268]
                node['choice'] = [o for o in opts if o]
                node['kind'] = 'choice'
            elif sk:
                s = skill(sk[0])
                if s:
                    node.update(s)
            out_nodes.append(node)
        by_name = {}
        for i, nd in enumerate(out_nodes):
            by_name.setdefault(nd['name'], i)
            if nd.get('skill'):
                by_name.setdefault(nd['skill'], i)
            for c in nd.get('choice', []):
                by_name.setdefault(c['skill'], i)
        for nd in out_nodes:
            nd['pre'] = sorted({by_name[p] for p in nd.pop('pre_names') if p in by_name})
        trees[v[3]] = {'guid': str(g), 'bg': bg, 'nodes': out_nodes}
    json.dump(trees, open(out, 'w'), indent=0)
    print('trees', len(trees))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
