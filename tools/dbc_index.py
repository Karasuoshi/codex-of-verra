"""Shared index over the .dbc: rows of every table by guid, and reference walking."""
import sys, os, struct
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import load, read_fstring
from dbc_rows import table_rows

class DB:
    def __init__(self, path):
        self.d, self.T, self.pool = load(path)
        self.po, self.ps = self.pool
        self.tid = {bytes.fromhex(x['id']): x['index'] for x in self.T}
        self.rows = {}   # guid -> (table, start, end, name)
        self.byname = {}
        for t in self.T:
            try:
                rs = table_rows(self.d, t, self.pool)
            except Exception:
                continue
            s = t['offset']
            for r in rs:
                v = (t['index'], s + r['start'], s + r['end'], r['name'])
                self.rows[r['guid']] = v
                self.byname.setdefault(r['name'], []).append(r['guid'])

    def refs(self, guid):
        t, a, b, _ = self.rows[guid]
        d = self.d; out = []
        for p in range(a, b - 16):
            k = d[p + 8:p + 16]
            if k in self.tid:
                g = struct.unpack_from('<Q', d, p)[0]
                if g and g != guid:
                    out.append((p - a, self.tid[k], g))
        return out

    def strings(self, guid):
        t, a, b, _ = self.rows[guid]
        out = []
        for p in range(a, b - 4):
            o = struct.unpack_from('<I', self.d, p)[0]
            if 0x40 < o < self.ps - 8:
                v, _ = read_fstring(self.d, self.po + o, self.po + self.ps)
                if v is not None and 0 < len(v) < 400 and v.isprintable():
                    out.append((p - a, v))
        return out

    def floats(self, guid, values, tol=1e-4):
        t, a, b, _ = self.rows[guid]
        out = []
        for p in range(a, b - 4):
            v = struct.unpack_from('<f', self.d, p)[0]
            for x in values:
                if x is not None and abs(v - x) < tol:
                    out.append((p - a, x))
        return out


if __name__ == '__main__':
    # python3 tools/dbc_index.py <CacheDB.dbc> <db.pkl>  (index used by ability_stats, skill_trees, mana_curve)
    import pickle
    from dbc_index import DB as _DB  # pickle the class under its module name, not __main__
    pickle.dump(_DB(sys.argv[1]), open(sys.argv[2], 'wb'), protocol=pickle.HIGHEST_PROTOCOL)
    print('indexed', sys.argv[1])
