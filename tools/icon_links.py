"""Link DesignData records to their UI icon paths.

Icon paths live in the string pool; rows reference them by u32 pool offset.
For each row of the chosen tables, the first pool reference that points to a
'/Game/UI/Icons/...' string is taken as the record's icon.
Output: {guid: '/Game/UI/Icons/...'}
"""
import sys, os, re, struct, json, bisect
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import load
from dbc_rows import table_rows

TABLES = [161, 0, 4, 272, 82, 165, 139, 135, 141, 73, 63, 264, 60, 76, 120]

def main(dbc, out):
    d, tables, (po, ps) = load(dbc)
    pool = d[po:po + ps]
    icon_at = {}
    for m in re.finditer(rb'/Game/UI/Icons/[A-Za-z0-9_/.\-]+', pool):
        st = m.start() - 4
        if st < 0: continue
        ln, = struct.unpack_from('<i', pool, st)
        if ln == len(m.group()) + 1:
            icon_at[st] = m.group().decode().split('.')[0]
    offs = np.array(sorted(icon_at), dtype=np.uint32)
    arr = np.frombuffer(d, dtype=np.uint8)
    links = {}
    for ti in TABLES:
        t = tables[ti]; s, e = t['offset'], t['offset'] + t['size']
        rs = table_rows(d, t, (po, ps))
        ends = [s + r['end'] for r in rs]
        hits = []
        for al in range(4):
            a = s + al; n = (e - a) // 4
            v = arr[a:a + 4 * n].view('<u4')
            idx = np.nonzero(np.isin(v, offs))[0]
            hits.extend((a + 4 * int(i), int(v[i])) for i in idx)
        hits.sort()
        got = 0
        for pos, val in hits:
            k = bisect.bisect_right(ends, pos)
            if k >= len(rs): continue
            g = str(rs[k]['guid'])
            if g not in links:
                links[g] = icon_at[val]; got += 1
        print('table', ti, 'rows', len(rs), 'with icon', got)
    json.dump(links, open(out, 'w'))
    print('icon strings', len(icon_at), 'linked rows', len(links))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
