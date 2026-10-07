"""Extract ability numbers from DesignData (table 0 abilities, 2 hits, 307 damage/heal, 4 effects).

Per ability row (table 0):
  * mana     : string '<base> * EvalFormula(ManaCostMult)'          -> base
  * cooldown : string at (weapon-requirement enum ref) + 30           -> seconds or expression
  * charges  : string at (weapon-requirement enum ref) + 38           -> count or expression ('' = 1)
  * range    : last numeric string before 'ESpeedTypes::' (cm)        -> metres
  * hits     : refs to table 2, in row order ($hit1$, $hit2$ ...)
Per hit (table 2): element tag 'Element.*', refs to 307 (amount rows: coefficient string), refs to 4 (applied effects).
Output JSON: {ability guid: {...}}
"""
import sys, os, re, json, struct, pickle
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import read_fstring

MANA_REF = '6064631874856222777'
NUM = re.compile(r'^\s*-?\d+(\.\d+)?\s*$')


def num(s):
    return float(s) if s is not None and NUM.match(s) else None


class Ext:
    def __init__(self, db):
        self.db = db

    def s_at(self, p):
        db = self.db
        o = struct.unpack_from('<I', db.d, p)[0]
        if 0x40 < o < db.ps - 8:
            v, _ = read_fstring(db.d, db.po + o, db.po + db.ps)
            return v
        return None

    def hit(self, g):
        db = self.db
        t, a, b, n = db.rows[g]
        strs = db.strings(g)
        elem = next((s for o, s in strs if s.startswith('Element.')), None)
        amounts, applies = [], []
        for off, tt, gg in db.refs(g):
            if gg not in db.rows:
                continue
            if tt == 307:
                ss = [s for o, s in db.strings(gg) if s not in ('None', '')]
                rr = db.refs(gg)
                stat = next((db.rows[x][3] for o2, t2, x in rr if x in db.rows and t2 == 3), None)
                expr = next((s for s in ss if 'EvalFormula' in s or 'GetStat' in s), None)
                ta = db.rows[gg][1]
                bv = next((self.s_at(ta + o2 + 20) for o2, t2, x in rr if t2 == 325), None)
                coef, extra = None, None
                if bv:
                    last = [l.strip() for l in bv.replace('\r', '').split('\n') if l.strip()]
                    last = last[-1] if last else ''
                    m2 = re.match(r'^\(?\s*(-?\d+(?:\.\d+)?)\s*(.*)$', last)
                    if m2:
                        coef = float(m2.group(1))
                        extra = m2.group(2).strip() or None
                amounts.append({'name': db.rows[gg][3], 'coef': coef, 'extra': extra, 'stat': stat, 'expr': expr})
            elif tt == 4:
                applies.append(str(gg))
        return {'name': n, 'elem': elem, 'amounts': amounts, 'applies': applies}

    def ability(self, g):
        db = self.db
        t, a, b, n = db.rows[g]
        strs = db.strings(g)
        out = {'name': n}
        m = next((s for o, s in strs if MANA_REF in s and '*' in s), None)
        if m:
            mm = re.match(r'\s*\(*\s*([\d.]+)\s*\*', m)
            out['mana'] = float(mm.group(1)) if mm else m
        w = next((o for o, s in strs if s.startswith('EAbilityWeaponRequirement')), None)
        if w is not None:
            cd = self.s_at(a + w + 30)
            ch = self.s_at(a + w + 38)
            if cd not in (None, '', 'None'):
                out['cd'] = num(cd) if num(cd) is not None else cd
            if ch not in (None, '', 'None'):
                out['charges'] = num(ch) if num(ch) is not None else ch
        sp = next((i for i, (o, s) in enumerate(strs) if s.startswith('ESpeedTypes::')), None)
        if sp:
            prev = [num(s) for o, s in strs[max(0, sp - 4):sp]]
            if len(prev) == 4 and all(v is not None for v in prev):
                out['range'] = prev[3] / 100.0
                out['angle'] = prev[2]
        hits, effects = [], []
        for off, tt, gg in db.refs(g):
            if gg not in db.rows:
                continue
            if tt == 2:
                hits.append(self.hit(gg))
            elif tt == 4:
                effects.append(str(gg))
        out['hits'] = hits
        out['effects'] = effects
        return out


def main(pkl, out):
    db = pickle.load(open(pkl, 'rb'))
    ex = Ext(db)
    res = {}
    for g, (t, a, b, n) in db.rows.items():
        if t != 0:
            continue
        try:
            res[str(g)] = ex.ability(g)
        except Exception as e:
            res[str(g)] = {'name': n, 'error': str(e)}
    hits = {}
    for g, (t, a, b, n) in db.rows.items():
        if t == 2 and n not in hits:
            try:
                h = ex.hit(g)
                if h['amounts'] or h['applies']:
                    hits[n] = h
            except Exception:
                pass
    res['_hits'] = hits
    json.dump(res, open(out, 'w'))
    print('abilities', len(res), 'with cd', sum('cd' in v for v in res.values()),
          'mana', sum('mana' in v for v in res.values()), 'range', sum('range' in v for v in res.values()))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
