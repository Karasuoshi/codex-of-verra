# Codex of Verra

Artyom's personal site for his small party in **Ashes of Creation**, in Russian: where to get the game and how to join the Evolve fan server, how to level, starting builds for every class, and links to other community projects. A reference part (classes, skill tree planner, XP curves) is built from the design data of the last Early Access client (build of 2026-01-20).

Static site with no build step. It runs on GitHub Pages as is.

**Want to help?** Read [`AGENTS.md`](AGENTS.md) first. It is the full project guide, for people and for AI assistants (Claude, ChatGPT / Codex, Cursor, Copilot…): rules, how to edit pages, data format, open tasks.

**Address:** https://karasuoshi.github.io/codex-of-verra/

## What is inside
- **Где качать** (`#/start`): Steam client, Evolve account, Evolve Companion on Windows and Linux.
- **Прокачка** (`#/leveling`): XP rules from the game data, a 1–25 route, scrolls and food, weapon levels, professions and their supply chains.
- **Билды** (`#/builds`): a starting build for each of the 8 classes with rotations, stamina priorities and a link that opens it in the planner.
- **Ссылки** (`#/links`): other AoC projects with short descriptions.
- **Классы, Деревья навыков, Опыт:** abilities with mana, cooldowns and range; the in-game style skill tree planner with shareable builds; XP curves.

Page texts live in `content/*.json` (hand-written). Everything in `data/` is generated from the game file.

The raw database (items, loot tables, recipes, quests, places, formulas) was removed from the site on 2026-10-19; its data is still in `data/` and the tools in `tools/`.

**Icons:** 3,621 item, ability, status effect and building icons in `icons/` (WebP, up to 128 px), taken from the game's own unencrypted `pakchunk0` container.

## Files
- `index.html`: the page shell.
- `content/start.json`, `content/leveling.json`, `content/builds.json`, `content/links.json`: the hand-written Russian pages.
- `assets/app.js`: the whole front end (hash routing, content pages, builds, class pages, skill tree planner, XP charts).
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
- `tools/build_all.sh`: runs the whole pipeline in order; `tools/check_samples.py` checks ability numbers against `docs/samples/`.
- `tools/dbc_text.py`, `tools/dbc_rows.py`: read the design-data file (tables, string pool, row boundaries); `tools/export_texts.py` + `tools/build_dataset.py`: English texts by record; `tools/loot.py` + `tools/drops.py`: loot tables and who drops what; `tools/mana_curve.py`: mana by level.
- `tools/pak_list.py`: lists files and byte ranges of an IoStore container; `tools/convert_icons.py`: turns the extracted zips into WebP icons.
- `AGENTS.md` (+ `CLAUDE.md`, `.github/copilot-instructions.md`): guide for contributors and AI assistants.
- `docs/samples/`: in-game tooltip values used for verification.

## Rebuild the data
Everything in `data/` and `build/` is generated from the game's `CacheDB.dbc` with one command (details in `AGENTS.md`, section 5):
```
tools/build_all.sh /path/to/CacheDB.dbc
python3 tools/check_samples.py   # decoded numbers vs in-game tooltips
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
| 2026-10-23 | Gear path page `#/paths/bard-cryptward`: bard route to full Cryptward 26 (Epic), mace and shortbow, set bonuses, crafters. Character-sheet Mag Power = rating / 45, item values checked against an in-game tooltip (`docs/samples/gear_tooltips.tsv`). Not in the menu yet. | published |
| 2026-10-19 | New direction: a Russian-language site for the party. New pages Где качать, Прокачка, Билды (8 classes, planner links) and Ссылки; texts in `content/`. Classes, skill trees and XP translated. Raw database removed from the menu. | published |
| 2026-10-08 | Contributor guide (`AGENTS.md`) for people and AI assistants; all extractors in `tools/` with a one-command rebuild (`build_all.sh`) and a check against in-game tooltips. Loot data now shows names of curves and items in place of raw ids (loot section is still locked). | published |
| 2026-10-08 | Skill tree planner in the game's look (learn, Respec, shareable build link). Only Classes, Skill trees and Experience are open; other sections show as coming soon. Work-in-progress note on the home page. | published |
| 2026-10-08 | Skill trees in the in-game panel style: archetype, weapon and stamina trees with the game's own backgrounds and node frames, unlock arrows, point costs and tooltips. | published |
| 2026-10-08 | Ability numbers: mana by character level, cooldown, charges, range and damage or healing percentages on class pages and ability records. | published |
| 2026-10-08 | Icons for items, recipes, abilities, status effects and class pages. | published |
| 2026-10-08 | Classes: abilities grouped by archetype and kind; status effects in ability texts link to their pages; undecoded numbers shown as labels. | published |
| 2026-10-07 | First build: 10 sections, record data split into shards for upload through the GitHub web page, link preview image. | published |

---
Independent, non-commercial fan project. Not affiliated with or endorsed by Intrepid Studios. Ashes of Creation is a trademark of its owner.
