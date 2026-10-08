"""Quick-path export: every DesignData record that carries English text.
Output: one JSON per table under out/texts/, plus out/texts/index.json."""
import sys, json, bisect, os, collections
sys.path.insert(0, os.path.dirname(__file__))
from dbc_text import load, texts
from dbc_rows import table_rows

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
d, T, pool = load(src)
index = []
for t in T:
    tx = texts(d, t)
    if not tx: continue
    rows = table_rows(d, t, pool)
    ends = [r['end'] for r in rows]
    recs = {i: {'guid': str(r['guid']), 'name': r['name'], 'texts': []} for i, r in enumerate(rows)}
    loose = []
    for x in tx:
        i = bisect.bisect_left(ends, x['pos'])
        item = {'key': x['key'], 'text': x['text']}
        if x['ns']: item['ns'] = x['ns']
        (recs[i]['texts'] if i in recs else loose).append(item)
    with_text = [r for r in recs.values() if r['texts']]
    counts = collections.Counter(len(r['texts']) for r in with_text)
    typical = counts.most_common(1)[0][0] if counts else 0
    for r in with_text:
        if typical and len(r['texts']) > 2 * typical + 2: r['suspect_merged'] = True
    data = {'table': t['index'], 'table_id': t['id'], 'rows_total': t['rows'], 'rows_found': len(rows),
            'records': with_text, 'unassigned_texts': loose}
    json.dump(data, open(f"{out}/table_{t['index']:03d}.json", 'w'), ensure_ascii=False, indent=0)
    index.append({'table': t['index'], 'table_id': t['id'], 'rows_total': t['rows'], 'rows_found': len(rows),
                  'records_with_text': len(with_text), 'texts': len(tx), 'unassigned': len(loose),
                  'suspect_merged': sum(1 for r in with_text if r.get('suspect_merged')),
                  'sample': [x['text'][:60] for x in tx[:3]],
                  'sample_names': [r['name'] for r in with_text[:3]]})
json.dump(index, open(f'{out}/index.json', 'w'), ensure_ascii=False, indent=1)
print(len(index), 'tables;', sum(i['records_with_text'] for i in index), 'records;', sum(i['texts'] for i in index), 'texts;',
      sum(i['unassigned'] for i in index), 'unassigned;', sum(i['suspect_merged'] for i in index), 'suspect merged')
