"""Group abilities by archetype and kind -> data/classes.json.

Runs after build_site.py (reads data/abilities*.json and data/effects*.json).
Placeholders in descriptions ($hit1$, $cd$, $effect:Status_Riled$ ...) become
segments: plain text, a link to a status effect, or a marker for a value that
is not decoded yet.
"""
import json, os, re, sys, zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')


def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)


def section_records(sid):
    idx = {s['id']: s for s in load('index.json')['sections']}
    out = {}
    for i in range(idx[sid].get('shards', 1)):
        out.update(load(f'{sid}/{i}.json'))
    return out


CLASSES = [
    ('tank', 'Tank', ['Tank'], ['Tank-A1', 'TankOld'],
     'Frontline defender: holds attention, shields allies and controls the fight.'),
    ('fighter', 'Fighter', ['Fighter'], [],
     'Melee damage dealer: closes distance fast and hits hard up close.'),
    ('rogue', 'Rogue', ['Rogue'], ['Rogue-old'],
     'Stealthy melee striker: positioning, burst damage and debuffs.'),
    ('ranger', 'Ranger', ['Ranger'], ['Ranger-Old', 'Ranger-old'],
     'Ranged physical damage: bows, traps and mobility.'),
    ('mage', 'Mage', ['Mage'], ['Mage-A1'],
     'Ranged magic damage: fire, frost and area spells.'),
    ('cleric', 'Cleric', ['Cleric'], ['Cleric-A1', 'ClericOld'],
     'Healer: restores and protects the group, punishes undead.'),
    ('summoner', 'Summoner', ['Summoner'], [],
     'Commands summoned creatures and fights through them.'),
    ('bard', 'Bard', ['Bard'], [],
     'Support: songs that empower allies and weaken enemies.'),
]

KINDS = [
    ('weapons', 'Weapon attacks', ['WeaponCombo'], ['Old-WeaponCombo'],
     'Basic and combo attacks that come with each weapon type.'),
    ('general', 'General', ['General', 'MountAbility', 'Status', 'Shield', 'Casting'], [],
     'Abilities every character has: dodge, sprint, mounts, shared status attacks.'),
    ('artisan', 'Artisan', ['FISHING', 'Fishing', 'Herbalism', 'Hunting', 'Lumberjacking',
                            'LumberjackingSurveyPylon', 'Mining', 'ArtisanAddFuel',
                            'ArtisanAnvilHammerStrike2H', 'ArtisanBellow', 'ArtisanGrindWheelPress',
                            'ArtisanHeatMold'], [],
     'Gathering, fishing and crafting-station actions.'),
    ('consumables', 'Consumables', ['Consumable'], [],
     'Effects triggered by potions, food, scrolls and other usable items.'),
    ('emotes', 'Emotes', ['Emote'], [], 'Character emotes.'),
    ('siege', 'Siege, caravans & world', ['Siege', 'Caravan', 'Ballista', 'HarpoonLauncher',
                                          'PotionLauncher', 'Vehicle', 'Node', 'Economy', 'Event',
                                          'EventsLivestream', 'Quest', 'CSQ'], [],
     'Siege weapons, caravans, node and event abilities.'),
]

DEV = {'Test', 'Debug', 'GM', 'TEMP', 'TestAbility', 'Prototype', 'NPCTest', 'FighterAnimTest',
       'FighterDebug', 'BotAttack', 'Dummy', 'TargetDummy', 'DEPR', 'Kamehameha',
       'POIEventPrototype', '/Game/UI/Icons/Archetypes/Mage/TUI'}

def ph_kind(tok):
    t = tok.lower()
    if t.startswith('cd'):
        return 'cooldown'
    if t.startswith('charges'):
        return 'charges'
    if 'dur' in t:
        return 'duration'
    if 'tick' in t:
        return 'per tick'
    if 'statmod' in t:
        return 'stat bonus'
    if 'apply' in t or t.startswith('effect'):
        return 'effect'
    if t.startswith(('hit', 'linger', 'init')):
        return 'amount'
    return 'value'


BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')


def jbuild(name, default):
    p = os.path.join(BUILD, name)
    if not os.path.exists(p):
        return default
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def g(v):
    return ('%.3f' % v).rstrip('0').rstrip('.')


def secs(v):
    if v >= 60 and v % 60 == 0:
        return '%d m' % (v // 60)
    if v >= 60:
        return '%d m %s s' % (v // 60, g(v % 60))
    return g(v) + ' s'


def elem_label(elem, stat):
    if stat and stat != 'Health':
        return None
    if not elem:
        return 'damage'
    if elem == 'Element.Healing':
        return 'healing power'
    return elem.split('.')[-1].lower() + ' damage'


def amount_text(hit):
    if not hit:
        return None
    for a in hit.get('amounts', []):
        if a.get('coef') is not None:
            lab = elem_label(hit.get('elem'), a.get('stat'))
            if lab:
                return g(a['coef'] * 100) + '% ' + lab
    return None


def charges_value(ch):
    if ch is None:
        return None
    if isinstance(ch, (int, float)):
        return int(ch) if ch > 1 else None
    m = re.search(r'(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\*\s*\w+\s*$', ch)
    if m and 'GetSkillPurchased' in ch:
        return '%s (+%s with talent)' % (g(float(m.group(1))), g(float(m.group(2))))
    return None


def stats_of(st):
    """Compact stats for the reader: m mana base, cd seconds, ch charges, r range m."""
    if not st:
        return None
    out = {}
    if isinstance(st.get('mana'), (int, float)):
        out['m'] = st['mana']
    if isinstance(st.get('cd'), (int, float)) and st['cd'] > 0:
        out['cd'] = st['cd']
    ch = charges_value(st.get('charges'))
    if ch:
        out['ch'] = ch
    if isinstance(st.get('range'), (int, float)) and st['range'] > 0:
        out['r'] = st['range']
    return out or None


SKILL = re.compile(r'\{skill:[^{}]*(?:\{[^{}]*\})?[^{}]*\}')
TOKEN = re.compile(r'\$([^$\s]{1,80})\$|\{((?:hit|effect|linger|cd|charges)[^{}\s]{0,80})\}')


HITS = {}


def segments(text, effects_by_internal, st=None, eff_name=None):
    """Split a description into text and segments: effect links, resolved numbers, markers."""
    eff_name = eff_name or {}
    text = SKILL.sub('', text or '').rstrip()
    hits = (st or {}).get('hits', [])
    hit_by_name = {h['name']: h for h in hits}
    ab_effects = (st or {}).get('effects', [])

    def eff_link(gid):
        if gid in eff_name:
            return {'e': gid, 'n': eff_name[gid]}
        return None

    out, pos = [], 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            out.append(text[pos:m.start()])
        tok = m.group(1) or m.group(2)
        seg = None
        em = re.match(r'(?i)effect:([A-Za-z0-9_]+)', tok)
        hm = re.match(r'(?i)hit(\d+)(?:[.:](.*))?$', tok)
        hn = re.match(r'(?i)hit:([A-Za-z0-9_]+)(?:[.:](.*))?$', tok)
        en = re.match(r'(?i)effect(\d+)(?:[.:](.*))?$', tok)
        if em:
            if em.group(1) in effects_by_internal:
                gid, name = effects_by_internal[em.group(1)]
                seg = {'e': gid, 'n': name}
            else:
                seg = {'n': re.sub(r'^Status_', '', em.group(1)).replace('_', ' ')}
        elif hm or hn:
            hit = hits[int(hm.group(1)) - 1] if hm and 0 < int(hm.group(1)) <= len(hits) else (
                (hit_by_name.get(hn.group(1)) or HITS.get(hn.group(1))) if hn else None)
            sub = (hm or hn).group(2) or ''
            am = re.match(r'(?i)apply(\d+)(fordur|dur|\.dur)?$', sub)
            if hit and sub.lower() in ('', 'max', 'min'):
                v = amount_text(hit)
                seg = {'v': v} if v else None
            elif hit and am and int(am.group(1)) < len(hit.get('applies', [])):
                link = eff_link(hit['applies'][int(am.group(1))])
                if link and am.group(2) == 'fordur':
                    out.extend([link, ' for '])
                    seg = {'p': 'duration', 't': tok}
                elif link and not am.group(2):
                    seg = link
        elif en and en.group(2) in (None, '', 'inline', 'description', 'hide'):
            k = int(en.group(1)) - 1
            if 0 <= k < len(ab_effects):
                seg = eff_link(ab_effects[k])
        elif tok.lower() == 'charges' and st:
            ch = charges_value(st.get('charges'))
            if isinstance(ch, str) and ' (' in ch:
                seg = {'v': ch.replace(' (', ' charges (', 1)}
            else:
                seg = {'v': (str(ch) + ' charges') if ch else '1 charge'}
        elif tok.lower() == 'cd' and st and isinstance(st.get('cd'), (int, float)):
            seg = {'v': secs(st['cd'])}
        out.append(seg or {'p': ph_kind(tok), 't': tok})
        pos = m.end()
    if pos < len(text):
        out.append(text[pos:])
    merged = []
    for s_ in out:
        if isinstance(s_, str) and merged and isinstance(merged[-1], str):
            merged[-1] += s_
        else:
            merged.append(s_)
    return merged


def main():
    lst = load('abilities.json')
    recs = section_records('abilities')
    effects = section_records('effects')
    eff_by_internal = {}
    for gid, e in effects.items():
        if e.get('internal') and e.get('title'):
            eff_by_internal.setdefault(e['internal'], (gid, e['title']))
    eff_name = {gid: e['title'] for gid, e in effects.items() if e.get('title')}
    stats = jbuild('ability_stats.json', {})
    HITS.update(stats.pop('_hits', {}))
    curve = jbuild('mana_curve.json', [])

    # numbers and resolved texts on the ability records themselves
    idx = {s['id']: s for s in load('index.json')['sections']}
    for i in range(idx['abilities'].get('shards', 1)):
        p = os.path.join(ROOT, 'abilities', f'{i}.json')
        sh = load(f'abilities/{i}.json')
        for gid, rec in sh.items():
            st = stats.get(gid)
            sv = stats_of(st)
            if sv:
                rec['st'] = sv
            if rec.get('description'):
                rec['x'] = segments(rec['description'].strip(), eff_by_internal, st, eff_name)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(sh, f, ensure_ascii=False, separators=(',', ':'))
        recs.update(sh)

    def entries(prefixes):
        rows = [r for r in lst if r['s'] in prefixes and not r.get('d')]
        by_title = {}
        for r in sorted(rows, key=lambda r: (r['n'].lower(), r['id'])):
            d = recs.get(r['id'], {})
            desc = (d.get('description') or '').strip()
            key = r['n'].lower()
            if key in by_title:
                first = by_title[key]
                if desc and desc != first['_desc']:
                    first['v'].append(r['id'])
                continue
            e = {'id': r['id'], 'n': r['n'], 'i': d.get('internal', ''),
                 'x': d.get('x') or segments(desc, eff_by_internal), 'v': [], '_desc': desc}
            if d.get('st'):
                e['st'] = d['st']
            by_title[key] = e
        out = list(by_title.values())
        for e in out:
            del e['_desc']
            if not e['v']:
                del e['v']
            if not e['x']:
                del e['x']
        return out

    used = set(DEV)
    classes = []
    for cid, name, cur, old, blurb in CLASSES:
        used.update(cur, old)
        classes.append({'id': cid, 'name': name, 'blurb': blurb,
                        'abilities': entries(cur), 'legacy': entries(old)})
    kinds = []
    for kid, name, cur, old, blurb in KINDS:
        used.update(cur, old)
        kinds.append({'id': kid, 'name': name, 'blurb': blurb,
                      'abilities': entries(cur), 'legacy': entries(old)})
    creature_prefixes = sorted({r['s'] for r in lst} - used)
    creatures = []
    for p in creature_prefixes:
        e = entries([p])
        if e:
            creatures.append({'family': re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', p), 'abilities': e})
    kinds.append({'id': 'creatures', 'name': 'Creatures',
                  'blurb': 'Abilities used by monsters and bosses, grouped by creature family.',
                  'families': creatures})

    out = {'classes': classes, 'kinds': kinds, 'mana_curve': [v for t, v in curve]}
    with open(os.path.join(ROOT, 'classes.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    for c in classes:
        print(f"{c['name']:10} {len(c['abilities']):3} current, {len(c['legacy']):3} legacy")
    for k in kinds:
        print(f"{k['name']:26} {len(k.get('abilities', k.get('families', [])))}")
    print('bytes', os.path.getsize(os.path.join(ROOT, 'classes.json')))


if __name__ == '__main__':
    main()
