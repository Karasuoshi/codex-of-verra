"""Split DesignData .dbc tables into rows.
Each row ends with a trailer: u64 guid, 8 zero bytes, u32 pool offset of the row's internal name.
References to other records look the same but point to the name "None"; those are skipped."""
import struct, re
from dbc_text import load, read_fstring

PRINTABLE = re.compile(r'^[\x20-\x7e]{1,200}$')

def rows(d, t, pool):
    po, ps = pool
    s, e = t['offset'], t['offset'] + t['size']
    out, p, z = [], s + 8, b'\x00' * 8
    while True:
        p = d.find(z, p, e - 4)
        if p < 0: break
        guid = struct.unpack('<Q', d[p - 8:p])[0]
        ref = struct.unpack('<I', d[p + 8:p + 12])[0]
        if guid and 0 < ref < ps - 4:
            nm, _ = read_fstring(d, po + ref, po + ps)
            if nm and nm != 'None' and PRINTABLE.match(nm):
                out.append({'start': None, 'end': p + 12 - s, 'guid': guid, 'name': nm})
                p += 12
                continue
        p += 1
    prev = 0
    for r in out:
        r['start'] = prev; prev = r['end']
    return out

def plausible_guid(g):
    return (g >> 48) in (0x5428, 0x5429, 0x542a) or 0x5000_0000_0000 <= g < 0x7000_0000_0000

def lis(items, key):
    import bisect
    tails, tidx, prev = [], [], [None] * len(items)
    for i, it in enumerate(items):
        v = key(it)
        j = bisect.bisect_left(tails, v)
        if j == len(tails): tails.append(v); tidx.append(i)
        else: tails[j] = v; tidx[j] = i
        prev[i] = tidx[j - 1] if j else None
    out, i = [], tidx[-1] if tidx else None
    while i is not None: out.append(items[i]); i = prev[i]
    return out[::-1]

def table_rows(d, t, pool):
    """Top-level rows: plausible-guid trailers forming the longest guid-ascending chain."""
    cand = [r for r in rows(d, t, pool) if plausible_guid(r['guid'])]
    best = lis(cand, lambda r: r['guid'])
    prev = 0
    for r in best:
        r['start'] = prev; prev = r['end']
    return best
