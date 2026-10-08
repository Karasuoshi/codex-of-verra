#!/usr/bin/env node
// Browser-level smoke test: actual routes, tab interactions and all 23 skill trees.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".webp":"image/webp", ".png":"image/png", ".svg":"image/svg+xml", ".woff2":"font/woff2" };
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, {"Content-Type":types[path.extname(file)] || "application/octet-stream"});
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
const base = "http://127.0.0.1:" + server.address().port + "/";
const browser = await chromium.launch({headless:true});
let failures = [];
async function check(page,route,selector) {
  await page.goto(base + "#/" + route, {waitUntil:"domcontentloaded"});
  await page.locator(selector).first().waitFor({timeout:15000});
  const error = await page.locator("h1").first().textContent();
  assert.notEqual(error,"This page could not be opened",route+" failed to load");
}
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror", e => failures.push("JS: "+e.message));
  await check(page,"","h1");
  await check(page,"improvements",".idea-more");
  await page.locator(".idea-more").click();
  await page.locator(".idea-tabs button").last().click();
  assert.ok((await page.locator(".idea-body").innerText()).includes("City Legacy"),"Technical tab missing");
  await page.locator('.idea-tabs button[data-tab="rewards"]').click();
  assert.ok((await page.locator(".idea-body").innerText()).includes("+5% Stamina Regeneration"),"City Legacy reward missing");
  const trees = JSON.parse(await fs.readFile(path.join(root,"data/trees.json"),"utf8")).trees;
  for (const {id} of trees) {
    await check(page,"skills/"+id,".st-node");
    const expected = JSON.parse(await fs.readFile(path.join(root,"data/trees",id+".json"),"utf8")).nodes.length;
    assert.equal(await page.locator(".st-node").count(),expected,id+": wrong number of rendered nodes");
    const canvas = await page.locator(".st-canvas").boundingBox();
    assert.ok(canvas && canvas.width>100 && canvas.height>100,id+": empty canvas");
  }
  await check(page,"skills/cleric",".st-node");
  await page.locator(".st-node").first().click();
  await page.locator(".st-btn").filter({hasText:"Respec"}).click();
  assert.equal(await page.locator(".st-node.learned").count(),0,"Respec failed");
  const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on("pageerror", e => failures.push("Mobile JS: "+e.message));
  await check(mobile,"improvements",".idea-more");
  await mobile.locator(".idea-more").click();
  await mobile.locator('.idea-tabs button[data-tab="rewards"]').click();
  assert.ok((await mobile.locator(".idea-body").innerText()).includes("Champion's Endurance"),"Mobile rewards missing");
  await check(mobile,"skills/summoner",".st-node");
  assert.equal(await mobile.locator(".st-node").count(),54,"Mobile summoner nodes missing");
  assert.deepEqual(failures,[],"Browser JavaScript errors");
  console.log("PASS: home, improvement proposal and tabs, all 23 skill tree routes/node counts, respec, and mobile routes.");
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
