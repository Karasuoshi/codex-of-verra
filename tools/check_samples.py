"""Check decoded ability numbers in data/ against in-game tooltip samples.

Usage: python3 tools/check_samples.py  (reads docs/samples/ability_tooltips.tsv, data/abilities/*, build/mana_curve.json)
Compares mana (at the sample's character level), cooldown, charges and range. Exit code 1 on any mismatch.
"""
import json, glob, math, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
curve = dict((int(l), v) for l, v in json.load(open(os.path.join(ROOT, 'build', 'mana_curve.json'))))
recs = {}
for f in glob.glob(os.path.join(ROOT, 'data', 'abilities', '*.json')):
    for r in json.load(open(f)).values():
        if r.get('st') and r.get('internal'):
            recs.setdefault(r.get('title'), []).append(r)


def secs(v):
    m = re.match(r'^(\d+(?:\.\d+)?)s$', v)
    return float(m.group(1)) if m else None


bad = checked = 0
for line in open(os.path.join(ROOT, 'docs', 'samples', 'ability_tooltips.tsv'), encoding='utf-8'):
    cols = line.rstrip('\n').split('\t')
    if len(cols) < 3 or cols[0].isupper() or cols[0].split()[0].isupper():
        continue
    name, cls = cols[0], cols[1].split()[0]
    kv = dict(c.split('=', 1) for c in cols[2:] if '=' in c)
    if not any(k in kv for k in ('mana', 'cooldown', 'range', 'charges')):
        continue
    cand = [r for r in recs.get(name, []) if r['internal'].startswith(cls + '_')]
    if not cand:
        print(f'?? {name}: no {cls} record'); bad += 1; continue
    st = cand[0]['st']; lvl = int(kv.get('charlevel', 50)); errs = []
    if 'mana' in kv and 'm' in st and math.ceil(st['m'] * curve[lvl] / 32 - 1e-9) != int(kv['mana']):
        errs.append(f"mana {math.ceil(st['m'] * curve[lvl] / 32)} != {kv['mana']}")
    if 'cooldown' in kv and secs(kv['cooldown']) != st.get('cd'):
        errs.append(f"cooldown {st.get('cd')} != {kv['cooldown']}")
    if 'range' in kv and float(kv['range'].rstrip('m')) != st.get('r'):
        errs.append(f"range {st.get('r')} != {kv['range']}")
    if 'charges' in kv and not str(st.get('ch', '1')).startswith(kv['charges']):
        errs.append(f"charges {st.get('ch')} != {kv['charges']}")
    checked += 1
    print(('FAIL ' if errs else 'ok   ') + f'{name} (L{lvl})' + ('  ' + '; '.join(errs) if errs else ''))
    bad += bool(errs)
print(f'{checked} abilities checked, {bad} problems')
sys.exit(1 if bad else 0)
