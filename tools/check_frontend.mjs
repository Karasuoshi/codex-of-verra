#!/usr/bin/env node
// Offline smoke checks for the static Codex UI and every skill-tree dataset.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const app = read("assets/app.js");
new vm.Script(app, { filename: "assets/app.js" });
for (const fragment of ["pageImprovements", "Guild Championships", "City Legacy", "const screenshotLayout", 'parts[0] === "improvements"']) {
  assert.ok(app.includes(fragment), "Missing UI feature: " + fragment);
}
const css = read("assets/style.css");
for (const cls of [".idea-card", ".idea-more", ".idea-tabs", ".st-canvas"]) assert.ok(css.includes(cls), "Missing style: " + cls);
const trees = JSON.parse(read("data/trees.json")).trees;
assert.equal(trees.length, 23, "Expected all 23 skill trees");
for (const {id} of trees) {
  const tree = JSON.parse(read("data/trees/" + id + ".json"));
  const ids = tree.rows.flatMap(row => row.nodes.map(([n]) => n));
  assert.equal(ids.length, tree.nodes.length, id + ": wrong number of placed nodes");
  assert.equal(new Set(ids).size, tree.nodes.length, id + ": duplicate or missing nodes");
  for (const n of ids) assert.ok(Number.isInteger(n) && n >= 0 && n < tree.nodes.length, id + ": invalid node index");
  tree.nodes.forEach((n, i) => (n.pre || []).forEach(p => assert.ok(Number.isInteger(p) && p >= 0 && p < tree.nodes.length, id + ": invalid prerequisite " + i + " -> " + p)));
}
const match = app.match(/const screenshotLayout = (\{[\s\S]*?\n    \});\n    let y/);
assert.ok(match, "Missing screenshot layouts");
const layouts = vm.runInNewContext("(" + match[1] + ")");
for (const id of ["cleric", "bard", "summoner"]) {
  const tree = JSON.parse(read("data/trees/" + id + ".json"));
  const layout = layouts[id];
  assert.ok(layout, id + ": layout missing");
  assert.equal(Object.keys(layout).length, tree.nodes.length, id + ": missing node coordinates");
  const points = Object.values(layout);
  for (const [x,y] of points) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 20 && y >= 20, id + ": invalid position");
  for (let i=0;i<points.length;i++) for (let j=i+1;j<points.length;j++) {
    const d = Math.hypot(points[i][0]-points[j][0], points[i][1]-points[j][1]);
    assert.ok(d >= 36, id + ": overlapping nodes " + i + ", " + j);
  }
}
// Hand-written party pages: valid JSON, required fields, and every build skill exists in its tree.
for (const name of ["start", "leveling", "builds", "links"]) {
  const d = JSON.parse(read("content/" + name + ".json"));
  assert.ok(d.title && d.lede, name + ": title and lede are required");
  for (const b of d.blocks || []) assert.ok(b.h || b.p || b.list || b.steps || b.table, name + ": empty block");
}
const findNode = (nodes, nm) => nodes.some((d) => d.k === "c" ? d.opts.some((o) => o.n === nm) : d.n === nm);
const builds = JSON.parse(read("content/builds.json"));
assert.equal(builds.classes.length, 8, "Expected builds for all 8 classes");
const stamina = JSON.parse(read("data/trees/stamina.json")).nodes;
for (const c of builds.classes) {
  const nodes = JSON.parse(read("data/trees/" + c.id + ".json")).nodes;
  for (const b of c.builds) for (const nm of b.skills) assert.ok(findNode(nodes, nm), c.id + ": skill not in tree: " + nm);
  if (c.stamina) assert.ok(builds.stamina_presets[c.stamina], c.id + ": unknown stamina preset " + c.stamina);
}
for (const [k, p] of Object.entries(builds.stamina_presets)) for (const nm of p.skills) assert.ok(findNode(stamina, nm), "stamina " + k + ": not in tree: " + nm);
const links = JSON.parse(read("content/links.json"));
for (const g of links.groups) for (const it of g.items) assert.match(it.url, /^https:\/\//, it.name + ": link must be https");
for (const route of ['"start"', '"leveling"', '"builds"', '"links"']) assert.ok(app.includes("parts[0] === " + route), "Missing route " + route);
console.log("PASS: JS parses; party pages valid; all build skills found in their trees; proposal routes/styles exist; 23 skill trees complete; three screenshot layouts cover every node without overlap.");
