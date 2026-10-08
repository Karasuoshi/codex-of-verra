# Codex of Verra: project guide for contributors and AI assistants

This file is the full handoff for the project. It is written for people and for AI coding
assistants: Claude, ChatGPT / Codex, Cursor, Copilot, Gemini and others. If you are an
assistant, read all of it before you change anything. Everything you need is in this file and
in the code it points to. Nothing is kept in anyone's head.

- **Live site:** https://karasuoshi.github.io/codex-of-verra/
- **Repository:** https://github.com/Karasuoshi/codex-of-verra
- **Owner:** Artyom (GitHub `Karasuoshi`). He decides what goes live.

---

## 1. What the project is

Ashes of Creation (AoC) was an MMORPG whose Early Access client stopped being served in
February 2026. The last client build (2026-01-20) still ships its full game-design data in one
file on disk. **Codex of Verra** is an English fan database built from that file:
- classes, abilities and skill trees;
- items, recipes, loot tables;
- creatures, quests and places;
- formulas and experience curves.

It is part of a wider community effort to keep the game playable on private servers. The site
is the public, readable face of that data. The tools in `tools/` are also meant to be reused by
server developers.

The project is built on what can be found in the game files and in screenshots from players.
Statements made by the original developers are not used as a source of truth.

## 2. Ground rules (read first)

1. **`main` is the live site.** GitHub Pages serves the `main` branch as is.
   - Never push straight to `main`. Work on a branch and open a pull request.
   - Artyom merges when he says it should go live.
2. **Public text is in English.** This covers the site, README, commit messages and code
   comments. Artyom himself works in Russian. If you talk to him, Russian is welcome, short and
   to the point.
3. **Only three sections are open on the site:** Classes, Skill trees and Experience.
   - Everything else shows as "Coming soon" and cannot be clicked.
   - This is controlled in `assets/app.js` by the `OPEN` regex and `link()` (what is clickable), and by
     `route()`, which sends `db/*` and `search` to the "Coming soon" page.
   - Open a new section only after Artyom agrees that its data is checked.
4. **No secrets in the repository.** Never commit or ask for passwords, tokens or keys.
5. **No game files in the repository.** The `.dbc`, `.utoc`, `.ucas` and `.pak` files, and the
   zips extracted from them, stay out. They are also far over GitHub's 100 MB file limit.
   - Only converted, small outputs are committed: JSON in `data/` and `build/`, WebP in
     `icons/` and `art/`.
   - See `.gitignore`.
6. **Work from files and screenshots only.** Data comes from files on disk and from players'
   screenshots. The project does not modify, patch or inject into the game client.
7. **Do not touch other repositories** of the owner. In particular, `Karasuoshi/reported` is a
   separate project. Every new site gets its own repository.
8. **Check before you claim.** Every decoded number must be checked against at least one
   in-game screenshot or known value (see `docs/samples/`) before it is shown on the site.
   - `python3 tools/check_samples.py` checks ability numbers against the samples; it must pass.
   - When unsure, show the raw label rather than a guess.
   - Write down what you verified in the pull request.
9. **Before a pull request goes live, show previews:**
   - screenshots at desktop width (about 1280 px) and phone width (390 px);
   - no horizontal scrolling and no console errors.

## 3. Repository map

```
README.md             short public description, file list and changelog
AGENTS.md             this guide; CLAUDE.md and .github/copilot-instructions.md point to it
index.html            page shell (fonts, nav, <main>)
assets/app.js         the whole front end, no framework, no build step
assets/style.css      the look (dark stone and gold, game-style skill tree)
og.jpg                link preview image 1200x630
data/                 GENERATED site data (do not hand-edit; rebuild)
  index.json          sections, record counts, shard counts, build date
  <section>.json      list rows of a section (id, name, short fields, icon)
  <section>/<n>.json  full records, shard n = crc32(id) % shards (keeps files < ~4 MB)
  classes.json        class pages (abilities by archetype and kind) + mana curve
  trees.json          list of skill trees; trees/<id>.json = one tree panel
  xp.json             experience curves
build/                intermediate inputs, committed so the site can be rebuilt without the game
  ability_stats.json  per-ability numbers (mana, cooldown, charges, range, hits)
  mana_curve.json     mana multiplier by character level (1..50)
  skill_trees.json    raw skill tree nodes, prerequisites, tiers, costs
  icon_links.json     record guid -> /Game/UI/Icons/... path
  icon_files.json     /Game/UI/Icons/... path -> file in icons/
  xp.json             XP curves, copied to data/xp.json (taken from an older community codex
                      sample, not yet regenerated from the .dbc)
icons/                ~3,650 WebP icons (items, abilities, effects, buildings), max 128 px
art/                  skill tree backgrounds; art/ui/ = node frames and buttons from the game UI
tools/                every extractor and builder (Python 3, see section 5)
docs/samples/         in-game tooltip values used to verify decoded numbers
work/                 local work files of the build (ignored by git)
```

## 4. Run the site locally

```
python3 -m http.server 8000
# open http://localhost:8000/
```

A web server is required: the site loads JSON with `fetch`, which does not work from `file://`.
Routes are hash routes:
- `#/classes/<id>`: a class page.
- `#/skills/<id>?b=3.5.7c1`: a skill tree with a saved build (node indexes; `cN` = chosen option).
- `#/xp/<tab>`: experience curves.
- `#/db/<section>/<id>`: a record page (locked for now).

## 5. Rebuild the data from the game file

You need:
- **The design-data file** from an installed client:
  `Ashes of Creation/Game/AOC/Plugins/DesignDataPlugin/Generated/Client/CacheDB.dbc`
  (144,085,052 bytes, CRC32 `6ece5efc` for the 2026-01-20 build). Artyom can share it with
  project members privately. It is not in the repo.
- **Python 3.10+ with `numpy`**; `Pillow` only for icons.

One command rebuilds `build/` and `data/` (about 1-2 minutes, under 1 GB of RAM):

```
tools/build_all.sh /path/to/CacheDB.dbc [work dir]  # work dir default: ./work in the current folder
python3 tools/check_samples.py                       # numbers vs in-game tooltips, must pass
git diff --stat                                      # see what changed
```

`build_site.py` (step 9) deletes and rewrites the whole `data/` folder, so steps 9-12 always run
together. `build_all.sh` does that for you.

The steps it runs, in order (order matters):

| # | Script | Output |
|---|---|---|
| 1 | `export_texts.py <dbc> work/texts` | every English text, per table |
| 2 | `build_dataset.py work/texts work/dataset` | texts grouped into records by category |
| 3 | `drops.py <dbc> work/drops` | decoded loot tables, formulas, who drops what |
| 4 | `dbc_index.py <dbc> work/db.pkl` | index of every row (used by 5-7) |
| 5 | `ability_stats.py work/db.pkl build/ability_stats.json` | ability numbers |
| 6 | `mana_curve.py work/db.pkl build/mana_curve.json` | mana by level |
| 7 | `skill_trees.py work/db.pkl build/skill_trees.json` | tree nodes |
| 8 | `icon_links.py <dbc> build/icon_links.json` | record -> icon path |
| 9 | `build_site.py work` | `data/` sections and shards |
| 10 | `build_classes.py` | `data/classes.json`, numbers in ability texts |
| 11 | `build_icons.py` | `ic` icon fields in `data/` |
| 12 | `build_trees.py` | `data/trees.json`, `data/trees/*.json` |

Libraries used by these scripts:
- `dbc_text.py`: header, table directory, string pool, FText.
- `dbc_rows.py`: row boundaries.
- `loot.py`: the loot table decoder.
- `iostore.py`, `utexture.py`: the pak readers.

`loot_run.py` is a diagnostic. It decodes all loot tables and prints decode errors.

A clean rebuild from the 2026-01-20 file reproduces the published `data/` exactly, apart from
the build date. Keep it that way: if your change alters other records, say why in the PR.

### Icons and UI art (only when they need to be re-extracted)

The `.utoc`/`.ucas` containers of this build are **not encrypted or compressed**. A file is just
a byte range. The flow, already done once, is:
1. `pak_list.py <container.utoc> <prefix> <regex> > list.tsv` lists the files and byte ranges.
   `tools/icon_list.tsv` (pakchunk0, UI icons) and `tools/ui_list.tsv` (pakchunk0_s2, skill-tree
   art) are the current lists.
2. On Windows, `run_extract_icons.bat` / `run_extract_ui.bat` (PowerShell `extract_*.ps1`) read
   those ranges from the game folder into zips of ~4.5 MB.
   - Only reads; nothing in the game folder is changed.
   - Edit the `$ucas` path at the top of the `.ps1` if the game is installed elsewhere.
3. `convert_icons.py <folder with icons_*.zip>` decodes the textures (`utexture.py`) into WebP
   and updates `build/icon_files.json`.
   - The zips land in `tools/parts/` (icons) and `tools/parts_ui/` (UI art). Both folders are
     ignored by git.
   - The UI art in `art/` was converted once with the same `utexture.decode()`. There is no script
     for it yet.
- Default install path in the scripts: `D:\SteamLibrary\steamapps\common\Ashes of Creation`.
  The containers are in `Game\AOC\Content\Paks\`.

## 6. The design-data file (`.dbc`) format

All game logic lives in this file, outside the asset paks.

### Header and table directory
- **Header:**
  - `IDB\x01` + u64 version hash;
  - at 0x14, u64 table count (369);
  - at 0x28, u32 string-pool offset;
  - at 0x30, u32 string-pool size.
- **Table directory:** starts at 0x38, 32 bytes per table:
  `[u32 content hash][u64 table id][u32 offset][u32 0][u32 size][u32 0][u32 rows]`.
  - Tables are stored back to back.
  - The table id is stable between file versions.
  - In this guide, "table N" is the table's **index** in the directory.

### Rows and strings
- **String pool:** FStrings (`int32 len` including `\0`; negative = UTF-16LE). Rows point into it
  with u32 offsets. Enum values (`EItemGrade::NG`), asset paths and record names live here.
  - `0x43` = empty string, `0x63` = `None`.
- **Row trailer:** every row ends with `u64 guid, 8 zero bytes, u32 pool ref to the internal name`.
  - Rows inside a table are sorted by guid.
  - `dbc_rows.py` finds row boundaries as the longest increasing chain of trailers. This
    locates ~93% of rows exactly; the NPC spawn table 230 is the weakest.
- **Reference to another record:** `u64 guid + u64 table id + u32 name ref` (name usually `None`).
- **FText:** `u32 flags, i8 history`; if 0, then FString namespace, key and source; if -1, then
  `u32 has` + FString.
- **Other field types:**
  - bool = u8; array = u32 count + items;
  - curve = `ext s, keys[{3 x u8, 6 x f32}], f32 default, pre s, post s`.
- **Expressions:** many fields are script strings like
  `2 + EvalFormula($#<table id>:<guid>$)`.
  - The `$#...$` part is a record reference.
  - `drops.py` resolves these to `{Name}`.
- **Guids** match the ones used by the old community codex sites and by the game itself. Use them
  as the stable key everywhere.

### Table map (index: content)
- **Items and gear:**
  - 161 items (10,568);
  - 172 item stat blocks;
  - 174 rarity;
  - 249, 163 grades.
- **Abilities and effects:**
  - 0 abilities (2,130);
  - 2 ability hits;
  - 4 status effects / passives (2,794);
  - 307 damage and heal amounts;
  - 325 base values.
- **Stats and formulas:**
  - 296 curves (incl. `Player_Base_*`);
  - 298 expression texts;
  - 300 named formulas;
  - 303 stat profiles (`Player_Base_<class>`, mobs).
- **Skill trees:**
  - 272 trees;
  - 273 nodes;
  - 274 choice nodes;
  - 268 skills;
  - 270 skill definitions;
  - 269 point types;
  - 271 prerequisites.
- **Loot:** 255 loot tables (8,197, all decode).
- **Crafting:**
  - 73 processing and crafting recipes;
  - 63 commodity recipes;
  - 72, 75 tiers and professions;
  - 76 crafting stations;
  - 3 artisan mechanics.
- **NPCs:**
  - 230 NPC spawn records: named NPCs, display names live here. `build_dataset.py` files them as
    `npcs`, and `drops.py` as `npc_spawn`.
  - 229 NPC definitions ("populations" in `build_dataset.py`).
  - 17 asset sets (spawn -> set -> NPC definition).
- **Quests:**
  - 60 quests;
  - 313 story quests;
  - 365 steps;
  - 203, 366 objectives;
  - 319 tasks.
- **Dialogue:**
  - 201 nodes;
  - 95 choices;
  - 98, 345 lines;
  - 10 dialogue actions.
- **World:**
  - 197 locations;
  - 226, 19 points of interest;
  - 363 zones of influence;
  - 120, 213, 33 buildings;
  - 338 vendors;
  - 82 currencies.
- **Events and lore:**
  - 112, 114, 117, 119, 330 events;
  - 346 node and guild wars;
  - 310, 311 lore books.

### Two versions of the file
- `CacheDB.dbc`: the original client data. The site is built from this one.
- `0_AoCEvolve.dbc`: the version used by the Evolve server. It is CacheDB plus additions in 17
  tables (vendors, a few dialogues, fishing mini-game abilities), with nothing removed.

## 7. How specific data is decoded

### Ability numbers (`ability_stats.py`, verified against 9 of 9 sample tooltips)
- **Mana:** the string `<base> * EvalFormula(ManaCostMult)`.
  - The tooltip shows `ceil(base * curve(level) / 32)`.
  - The curve is `Player_Base_ManaCostMult` (table 296): L1 15.0 ... L50 422.5.
- **Cooldown:** the string at `w + 30`, where `w` = row offset of the `EAbilityWeaponRequirement::*`
  enum ref. Seconds, or an expression.
- **Charges:** the string at `w + 38`. An empty string means 1. It can be an expression, e.g.
  `3 + 2 * plentiful` (a talent adds 2).
- **Range:** the 4 numeric strings before `ESpeedTypes::`. The last one is the max range in cm;
  the third is the angle.
- **Hits:** refs to table 2 in row order. `$hit1$` in a description is the first hit.
  - A hit has an `Element.*` tag, refs to 307 (amounts) and refs to 4 (applied effects,
    `$hitN.applyM$`).
- **Amount (307):** the coefficient string sits at the `BaseValue` (325) ref offset + 20.
  - `1.5` = 150% of damage or healing power.
  - It can be an expression whose last line is the value, e.g. `1.5 + 0.15 * escalating`.
- **Cast time** is not in the design data (probably animation montages). It is not shown.

### Skill trees (`skill_trees.py`, `build_trees.py`)
- **The record chain:**
  - a 272 tree refers to its 273 nodes, in order;
  - a node refers to a 268 skill, or to a 274 choice holding several 268 skills;
  - a 268 skill refers to a 270 definition;
  - the 270 definition refers to an ability (table 0) or an effect (table 4). It also holds the
    passive text, the icon path and a 269 point-type ref; the point cost is the i32 at the 269
    ref offset + 20.
- **Prerequisites:** 271 refs, by name.
- **Tier:** the byte at (anchor `2f64255ae111c34c` in the node row) + 13.
- **Which trees:**
  - The `Mage` tree record holds both Ranger and Mage nodes; they are split by name prefix.
  - Weapon trees are `Weapon_*`; Stamina is `Universal`.
- **Node positions are not in the design data** (they live in UI widgets).
  - `build_trees.py` lays nodes out as a layered graph: row = (tier, prerequisite depth).
  - Matching the game layout exactly needs full-tree screenshots.

### Loot (`loot.py`, `drops.py`)
- **Loot table:** a predicate, containers, and a subtable selection (with weights, weight
  expressions, percentages and a curve).
- **Container:** a selection algorithm (`All`, `PureRandom`, `PerElementWeightedRandom`,
  `PerElementWeightedExpressionRandom`, `RollEachByPercent`), weights or drop percentages, and
  rewards. A reward holds items with quantity, currency and XP.
- **Sources:** referencing tables are listed in `SRC_TABLES` in `drops.py`.
- **Known gap:** 525 creature loot tables (`Bear_Base`, `..._Named`, `..._WorldBoss`) are not
  linked to any record in the client data. The server assigned them by a rule the client does
  not have. Their names match stat profiles (303).

### Text placeholders
- **The tokens:** descriptions use `$hit1$`, `$effect1.inline$`, `$statmod1.%$`, `{skill:...}`.
- **On the site:** `build_classes.py` (`segments()`) turns them into numbers or links where the
  data is known, and into dotted labels where it is not.

## 8. Front end notes (`assets/app.js`)

- **Structure:** plain JS in one IIFE, with no dependencies and no build step.
  - `h()` creates elements and `load()` fetches JSON from `data/` with a cache.
  - `route()` dispatches on the hash.
- **Pages:**
  - `pageHome`;
  - `pageClasses(id)`;
  - `pageSkills(id)` (the tree planner, with layout constants `STEP`, `ROWH`, `PADX`, `PADY`,
    `TIERGAP`);
  - `pageXp`;
  - `pageList`, `pageRecord` and `pageSearch` (`#/search?q=`): all locked, routed to `pageSoon`;
  - `pageMissing` (unknown routes).
- **Skill planner:**
  - Learned nodes live in the URL (`?b=`), so builds can be shared.
  - Learning a node needs its prerequisites; unlearning cascades.
  - Desktop shows tooltips on hover; on a phone, a tap docks the tooltip at the bottom.
- **localStorage keys:** `cov.level` (level picker, default 50) and `cov.dev` (show legacy
  records). Every access is wrapped in try/catch.
- **Style:**
  - fonts Cinzel, Spectral and Alegreya Sans (Google Fonts); dark theme only;
  - all images are local (`icons/`, `art/`), with no third-party image hosts;
  - all links are relative, because the site lives under `/codex-of-verra/`.

## 9. Open work (good first tasks), in rough priority

1. **Effect durations and percentages** (table 4): `$statmodN$`, `...fordur`, linger zones.
   - Saga and Chains of Restraint are examples: tick, duration and damage per tick.
   - About 90 labels on class pages are still dotted because of this.
2. **Exact skill tree layout.** Collect full screenshots of each tree from players and encode the
   node positions (a small override JSON per tree is fine).
3. **Stamina tree icons.** They point to `/Game/UI_Kit/Textures/icons/...`, which is in another pak
   container. Find it with `pak_list.py` and extract it the same way.
4. **Item stats** (table 172, attributes in 296, stat definitions 298/300/325) and
   **enchantments** (start from item fields that reference them).
5. **Recipe ingredients** (table 73) and crafting tiers.
6. **Creature loot links:** decode the fields of 229 / 17 / 230 (type, level, elite rank, stat
   profile) to connect the 525 unlinked tables.
7. **World positions of NPCs and spawns.** They are not in the `.dbc` (spawn rows have no
   coordinates). They live in the level / world-partition data in the paks. Players already ask
   "where does NPC X stand".
8. **Re-open the locked sections** one by one once their data is checked (items first).
9. **XP curves from the `.dbc`:** `build/xp.json` still comes from an older community sample.
   Regenerate it from the curve table 296 (`Adventuring_LevelUpCurve` and others).
10. **Combat-meter names:** a JSON map from internal ability or effect names to display names and
   icons. Players' combat-log tools can use it.

Before you start on one, open a GitHub issue or tell Artyom, so two people do not do the same
thing.

## 10. Workflow

```
git checkout -b feature/<short-name>
# ...change tools/ or assets/, rebuild with tools/build_all.sh if data is affected...
python3 tools/check_samples.py       # must pass
python3 -m http.server 8000          # check desktop and 390 px phone width, console clean
git commit -m "Short English summary"
git push -u origin feature/<short-name>
# open a pull request into main: what changed, how it was verified, screenshots
```

- **Commits:** small, with an English message saying what changed and why.
- **Generated files** (`data/`, `build/`) go in the same PR as the code change that produced
  them.
- **The site changelog** is the table at the end of `README.md`. Add a row with date and change,
  status `draft`. Artyom sets it to `published` when it goes live.

## 11. If you are a chat assistant without repository access

Ask the user to give you, in this order:
1. this file;
2. the files you will change (for example `assets/app.js` or one script in `tools/`);
3. for data questions, the matching JSON from `data/` or `build/`.

Return full replacement files or clear unified diffs, and say what the user should run to check
them. Do not guess file contents you have not seen. With repository access (ChatGPT or Claude
GitHub connectors, Codex, Cursor), read the repository directly instead.
