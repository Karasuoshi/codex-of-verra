# Verification samples

Values read from in-game tooltips (Evolve server, October 2026) and used to check decoded numbers.

- `ability_tooltips.tsv`: one line per ability, tab-separated.
  - Columns: name, class, then `key=value` fields (`mana`, `range`, `cooldown`, `cast`, `charges`,
    `charlevel` = character level when the screenshot was taken).
  - Samples: Bard at level 2 (scepter), Cleric at level 1.
- Mana in a tooltip = `ceil(base * curve(level) / 32)` (see `AGENTS.md`, section 7). All mana values here match.
- Cast times are in the samples but not in the design data.

Add new samples the same way when you decode a new kind of number, and note the character level.
