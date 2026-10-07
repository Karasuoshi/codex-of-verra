# Codex of Verra

A fan-made database for **Ashes of Creation**: items, creatures, recipes, loot tables, quests, places, abilities, status effects, lore and game formulas. Everything is read from the design-data cache that shipped with the last Early Access client (build of 2026-01-20).

Static site with no build step. It runs on GitHub Pages as is.

**Address:** https://karasuoshi.github.io/codex-of-verra/

## What is inside
- **Items:** every known source. The rule path is shown from the source to the item: loot table → subtable → … with weights, chances and conditions.
- **Loot tables:** all 8,197, decoded with rolls, weights, chance formulas and subtables.
- **Recipes:** what each recipe produces. Ingredients are not decoded yet.
- **Creatures:** loot where the client data links it.
- **Quests:** texts and item rewards.
- **Places:** zone-wide and point-of-interest drops.
- **Formulas:** the game's named formulas as source text.
- **Experience:** XP curves for character, artisan skills, weapons and guilds.

Legacy and test records (`zLegacy_`, `Test`, `GM_`, `NOTUSED`…) are hidden by default and can be shown in any list.

## Known gaps
- Item icons live in encrypted game archives and are not included.
- Most creature-specific loot tables are not linked to creatures in the client data, so creature drops are incomplete.
- Recipe ingredients, item stats and enchantments are the next decoding steps.

## Files
- `index.html`: the page shell.
- `assets/app.js`: the reader (hash routing, search, record pages).
- `assets/style.css`: the look.
- `og.jpg`: link preview image, 1200×630.
- `data/<section>.json`: list of records for each section; `data/<section>/<n>.json`: full records, split into shards by `crc32(id) % shards`.
- `data/index.json`: sections, counts and shard numbers; `data/xp.json`: experience curves.
- `tools/build_site.py`: builds `data/` from the exports.
- `build/`: intermediate inputs used by the build.

## Rebuild the data
`data/` is generated from the DesignData exports by `tools/build_site.py`:
```
python3 tools/build_site.py <export-dir>
```

## Run locally
```
python3 -m http.server 8000
```

## GitHub Pages
Settings → Pages → Deploy from a branch → `main` / `(root)`. `.nojekyll` is already in place.

## Changelog
| Date | Change | Status |
|---|---|---|
| 2026-10-07 | First build: 10 sections, record data split into shards for upload through the GitHub web page, link preview image. | published |

---
Independent, non-commercial fan project. Not affiliated with or endorsed by Intrepid Studios. Ashes of Creation is a trademark of its owner.
