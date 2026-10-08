#!/usr/bin/env bash
# Rebuild everything in data/ and build/ from the game's design-data file.
# Usage: tools/build_all.sh <path to CacheDB.dbc> [work dir, default ./work]
# Needs Python 3.10+ and numpy. Takes about 1-2 minutes and under 1 GB of RAM.
# Icons and art are not rebuilt here (they need the Windows extract scripts, see AGENTS.md).
set -euo pipefail
if [ $# -lt 1 ]; then echo "Usage: tools/build_all.sh <path to CacheDB.dbc> [work dir]"; exit 2; fi
DBC="$(realpath "$1")"; W="$(realpath -m "${2:-work}")"
cd "$(dirname "$0")/.."
mkdir -p "$W" build
step() { echo; echo "== $*"; }
step "1/12 texts";            python3 tools/export_texts.py "$DBC" "$W/texts"
step "2/12 dataset";          python3 tools/build_dataset.py "$W/texts" "$W/dataset"
step "3/12 loot and drops";   python3 tools/drops.py "$DBC" "$W/drops"
step "4/12 row index";        python3 tools/dbc_index.py "$DBC" "$W/db.pkl"
step "5/12 ability numbers";  python3 tools/ability_stats.py "$W/db.pkl" build/ability_stats.json
step "6/12 mana curve";       python3 tools/mana_curve.py "$W/db.pkl" build/mana_curve.json
step "7/12 skill trees";      python3 tools/skill_trees.py "$W/db.pkl" build/skill_trees.json
step "8/12 icon links";       python3 tools/icon_links.py "$DBC" build/icon_links.json
step "9/12 site data";        python3 tools/build_site.py "$W"
step "10/12 classes";         python3 tools/build_classes.py
step "11/12 icons in data";   python3 tools/build_icons.py
step "12/12 tree panels";     python3 tools/build_trees.py
echo; echo "Done. Preview: python3 -m http.server 8000  ->  http://localhost:8000/"
