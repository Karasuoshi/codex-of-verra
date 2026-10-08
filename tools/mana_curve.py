"""Mana cost multiplier curve by character level -> build/mana_curve.json.

Curve record 'Player_Base_ManaCostMult' (table 296). Keys start at row offset +10:
u32 count, then count x {3 x u8, f32 time (level), f32 value, 4 x f32 tangents/weights} (27 bytes).
Tooltip mana = ceil(base * value(level) / 32).
Usage: python3 tools/mana_curve.py <db.pkl> <out.json>
"""
import sys, os, json, struct, pickle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbc_index  # noqa: F401  (class used by the pickle)

NAME = 'Player_Base_ManaCostMult'


def main(pkl, out):
    db = pickle.load(open(pkl, 'rb'))
    g = next(x for x in db.byname[NAME] if db.rows[x][0] == 296)
    t, a, b, n = db.rows[g]
    row = db.d[a:b]
    cnt = struct.unpack_from('<I', row, 10)[0]
    keys = [list(struct.unpack_from('<ff', row, 14 + i * 27 + 3)) for i in range(cnt)]
    keys = [[round(x, 4), round(y, 4)] for x, y in keys]
    json.dump(keys, open(out, 'w'))
    print('mana curve keys', len(keys), keys[0], keys[-1])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
