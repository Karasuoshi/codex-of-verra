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


def segments(text, effects_by_internal):
    """Split a description into text and placeholder segments."""
    out, pos = [], 0
    for m in re.finditer(r'\$([^$\s]{1,80})\$', text or ''):
        if m.start() > pos:
            out.append(text[pos:m.start()])
        tok = m.group(1)
        em = re.match(r'(?i)effect:([A-Za-z0-9_]+)', tok)
        if em and em.group(1) in effects_by_internal:
            gid, name = effects_by_internal[em.group(1)]
            out.append({'e': gid, 'n': name})
        elif em:
            out.append({'n': re.sub(r'^Status_', '', em.group(1)).replace('_', ' ')})
        else:
            out.append({'p': ph_kind(tok), 't': tok})
        pos = m.end()
    if pos < len(text or ''):
        out.append(text[pos:])
    # merge neighbouring strings
    merged = []
    for s in out:
        if isinstance(s, str) and merged and isinstance(merged[-1], str):
            merged[-1] += s
        else:
            merged.append(s)
    return merged


def main():
    lst = load('abilities.json')
    recs = section_records('abilities')
    effects = section_records('effects')
    eff_by_internal = {}
    for gid, e in effects.items():
        if e.get('internal') and e.get('title'):
            eff_by_internal.setdefault(e['internal'], (gid, e['title']))

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
            by_title[key] = {'id': r['id'], 'n': r['n'], 'i': d.get('internal', ''),
                             'x': segments(desc, eff_by_internal), 'v': [], '_desc': desc}
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

    out = {'classes': classes, 'kinds': kinds}
    with open(os.path.join(ROOT, 'classes.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    for c in classes:
        print(f"{c['name']:10} {len(c['abilities']):3} current, {len(c['legacy']):3} legacy")
    for k in kinds:
        print(f"{k['name']:26} {len(k.get('abilities', k.get('families', [])))}")
    print('bytes', os.path.getsize(os.path.join(ROOT, 'classes.json')))


if __name__ == '__main__':
    main()
