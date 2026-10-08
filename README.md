# Codex of Verra

A fan-made database for **Ashes of Creation**: items, creatures, recipes, loot tables, quests, places, abilities, status effects, lore and game formulas. Everything is read from the design-data cache that shipped with the last Early Access client (build of 2026-01-20).

Static site with no build step. It runs on GitHub Pages as is.

**Address:** https://karasuoshi.github.io/codex-of-verra/

## What is inside
- **Items:** every known source. The rule path is shown from the source to the item: loot table → subtable → … with weights, chances and conditions.
- **Classes:** abilities of the eight archetypes, with older Alpha versions, plus weapon, general, artisan, consumable, siege and creature abilities.
- **Loot tables:** all 8,197, decoded with rolls, weights, chance formulas and subtables.
- **Recipes:** what each recipe produces. Ingredients are not decoded yet.
- **Creatures:** loot where the client data links it.
- **Quests:** texts and item rewards.
- **Places:** zone-wide and point-of-interest drops.
- **Formulas:** the game's named formulas as source text.
- **Experience:** XP curves for character, artisan skills, weapons and guilds.

**Icons:** 3,621 item, ability, status effect and building icons in `icons/` (WebP, up to 128 px), taken from the game's own unencrypted `pakchunk0` container.

Legacy and test records (`zLegacy_`, `Test`, `GM_`, `NOTUSED`…) are hidden by default and can be shown in any list.

## Known gaps
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
- `tools/build_classes.py`: groups abilities by class and kind into `data/classes.json`; run it after `build_site.py`.
- `data/classes.json`: class pages.
- `icons/`: icons by game folder (`Items/`, `Resource/`, `Abilities/`, `StatusEffects/`…).
- `tools/extract_icons.ps1`: copies icon packages out of `pakchunk0` on Windows (byte ranges from `icon_list.tsv`).
- `tools/iostore.py`, `tools/utexture.py`: read the IoStore table of contents and decode icon textures.
- `tools/icon_links.py`: links records to icon paths in the design data; `tools/build_icons.py` adds them to `data/`.
- `build/icon_links.json`, `build/icon_files.json`: record → icon path → file.
- `tools/skill_trees.py` → `build/skill_trees.json`: tree nodes, prerequisites, tiers and point costs; `tools/build_trees.py` → `data/trees.json`, `data/trees/<id>.json` (layout and tooltips).
- `art/`: tree backgrounds and node frames from `pakchunk0_s2` (`tools/extract_ui.ps1`, list `ui_list.tsv`).
- `tools/dbc_index.py`, `tools/ability_stats.py`: index every design-data row and read ability numbers (mana, cooldown, charges, range, hits). Output `build/ability_stats.json`; `build/mana_curve.json` is the mana-by-level curve.
- `build/`: intermediate inputs used by the build.

## Rebuild the data
`data/` is generated from the DesignData exports by `tools/build_site.py`:
```
python3 tools/build_site.py <export-dir>
python3 tools/build_classes.py
python3 tools/build_icons.py
python3 tools/build_trees.py
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
| 2026-10-08 | Skill trees in the in-game panel style: archetype, weapon and stamina trees with the game's own backgrounds and node frames, unlock arrows, point costs and tooltips. | not published |
| 2026-10-08 | Ability numbers: mana by character level, cooldown, charges, range and damage or healing percentages on class pages and ability records. | not published |
| 2026-10-08 | Icons for items, recipes, abilities, status effects and class pages. | published |
| 2026-10-08 | Classes: abilities grouped by archetype and kind; status effects in ability texts link to their pages; undecoded numbers shown as labels. | published |
| 2026-10-07 | First build: 10 sections, record data split into shards for upload through the GitHub web page, link preview image. | published |

---
Independent, non-commercial fan project. Not affiliated with or endorsed by Intrepid Studios. Ashes of Creation is a trademark of its owner.
