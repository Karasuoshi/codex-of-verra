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
console.log("PASS: JS parses; proposal routes/styles exist; 23 skill trees complete; three screenshot layouts cover every node without overlap.");
