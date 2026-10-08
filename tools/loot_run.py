import sys, json, collections, os
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import load
from dbc_rows import table_rows
from loot import R, loot_table
def decode_all(path, maxstart=24):
    d, T, pool = load(path)
    tables = {t['id']: t['index'] for t in T}
    t = T[255]; s = t['offset']; rows = table_rows(d, t, pool)
    ok, fail, errs = {}, [], collections.Counter()
    for r in rows:
        gpos = s + r['end'] - 20; last = None
        for st in range(0, maxstart):
            rd = R(d, s + r['start'] + st, gpos, pool, tables)
            try:
                x = loot_table(rd)
                if gpos - 4 <= rd.p <= gpos: ok[r['guid']] = {'name': r['name'], **x}; break
                last = 'overrun %d' % (rd.p - gpos)
            except Exception as e:
                last = str(e).split(' at ')[0]
        else:
            fail.append(r); errs[last] += 1
    return d, T, pool, rows, ok, fail, errs
if __name__ == '__main__':
    d, T, pool, rows, ok, fail, errs = decode_all(sys.argv[1])
    print('rows', len(rows), 'decoded', len(ok), 'failed', len(fail)); print(errs.most_common(12))
