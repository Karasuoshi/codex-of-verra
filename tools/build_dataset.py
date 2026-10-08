"""Assemble the quick-path English dataset by category from out/texts."""
import json, os, re, csv, collections
import sys
# Usage: python3 tools/build_dataset.py <texts dir from export_texts.py> <dataset out dir>
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# Table index -> category. Inferred from record names and texts; keep in sync with the project notes.
CAT = {
 161: 'items', 0: 'abilities', 4: 'status_effects', 3: 'artisan_mechanics',
 60: 'quests', 313: 'quests_story', 365: 'quest_steps', 366: 'quest_objectives', 203: 'quest_objectives', 319: 'tasks',
 201: 'dialogue_nodes', 95: 'dialogue_choices', 98: 'dialogue_responses', 345: 'dialogue_responses',
 230: 'npcs', 229: 'npc_populations', 17: 'npc_populations',
 197: 'locations', 226: 'points_of_interest', 19: 'points_of_interest', 363: 'zones_of_influence',
 120: 'buildings', 213: 'buildings', 33: 'buildings', 76: 'crafting_stations',
 139: 'gathering', 135: 'gathering', 141: 'gathering', 73: 'processing_recipes', 63: 'commodity_recipes',
 112: 'events', 114: 'events', 117: 'events', 119: 'events', 330: 'events', 346: 'node_and_guild_wars', 68: 'world_quests',
 310: 'lore_books', 311: 'lore_books', 272: 'archetypes', 264: 'armor_types', 82: 'currencies', 165: 'materials',
 155: 'interactables', 223: 'interactions', 334: 'tutorials', 359: 'tutorials', 360: 'ui', 219: 'ui', 69: 'ui', 190: 'map_markers',
 71: 'character_creation', 41: 'character_creation', 344: 'voice_casting', 248: 'relics', 352: 'phases',
}
JUNK = re.compile(r'^(z?Legacy|ZDELETE|NOTUSED|Obsolete|Test|Debug|AimiTest|GM_|z)', re.I)
cats = collections.defaultdict(list); stats = collections.Counter(); junk = collections.Counter()
for f in sorted(os.listdir(SRC)):
    if not f.startswith('table_'): continue
    t = json.load(open(f'{SRC}/{f}'))
    cat = CAT.get(t['table'], 'other')
    for r in t['records']:
        texts = [x['text'] for x in r['texts']]
        rec = {'guid': r['guid'], 'internal_name': r['name'], 'table': t['table'],
               'title': texts[0] if texts else '', 'texts': texts}
        if r.get('suspect_merged'): rec['suspect_merged'] = True
        if JUNK.match(r['name']) or re.search(r'(^|_)(TEST|Test)(_|$)', r['name']): rec['dev_or_unused'] = True; junk[cat] += 1
        cats[cat].append(rec); stats[cat] += 1
for cat, recs in cats.items():
    json.dump(recs, open(f'{OUT}/{cat}.json', 'w'), ensure_ascii=False, indent=1)
    with open(f'{OUT}/{cat}.csv', 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(['guid', 'internal_name', 'table', 'title', 'description', 'other_texts', 'flags'])
        for r in recs:
            flags = ';'.join(k for k in ('dev_or_unused', 'suspect_merged') if r.get(k))
            w.writerow([r['guid'], r['internal_name'], r['table'], r['title'], r['texts'][1] if len(r['texts']) > 1 else '',
                        ' | '.join(r['texts'][2:]), flags])
summary = {c: {'records': n, 'dev_or_unused': junk[c]} for c, n in sorted(stats.items(), key=lambda kv: -kv[1])}
json.dump(summary, open(f'{OUT}/_summary.json', 'w'), indent=1)
for c, v in summary.items(): print(f"{c:22s} {v['records']:6d}  (dev/unused {v['dev_or_unused']})")
print('total', sum(stats.values()))
