/* Codex of Verra — static reader for Ashes of Creation design data.
   No build step: reads JSON from data/, hash routes (#/...), runs on GitHub Pages. */
(function () {
  "use strict";

  const SVG = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const fmt = (v) => (typeof v === "number" ? nf.format(v) : v);
  const main = document.getElementById("main");
  const nav = document.getElementById("nav");
  let INDEX = null;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function s(tag, attrs) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }
  const cache = new Map();
  function load(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch("data/" + path).then((r) => {
        if (!r.ok) throw new Error("Could not load data/" + path + " (HTTP " + r.status + ")");
        return r.json();
      }).catch((e) => { cache.delete(path); throw e; }));
    }
    return cache.get(path);
  }
  // Only these parts of the codex are open for now; everything else is shown but not clickable.
  const OPEN = /^(|classes(\/.*)?|skills(\/.*)?|xp(\/.*)?|improvements(\/.*)?)$/;
  const isOpen = (to) => OPEN.test(String(to).split("?")[0]);
  const link = (to, text, cls) => isOpen(to) ? h("a", { href: "#/" + to, class: cls }, text)
    : h("span", { class: "locked" + (cls ? " " + cls : ""), title: "Coming soon" }, text);
  const icon = (src, cls) => src ? h("img", { src, alt: "", class: "ic" + (cls ? " " + cls : ""), loading: "lazy", decoding: "async" }) : null;
  const section = (id) => INDEX.sections.find((x) => x.id === id) || { id, title: id };

  // Legacy and test records are hidden unless the reader turns them on.
  let showDev = false;
  try { showDev = localStorage.getItem("cov.dev") === "1"; } catch (e) { /* storage blocked */ }
  function setDev(v) { showDev = v; try { localStorage.setItem("cov.dev", v ? "1" : "0"); } catch (e) { /* ignore */ } }

  function setPage(title, ...content) {
    document.title = title ? title + " · Codex of Verra" : "Codex of Verra";
    main.replaceChildren(h("div", { class: "page" }, content));
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ——— charts (XP pages) ———
  function chartWidth() {
    const w = (main.clientWidth || 700) - (window.innerWidth >= 900 ? 96 : 32);
    return Math.max(300, Math.min(760, w));
  }
  function niceStep(max, n) {
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function compact(v) {
    if (Math.abs(v) >= 1e6) return nf.format(+(v / 1e6).toFixed(1)) + "M";
    if (Math.abs(v) >= 1e3) return nf.format(+(v / 1e3).toFixed(1)) + "k";
    return nf.format(v);
  }
  function lineChart(points, opts) {
    opts = opts || {};
    const W = chartWidth(), H = opts.height || (W < 480 ? 220 : 260), L = W < 480 ? 46 : 56, R = 12, T = 14, B = 34;
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), yMax = Math.max(...ys, 0) || 1;
    const step = niceStep(yMax, 4), yTop = Math.ceil(yMax / step) * step;
    const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (y) => T + (1 - y / yTop) * (H - T - B);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": opts.label || "Chart" });
    for (let y = 0; y <= yTop + 1e-9; y += step) {
      svg.append(s("line", { x1: L, x2: W - R, y1: Y(y), y2: Y(y), class: "grid" }));
      const t = s("text", { x: L - 8, y: Y(y) + 4, "text-anchor": "end", class: "axis-label" }); t.textContent = compact(y); svg.append(t);
    }
    const xStep = Math.max(1, Math.ceil((x1 - x0) / (W < 480 ? 6 : 10)));
    for (let x = x0; x <= x1; x += xStep) {
      const t = s("text", { x: X(x), y: H - 10, "text-anchor": "middle", class: "axis-label" }); t.textContent = fmt(x); svg.append(t);
    }
    const d = points.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
    svg.append(s("path", { d: d + ` L${X(x1)} ${Y(0)} L${X(x0)} ${Y(0)} Z`, class: "area" }), s("path", { d, class: "line" }));
    const readout = h("p", { class: "readout", "aria-live": "polite" }, "Hover or tap a point to read its value.");
    const dots = points.map((p) => {
      const c = s("circle", { cx: X(p[0]), cy: Y(p[1]), r: points.length > 30 ? 3.5 : 5, class: "dot", tabindex: 0 });
      const show = () => { dots.forEach((o) => o.classList.remove("on")); c.classList.add("on"); readout.replaceChildren(...opts.describe(p[0], p[1])); };
      ["mouseenter", "focus", "click"].forEach((e) => c.addEventListener(e, show)); svg.append(c); return c;
    });
    return h("figure", { class: "fig" }, svg, readout);
  }
  function barChart(points, opts) {
    const W = chartWidth(), H = 220, L = 40, R = 12, T = 14, B = 34;
    const yMax = Math.max(...points.map((p) => p[1]), 1) * 1.1, bw = (W - L - R) / points.length;
    const Y = (y) => T + (1 - y / yMax) * (H - T - B);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": opts.label });
    for (let y = 0; y <= yMax; y += niceStep(yMax, 4)) {
      svg.append(s("line", { x1: L, x2: W - R, y1: Y(y), y2: Y(y), class: "grid" }));
      const t = s("text", { x: L - 8, y: Y(y) + 4, "text-anchor": "end", class: "axis-label" }); t.textContent = fmt(+y.toFixed(2)); svg.append(t);
    }
    const readout = h("p", { class: "readout", "aria-live": "polite" }, "Tap a bar to read its value.");
    const bars = points.map((p, i) => {
      const x = L + i * bw;
      const r = s("rect", { x: x + bw * 0.15, width: bw * 0.7, y: Y(p[1]), height: Math.max(0, Y(0) - Y(p[1])), class: "bar", tabindex: 0 });
      const show = () => { bars.forEach((o) => o.classList.remove("on")); r.classList.add("on"); readout.replaceChildren(...opts.describe(p[0], p[1])); };
      ["mouseenter", "focus", "click"].forEach((e) => r.addEventListener(e, show)); svg.append(r);
      if (bw >= 22 || i % 2 === 0) { const t = s("text", { x: x + bw / 2, y: H - 10, "text-anchor": "middle", class: "axis-label" }); t.textContent = fmt(p[0]); svg.append(t); }
      return r;
    });
    svg.append(s("line", { x1: L, x2: W - R, y1: Y(1), y2: Y(1), class: "base" }));
    return h("figure", { class: "fig" }, svg, readout);
  }
  function table(head, rows, right) {
    return h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, head.map((c, i) => h("th", { class: right && right.includes(i) ? "r" : null, scope: "col" }, c)))),
      h("tbody", null, rows.map((r) => h("tr", { class: r.cls || null }, (r.cells || r).map((c, i) => h("td", { class: right && right.includes(i) ? "r" : null }, c)))))));
  }

  // ——— shell ———
  function buildNav() {
    const groups = [["Classes & skills", [["classes", "Classes"], ["skills", "Skill trees"], ["xp", "Experience"], ["improvements", "Possible Improvements"]]],
      ["Coming soon", ["items", "creatures", "recipes", "loot", "quests", "places", "abilities", "effects", "lore", "formulas"]]];
    const has = (id) => Array.isArray(id) || INDEX.sections.some((x) => x.id === id);
    nav.replaceChildren(
      link("", "Home"),
      ...groups.map(([g, ids]) => [h("span", { class: "nav-group" }, g),
        ids.filter(has).map((id) => Array.isArray(id) ? link(id[0], id[1]) : h("span", { class: "nav-soon", title: "Coming soon" }, section(id).title))]).flat(2));
  }
  function markNav(route) {
    nav.querySelectorAll("a").forEach((a) => {
      const r = a.getAttribute("href").slice(2);
      const on = r === "" ? route === "" : route === r || route.startsWith(r + "/") || (r.startsWith("db/") && route.startsWith(r.slice(3) + "/"));
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  // ——— home ———
  async function pageHome() {
    const total = INDEX.sections.reduce((a, b) => a + b.count, 0);
    const search = h("input", { type: "search", id: "home-search", placeholder: "Search opens soon", "aria-label": "Search the codex", disabled: true });
    setPage("",
      h("section", { class: "hero" },
        h("p", { class: "hero-kicker" }, "A field guide to the world of Verra"),
        h("h1", null, "Codex of Verra"),
        h("p", { class: "lede" }, "Items, creatures, recipes, loot tables and game formulas, read straight from the Ashes of Creation design data."),
        h("div", { class: "wip", role: "status" }, h("b", null, "Work in progress."), " The codex is being built. More information will appear here soon."),
        h("div", { class: "hero-search" }, search, h("button", { type: "button", class: "btn", disabled: true }, "Search")),
        h("p", { class: "meta" }, fmt(total) + " entries · " + INDEX.source)),
      h("ul", { class: "cards" },
        h("li", null, h("a", { href: "#/classes", class: "card" },
          h("span", { class: "card-title" }, "Classes"), h("span", { class: "card-count" }, "8"), h("span", { class: "card-blurb" }, "Tank, Fighter, Rogue, Ranger, Mage, Cleric, Summoner and Bard with their abilities."))),
        h("li", null, h("a", { href: "#/skills", class: "card" },
          h("span", { class: "card-title" }, "Skill trees"), h("span", { class: "card-count" }, "23"), h("span", { class: "card-blurb" }, "Archetype, weapon and stamina trees in the in-game style. Plan a build and share it."))),
        h("li", null, h("a", { href: "#/improvements", class: "card" }, h("span", { class: "card-title" }, "Possible Improvements"), h("span", { class: "card-blurb" }, "Independent community proposals for expanding Verra. Explore Guild Championships."))),
        INDEX.xp ? h("li", null, h("a", { href: "#/xp", class: "card" },
          h("span", { class: "card-title" }, "Experience"), h("span", { class: "card-count" }, "XP"), h("span", { class: "card-blurb" }, "Experience curves for character, artisan skills, weapons and guilds."))) : null,
        INDEX.sections.map((x) => h("li", null, h("div", { class: "card soon", "aria-disabled": "true" },
          h("span", { class: "card-title" }, x.title), h("span", { class: "card-count" }, "Soon"), h("span", { class: "card-blurb" }, x.blurb))))),
      h("section", { class: "notes" },
        h("h2", null, "About this data"),
        h("p", null, "Everything here comes from the design-data cache that shipped with the last Early Access client (January 2026). Drop sources are shown where the data links them: quests, recipes, gathering, events, containers, zones, points of interest and some creatures."),
        h("p", null, "Most creature-specific loot tables are not linked to their creatures in the client data, so creature drops are incomplete until we confirm them in game. Legacy and test records are hidden by default; turn them on in any list.")),
      h("footer", { class: "foot" }, "Codex of Verra is an independent, non-commercial fan project. It is not affiliated with or endorsed by Intrepid Studios. Ashes of Creation is a trademark of its owner."));
  }

  // ——— lists ———
  function listView(rows, opts) {
    const ul = h("ul", { class: opts.icons ? "records with-ic" : "records" });
    const counter = h("span", { class: "count", "aria-live": "polite" });
    const q = h("input", { type: "search", id: "list-search", placeholder: opts.placeholder || "Filter by name or internal name", "aria-label": "Filter", value: opts.q || "" });
    const dev = h("input", { type: "checkbox", id: "list-dev", checked: showDev });
    const onlySrc = opts.hasSourceLabel ? h("input", { type: "checkbox", id: "list-src" }) : null;
    const render = () => {
      const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = rows.filter((r) => (dev.checked || !r.d) && (!onlySrc || !onlySrc.checked || r.o) &&
        words.every((w) => (r.n || "").toLowerCase().includes(w) || (r.q || "").includes(w) || (r.s || "").toLowerCase().includes(w)));
      const shown = hits.slice(0, 400);
      ul.replaceChildren(...(shown.length ? shown.map((r) => h("li", null, h("a", { href: "#/" + (r.sec || opts.sec) + "/" + encodeURIComponent(r.id), class: r.d ? "dev" : null },
        h("span", { class: "name" }, opts.icons ? (r.ic ? icon(r.ic) : h("span", { class: "ic none", "aria-hidden": "true" })) : null, h("span", null, r.n || "Unnamed")), r.d ? h("span", { class: "tag" }, "legacy/test") : null,
        h("span", { class: "sub" }, (r.secTitle ? r.secTitle + " · " : "") + (r.s || "")))))
        : [h("li", { class: "empty" }, "Nothing matches. Try part of a name, an internal name like Gear_Armor, or turn on legacy entries.")]));
      counter.textContent = fmt(hits.length) + (hits.length > shown.length ? " found, first " + shown.length + " shown" : " found");
    };
    q.addEventListener("input", render);
    dev.addEventListener("change", () => { setDev(dev.checked); render(); });
    if (onlySrc) onlySrc.addEventListener("change", render);
    render();
    return [h("div", { class: "filters" }, q,
      h("label", { class: "check" }, dev, " Show legacy & test"),
      onlySrc ? h("label", { class: "check" }, onlySrc, " " + opts.hasSourceLabel) : null, counter), ul];
  }
  async function pageList(sec, q) {
    const meta = section(sec);
    if (!INDEX.sections.some((x) => x.id === sec)) return pageMissing();
    const rows = await load(sec + ".json");
    const extra = { items: "Has a known source", creatures: "Has known loot", places: "Has drops" }[sec];
    setPage(meta.title, h("p", { class: "crumbs" }, link("", "Codex")), h("h1", null, meta.title), h("p", { class: "lede small" }, meta.blurb),
      listView(rows, { sec: "db/" + sec, q, hasSourceLabel: extra, icons: ["items", "abilities", "effects", "recipes"].includes(sec) }));
  }
  async function pageSearch(q) {
    const all = await Promise.all(INDEX.sections.map((x) => load(x.id + ".json").then((rows) => rows.map((r) => ({ ...r, sec: "db/" + x.id, secTitle: x.title })))));
    setPage("Search", h("p", { class: "crumbs" }, link("", "Codex")), h("h1", null, "Search"), listView(all.flat(), { q, placeholder: "Search everything", icons: true }));
  }

  // ——— record pages ———
  const dl = (pairs) => h("dl", { class: "facts" }, pairs.filter((p) => p[1] != null && p[1] !== "").map(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  const mono = (t) => h("span", { class: "mono" }, t);
  // Ability texts carry tokens like $hit1$ or $effect:Status_Riled$ that the game fills in.
  function phKind(t) {
    t = t.toLowerCase();
    if (t.startsWith("cd")) return "cooldown";
    if (t.startsWith("charges")) return "charges";
    if (t.includes("dur")) return "duration";
    if (t.includes("tick")) return "per tick";
    if (t.includes("statmod")) return "stat bonus";
    if (t.includes("apply") || t.startsWith("effect")) return "effect";
    if (/^(hit|linger|init)/.test(t)) return "amount";
    return "value";
  }
  const ph = (kind, tok) => h("span", { class: "ph", title: "Filled in by the game: " + tok + " (not decoded yet)" }, kind);
  function segNodes(segs) {
    return segs.map((x) => typeof x === "string" ? x
      : x.v ? h("span", { class: /healing/.test(x.v) ? "num heal" : "num" }, x.v)
      : x.e ? link("db/effects/" + x.e, x.n, "fx")
      : x.p ? ph(x.p, x.t) : h("span", { class: "fx" }, x.n));
  }
  function descText(text) {
    const out = []; let pos = 0; const re = /\$([^$\s]{1,80})\$/g; let m;
    while ((m = re.exec(text))) {
      if (m.index > pos) out.push(text.slice(pos, m.index));
      const em = /^effect:([A-Za-z0-9_]+)/i.exec(m[1]);
      out.push(em ? { n: em[1].replace(/^Status_/, "").replace(/_/g, " ") } : { p: phKind(m[1]), t: m[1] });
      pos = m.index + m[0].length;
    }
    if (pos < text.length) out.push(text.slice(pos));
    return segNodes(out);
  }
  function header(sec, d, sub) {
    return [h("p", { class: "crumbs" }, link("", "Codex"), " / ", link("db/" + sec, section(sec).title)),
      d.ic ? h("div", { class: "title-row" }, icon(d.ic, "big"), h("h1", null, d.title || d.name || "Unnamed")) : h("h1", null, d.title || d.name || "Unnamed"), d.dev ? h("p", { class: "warn" }, "Legacy or test record. It may not exist in the live game.") : null,
      sub ? h("p", { class: "sub-head" }, sub) : null,
      d.description ? h("p", { class: "desc" }, d.x ? segNodes(d.x) : sec === "abilities" || sec === "effects" ? descText(d.description) : d.description) : null,
      (d.more || []).filter(Boolean).length ? h("div", { class: "more" }, d.more.filter(Boolean).map((t) => h("p", null, t))) : null];
  }
  const linkList = (items, empty) => items && items.length
    ? h("ul", { class: "chips" }, items.map((i) => h("li", null, i.link ? link(i.link.replace(/^(\w+)\//, "db/$1/"), [icon(i.ic, "sm"), i.name || "Unnamed"]) : i.name)))
    : h("p", { class: "muted" }, empty);
  const tableLinks = (names) => names && names.length ? h("p", { class: "small muted" }, "Loot tables: ", names.map((n, i) => [i ? ", " : "", h("a", { href: "#/search?q=" + encodeURIComponent(n) }, n)])) : null;

  function sourcesBlock(d) {
    const vis = d.sources.filter((x) => showDev || !x.d);
    if (!vis.length) return h("p", { class: "muted" }, d.sources.length ? "Only legacy or test sources. Turn on legacy entries in a list to see them." : "No source is linked in the client data. It may come from a creature whose loot link is not shipped with the client.");
    const groups = {};
    vis.forEach((x) => (groups[x.kind] = groups[x.kind] || []).push(x));
    return h("div", { class: "sources" }, Object.entries(groups).map(([k, arr]) => h("details", { class: "src-group", open: arr.length <= 12 },
      h("summary", null, h("span", null, k), h("span", { class: "count" }, arr.length)),
      h("ul", { class: "src-list" }, arr.map((x) => h("li", null,
        h("div", { class: "src-name" }, x.link ? link(x.link.replace(/^(\w+)\//, "db/$1/"), x.name || x.internal) : (x.name || x.internal), x.qty && x.qty !== "1" ? h("span", { class: "qty" }, "× " + x.qty) : null),
        x.path ? h("ol", { class: "path" }, x.path.map((p) => h("li", null, mono(p.table), p.rule ? h("span", { class: "rule" }, p.rule) : null, p.notes.map((n) => h("span", { class: "note" }, n))))) : null))))),
      d.sources_total > d.sources.length ? h("p", { class: "small muted" }, "Showing " + d.sources.length + " of " + d.sources_total + " sources.") : null);
  }

  const renderers = {
    items: (d) => [header("items", d, d.internal),
      h("h2", null, "Obtained from"), sourcesBlock(d),
      d.contains.length ? [h("h2", null, "Contains"), linkList(d.contains), tableLinks(d.contains_tables)] : null,
      h("h2", null, "Record"), dl([["Internal name", mono(d.internal)], ["GUID", mono(d.guid)]])],
    creatures: (d) => [header("creatures", d),
      h("h2", null, "Known loot"), linkList(d.loot, "No loot is linked to this creature in the client data."), tableLinks(d.loot_tables),
      h("h2", null, "Spawn and definition records"), h("ul", { class: "plain mono small" }, d.internal_names.map((n) => h("li", null, n))),
      d.internal_total > d.internal_names.length ? h("p", { class: "small muted" }, d.internal_total + " records in total.") : null],
    recipes: (d) => [header("recipes", d, d.internal), h("h2", null, "Produces"), linkList(d.outputs, "No output items."), tableLinks(d.loot_tables),
      h("p", { class: "small muted" }, "Ingredients and station requirements are not decoded yet.")],
    quests: (d) => [header("quests", d, d.internal), h("h2", null, "Item rewards"), linkList(d.rewards, "No item rewards are linked."), tableLinks(d.reward_tables)],
    places: (d) => [header("places", d, d.kind + " · " + d.internal), h("h2", null, "Drops in this area"), linkList(d.loot, "No area-wide drops."), tableLinks(d.loot_tables)],
    abilities: (d) => {
      const cls = CLASS_OF[(d.internal || "").split("_")[0]];
      return [header("abilities", d, d.internal),
        cls ? h("p", null, h("span", { class: "tag" }, "Class"), " ", link("classes/" + cls[0], cls[1])) : null,
        d.st ? [statLine(d.st), d.st.m != null ? levelPicker() : null] : null,
        /\$[^$\s]+\$/.test(d.description || "") ? h("p", { class: "small muted" }, "Dotted labels mark numbers and effects the game fills in. They are not decoded yet.") : null];
    },
    effects: (d) => [header("effects", d, d.internal)],
    lore: (d) => [header("lore", d, d.internal)],
    formulas: (d) => [header("formulas", d), h("pre", { class: "code" }, d.expression || "—")],
    loot: (d) => [header("loot", { ...d, title: d.name }, "Loot table"), lootTree(d), h("h2", null, "Used by"),
      d.used_by.length ? h("ul", { class: "src-list" }, d.used_by.map((x) => h("li", null, h("span", { class: "tag" }, x.kind), " ", x.link ? link(x.link.replace(/^(\w+)\//, "db/$1/"), x.name || x.internal) : (x.name || x.internal))))
        : h("p", { class: "muted" }, "Nothing references this table directly. It is either a subtable of another table or assigned by a rule that is not in the client data.")],
  };

  function lootTree(t) {
    const kids = [];
    if (t.predicate) kids.push(h("p", { class: "cond" }, "Only if ", mono(t.predicate)));
    (t.containers || []).forEach((c, ci) => {
      const total = (c.weights || []).reduce((a, b) => a + b, 0);
      kids.push(h("div", { class: "roll" }, h("h3", null, "Roll " + (ci + 1), h("span", { class: "rule" }, c.selection), c.number_to_select ? h("span", { class: "note" }, "pick " + c.number_to_select) : null),
        c.predicate ? h("p", { class: "cond" }, "Only if ", mono(c.predicate)) : null,
        h("ul", { class: "rewards" }, c.rewards.map((r, i) => h("li", null,
          (r.items || []).map((it) => h("div", null, link("db/items/" + it.item.guid, [icon(it.item.ic, "sm"), it.item.item || it.item.internal_name || it.item.guid]), h("span", { class: "qty" }, "× " + it.quantity))),
          (r.currency || []).map((cu) => h("div", null, "Currency ", h("span", { class: "qty" }, cu.amount))),
          (r.experience || []).map((x) => h("div", { class: "muted" }, x.type + " XP ", h("span", { class: "qty" }, x.value))),
          c.weights && c.weights[i] != null ? h("span", { class: "note" }, "weight " + c.weights[i] + "/" + total) : null,
          c.drop_percent && c.drop_percent[i] ? h("span", { class: "note" }, "chance " + c.drop_percent[i]) : null,
          c.weight_expressions && c.weight_expressions[i] ? h("span", { class: "note" }, "weight " + c.weight_expressions[i]) : null)))));
    });
    const st = t.subtables;
    if (st) {
      const total = (st.weights || []).reduce((a, b) => a + b, 0);
      kids.push(h("div", { class: "roll" }, h("h3", null, "Subtables", h("span", { class: "rule" }, st.selection), st.number_to_select ? h("span", { class: "note" }, "pick " + st.number_to_select) : null),
        h("ul", { class: "rewards" }, st.tables.map((x, i) => h("li", null, h("a", { href: "#/db/loot/" + x.guid }, x.loot_table || x.guid),
          st.weights && st.weights[i] != null ? h("span", { class: "note" }, "weight " + st.weights[i] + "/" + total) : null,
          st.percent && st.percent[i] ? h("span", { class: "note" }, "chance " + st.percent[i]) : null,
          st.weight_expressions && st.weight_expressions[i] ? h("span", { class: "note" }, "weight " + st.weight_expressions[i]) : null)))));
    }
    return h("div", { class: "tree" }, kids.length ? kids : h("p", { class: "muted" }, "This table grants nothing by itself."));
  }

  // Records are packed into shards; the shard is crc32(id) % shards, same as tools/build_site.py.
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(str) {
    const bytes = new TextEncoder().encode(str); let c = 0xffffffff;
    for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function pageRecord(sec, id) {
    if (!renderers[sec]) return pageMissing();
    if (sec === "abilities" && !CURVE) { try { CURVE = (await load("classes.json")).mana_curve; } catch (e) { /* optional */ } }
    const n = section(sec).shards || 1;
    const shard = await load(sec + "/" + (crc32(String(id)) % n) + ".json");
    const d = shard[id];
    if (!d) return pageMissing();
    setPage(d.title || d.name, renderers[sec](d));
  }

  // ——— ability numbers ———
  let LEVEL = 50;
  try { LEVEL = Math.min(50, Math.max(1, parseInt(localStorage.getItem("cov.level") || "50", 10) || 50)); } catch (e) { /* storage blocked */ }
  let CURVE = null;
  const secs = (v) => v >= 60 ? (Math.floor(v / 60) + " m" + (v % 60 ? " " + fmt(+(v % 60).toFixed(2)) + " s" : "")) : fmt(v) + " s";
  const manaAt = (base, lvl) => CURVE && CURVE[lvl - 1] != null ? Math.ceil(base * CURVE[lvl - 1] / 32) : null;
  function statLine(st) {
    if (!st) return null;
    const parts = [];
    if (st.m != null) {
      const v = manaAt(st.m, LEVEL);
      parts.push(h("span", { class: "stat mana", "data-base": st.m }, h("b", null, v != null ? v : "?"), " mana"));
    }
    if (st.cd) parts.push(h("span", { class: "stat" }, h("b", null, secs(st.cd)), " cooldown"));
    if (st.ch) parts.push(h("span", { class: "stat" }, h("b", null, String(st.ch)), " charges"));
    if (st.r) parts.push(h("span", { class: "stat" }, h("b", null, fmt(st.r) + " m"), " range"));
    return parts.length ? h("p", { class: "stats" }, parts) : null;
  }
  function levelPicker(onChange) {
    const out = h("output", { for: "lvl" }, String(LEVEL));
    const inp = h("input", { type: "range", id: "lvl", min: 1, max: 50, step: 1, value: LEVEL, "aria-label": "Character level" });
    inp.addEventListener("input", () => {
      LEVEL = +inp.value; out.textContent = String(LEVEL);
      try { localStorage.setItem("cov.level", String(LEVEL)); } catch (e) { /* ignore */ }
      document.querySelectorAll(".stat.mana").forEach((el) => { el.firstChild.textContent = manaAt(+el.dataset.base, LEVEL); });
      if (onChange) onChange();
    });
    return h("div", { class: "level-pick" }, h("label", { for: "lvl" }, "Character level"), inp, out,
      h("span", { class: "small muted" }, "Mana cost scales with level."));
  }

  // ——— classes ———
  const CLASS_OF = { Tank: ["tank", "Tank"], "Tank-A1": ["tank", "Tank"], TankOld: ["tank", "Tank"], Fighter: ["fighter", "Fighter"],
    Rogue: ["rogue", "Rogue"], "Rogue-old": ["rogue", "Rogue"], Ranger: ["ranger", "Ranger"], "Ranger-Old": ["ranger", "Ranger"], "Ranger-old": ["ranger", "Ranger"],
    Mage: ["mage", "Mage"], "Mage-A1": ["mage", "Mage"], Cleric: ["cleric", "Cleric"], "Cleric-A1": ["cleric", "Cleric"], ClericOld: ["cleric", "Cleric"],
    Summoner: ["summoner", "Summoner"], Bard: ["bard", "Bard"] };
  function abilityCards(list) {
    return h("ul", { class: "abil" }, list.map((a) => h("li", null,
      h("h3", null, link("db/abilities/" + a.id, [icon(a.ic, "sm"), a.n])),
      statLine(a.st),
      a.x ? h("p", { class: "desc" }, segNodes(a.x)) : h("p", { class: "muted small" }, "No description in the data."),
      a.v ? h("p", { class: "small muted" }, "Other versions: ", a.v.map((id, i) => [i ? ", " : "", link("db/abilities/" + id, "#" + (i + 2))])) : null)));
  }
  async function pageClasses(id) {
    const C = await load("classes.json");
    CURVE = C.mana_curve || CURVE;
    const all = [...C.classes, ...C.kinds];
    const crumbs = h("p", { class: "crumbs" }, link("", "Codex"), id ? [" / ", link("classes", "Classes")] : null);
    const switcher = h("nav", { class: "tabs", "aria-label": "Classes" }, C.classes.map((c) => h("a", { href: "#/classes/" + c.id, "aria-current": c.id === id ? "page" : null }, c.name)));
    if (!id) {
      const card = (c, n) => h("li", null, h("a", { href: "#/classes/" + c.id, class: "card" },
        h("span", { class: "card-title" }, c.name), h("span", { class: "card-count" }, fmt(n)), h("span", { class: "card-blurb" }, c.blurb)));
      return setPage("Classes", crumbs, h("h1", null, "Classes"),
        h("p", { class: "lede small" }, "The eight archetypes and their abilities as they stood in the January 2026 build. Older Alpha versions are kept on each class page."),
        h("ul", { class: "cards" }, C.classes.map((c) => card(c, c.abilities.length))));
    }
    const c = C.classes.find((x) => x.id === id);
    if (!c) return pageMissing();
    const isClass = C.classes.includes(c);
    let body;
    if (c.families) body = c.families.map((f) => h("details", { class: "src-group" },
      h("summary", null, h("span", null, f.family), h("span", { class: "count" }, f.abilities.length)), abilityCards(f.abilities)));
    else body = [abilityCards(c.abilities),
      c.legacy.length ? h("details", { class: "src-group legacy" },
        h("summary", null, h("span", null, isClass ? "Alpha and older versions" : "Older versions"), h("span", { class: "count" }, c.legacy.length)),
        h("p", { class: "small muted" }, "Earlier designs of this kit. They may not exist in the live game."), abilityCards(c.legacy)) : null];
    setPage(c.name, crumbs, h("h1", null, c.name), isClass ? switcher : null, h("p", { class: "lede small" }, c.blurb),
      isClass ? levelPicker() : null,
      h("p", { class: "small muted" }, "Numbers come from the design data. Cast times are not in it yet; dotted labels mark values still being decoded."), body);
  }

  // ——— skill trees (in-game style panel) ———
  const STEP = 52, ROWH = 64, PADX = 34, PADY = 34, TIERGAP = 18;
  function tipBody(d) {
    const kids = [];
    const st = d.st;
    if (st) {
      const left = [], right = [];
      if (st.m != null) left.push(h("div", { class: "tt-mana" }, h("span", { class: "stat mana", "data-base": st.m }, manaAt(st.m, LEVEL)), " Mana"));
      if (st.r) left.push(h("div", null, fmt(st.r) + "m Range"));
      if (st.cd) right.push(h("div", null, secs(st.cd).replace(/ /g, "") + " cooldown"));
      if (st.ch) right.push(h("div", null, String(st.ch) + " Charges"));
      if (left.length || right.length) kids.push(h("div", { class: "tt-stats" }, h("div", null, left), h("div", { class: "tt-right" }, right)));
    }
    if (d.x) kids.push(h("p", { class: "tt-desc" }, segNodes(d.x)));
    return kids;
  }
  function costLine(d) {
    return d.c || d.pt ? h("div", { class: "tt-cost" }, "Cost: " + (d.c || 1) + " ", h("span", { class: "pt-sq" }), " " + ((d.c || 1) > 1 ? (d.pt || "Skill Pt.").replace(/Pt\.$/, "Pts.") : (d.pt || "Skill Pt."))) : null;
  }
  async function pageSkills(id) {
    const idx = await load("trees.json");
    const list = idx.trees;
    id = list.some((t) => t.id === id) ? id : "fighter";
    const T = await load("trees/" + id + ".json");
    try { CURVE = CURVE || (await load("classes.json")).mana_curve; } catch (e) { /* optional */ }
    const N = T.nodes;
    // build state from the address: ?b=3.5.7c1
    const params = new URLSearchParams((location.hash.split("?")[1]) || "");
    const learned = new Set(), chosen = new Map();
    (params.get("b") || "").split(".").filter(Boolean).forEach((t) => {
      const m = /^(\d+)(?:c(\d+))?$/.exec(t); if (!m || !N[+m[1]]) return;
      learned.add(+m[1]); if (m[2] != null) chosen.set(+m[1], +m[2]);
    });
    const kids = N.map(() => []);
    N.forEach((d, k) => (d.pre || []).forEach((p) => kids[p] && kids[p].push(k)));
    const avail = (k) => (N[k].pre || []).every((p) => learned.has(p));
    const cost = (k) => { const d = N[k].k === "c" && chosen.has(k) ? N[k].opts[chosen.get(k)] : N[k]; return d.c || N[k].c || 1; };
    const ptName = N.find((d) => d.pt) ? N.find((d) => d.pt).pt.replace(/ Pt\.$/, "") : "Skill";
    const unlearn = (k) => { learned.delete(k); chosen.delete(k); kids[k].forEach((c) => learned.has(c) && unlearn(c)); };
    const view = (k) => (N[k].k === "c" && chosen.has(k) ? N[k].opts[chosen.get(k)] : N[k]);

    const group = T.group;
    const tabs = h("div", { class: "st-tabs", role: "tablist" }, ["Archetype", "Weapon", "Stamina"].map((g) => {
      const first = list.find((t) => t.group === g);
      return h("a", { href: "#/skills/" + (g === group ? id : first.id), class: "st-tab", "aria-current": g === group ? "page" : null }, g, g === "Archetype" ? h("span", { class: "st-dia" }, "◆") : null);
    }), h("span", { class: "st-tab off", title: "Coming soon" }, "Skill Book"));
    const subs = group === "Stamina" ? null : h("div", { class: "st-sub" }, list.filter((t) => t.group === group).map((t) =>
      h("a", { href: "#/skills/" + t.id, class: "st-chip", "aria-current": t.id === id ? "page" : null }, icon(t.ic, "sm"), t.name)));
    // geometry: screenshot-led layouts for Cleric, Bard and Summoner.
    // Other archetypes retain their source-data rows until their visual positions are verified.
    const screenshotLayout = {
      cleric: {
        0:[226,86],1:[266,86],2:[306,86],4:[226,158],5:[266,158],7:[306,158],
        9:[226,230],16:[266,230],17:[306,230],18:[346,230],31:[386,230],
        21:[145,86],20:[145,158],22:[145,230],28:[145,302],
        3:[226,302],8:[266,302],11:[306,302],12:[346,302],13:[386,302],14:[426,302],19:[466,302],
        23:[226,374],30:[266,374],25:[306,374],26:[346,374],27:[386,374],
        6:[266,446],10:[306,446],15:[346,446],29:[386,446],24:[426,446]
      },
      bard: {
        0:[155,104],16:[196,104],23:[237,104],29:[278,104],31:[319,104],42:[360,104],43:[401,104],44:[442,104],
        32:[155,160],36:[237,160],1:[278,160],2:[319,160],3:[360,160],4:[401,160],5:[442,160],
        6:[155,232],7:[196,232],9:[237,232],11:[278,232],12:[319,232],13:[360,232],24:[401,232],
        38:[196,284],41:[319,284],37:[360,284],
        8:[155,356],10:[196,356],14:[237,356],15:[278,356],25:[319,356],26:[360,356],27:[401,356],35:[442,356],
        17:[110,428],18:[151,428],19:[192,428],20:[233,428],21:[274,428],22:[315,428],28:[356,428],30:[397,428],33:[438,428],34:[479,428],39:[520,428],40:[561,428]
      },
      summoner: {
        0:[195,34],1:[236,34],2:[277,34],3:[318,34],4:[359,34],5:[400,34],9:[441,34],17:[482,34],19:[523,34],
        22:[154,92],23:[195,92],24:[236,92],25:[277,92],26:[318,92],27:[359,92],28:[400,92],29:[441,92],30:[482,92],
        31:[154,150],32:[195,150],33:[236,150],34:[277,150],35:[318,150],36:[359,150],37:[400,150],38:[441,150],39:[482,150],
        52:[523,150],40:[236,208],41:[318,208],43:[400,208],
        10:[154,266],12:[195,266],13:[236,266],14:[277,266],15:[318,266],16:[359,266],20:[400,266],44:[441,266],45:[482,266],46:[523,266],
        51:[236,324],53:[400,324],50:[154,324],49:[318,324],42:[482,324],
        6:[154,382],7:[195,382],8:[236,382],11:[277,382],18:[318,382],21:[359,382],
        48:[236,440],47:[400,440]
      }
    };
    let y = PADY, prevT = null, maxX = 0;
    const place = {}, tiers = [];
    T.rows.forEach((r) => {
      if (prevT !== null && r.t !== prevT) { y += TIERGAP; tiers.push(y - TIERGAP / 2 - ROWH / 2 + 4); }
      r.nodes.forEach(([k, x]) => { place[k] = [PADX + x * STEP, y]; maxX = Math.max(maxX, x); });
      y += ROWH; prevT = r.t;
    });
    if (screenshotLayout[id]) Object.entries(screenshotLayout[id]).forEach(([k, xy]) => { if (N[+k]) place[+k] = xy; });
    const coords = Object.values(place);
    const W = screenshotLayout[id] ? Math.max(620, ...coords.map((p) => p[0] + 45)) : PADX * 2 + maxX * STEP;
    const H = screenshotLayout[id] ? Math.max(505, ...coords.map((p) => p[1] + 45)) : y - ROWH + PADY + 10;
    const svg = s("svg", { class: "st-lines", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
    const defs = s("defs"); const mk = s("marker", { id: "st-arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" });
    mk.append(s("path", { d: "M0 0 L10 5 L0 10 z", class: "st-arrowhead" })); defs.append(mk); svg.append(defs);
    const edges = [];
    N.forEach((d, k) => (d.pre || []).forEach((p) => {
      if (!place[p] || !place[k]) return;
      const [x1, y1] = place[p], [x2, y2] = place[k];
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, r1 = 22, r2 = 23;
      const ln = s("line", { x1: x1 + dx / len * r1, y1: y1 + dy / len * r1, x2: x2 - dx / len * r2, y2: y2 - dy / len * r2, class: "st-edge", "marker-end": "url(#st-arrow)" });
      edges.push([p, ln]); svg.append(ln);
    }));
    const tierMarks = screenshotLayout[id] ? [] : tiers.map((ty) => h("div", { class: "st-tier", style: `top:${ty}px` }));
    // tooltip
    let pinned = null;
    const tipHost = h("div", { class: "st-tiphost" });
    const hoverable = () => window.matchMedia("(hover: hover)").matches && window.innerWidth >= 700;
    function tooltip(k) {
      const d = N[k], v = view(k);
      const isL = learned.has(k), ok = avail(k);
      const action = !ok ? h("div", { class: "tt-hint warn" }, "Requires: " + d.pre.filter((p) => !learned.has(p)).map((p) => view(p).n).join(", "))
        : d.k === "c" && !isL ? h("div", { class: "tt-hint" }, "Choose one option to learn it.")
        : h("div", { class: "tt-actions" }, h("button", { type: "button", class: "tt-btn", onclick: (e) => { e.stopPropagation(); toggle(k); } }, isL ? "Unlearn" : "Learn"),
            hoverable() ? h("span", { class: "tt-hint" }, "or click the node") : null);
      const opts = d.k === "c" ? d.opts.map((o, i) => h("div", { class: "tt-opt" + (chosen.get(k) === i ? " on" : "") },
        h("div", { class: "tt-opt-name" }, icon(o.ic, "sm"), o.n), tipBody(o),
        ok ? h("button", { type: "button", class: "tt-btn", onclick: (e) => { e.stopPropagation(); chosen.set(k, i); learned.add(k); refresh(); showTip(nodeEls[k], k, true); } }, chosen.get(k) === i ? "Chosen" : "Choose") : null)) : null;
      return h("div", { class: "tt", role: "tooltip" },
        h("div", { class: "tt-head" }, d.k === "c" && !chosen.has(k) ? "Choose one" : v.n),
        h("div", { class: "tt-body" }, d.k === "c" && !chosen.has(k) ? opts : [tipBody(v), d.k === "c" ? h("details", { class: "tt-more" }, h("summary", null, "Other options"), opts) : null],
          costLine(v.c ? v : d), action,
          v.l && isOpen(v.l) ? h("div", { class: "tt-link" }, link(v.l, "Open in the codex →")) : null));
    }
    function showTip(btn, k, pin) {
      tipHost.replaceChildren(tooltip(k));
      tipHost.classList.add("on");
      const narrow = !hoverable();
      tipHost.classList.toggle("dock", narrow);
      if (!narrow) {
        const box = btn.getBoundingClientRect(), wrap = stage.getBoundingClientRect();
        let left = box.right - wrap.left + 10; const tw = 330;
        if (box.right + 10 + tw > window.innerWidth - 8) left = box.left - wrap.left - 10 - tw;
        tipHost.style.left = Math.max(4, left) + "px";
        tipHost.style.top = Math.max(4, Math.min(box.top - wrap.top - 8, wrap.height - 40)) + "px";
      } else { tipHost.style.left = ""; tipHost.style.top = ""; }
      pinned = pin ? btn : null;
    }
    const hideTip = () => { tipHost.classList.remove("on"); pinned = null; };
    function toggle(k) {
      if (learned.has(k)) unlearn(k);
      else if (avail(k)) { if (N[k].k === "c" && !chosen.has(k)) { showTip(nodeEls[k], k, true); return; } learned.add(k); }
      refresh();
      if (tipHost.classList.contains("on")) showTip(nodeEls[k], k, !!pinned);
    }
    const nodeEls = N.map((d, k) => {
      if (!place[k]) return null;
      const [x, yy] = place[k];
      const b = h("button", { type: "button", class: "st-node " + (d.k === "a" ? "act" : d.k === "c" ? "choice" + (d.opts[0] && d.opts[0].k === "p" ? " pas" : "") : "pas"), style: `left:${x}px;top:${yy}px`, "aria-label": d.n });
      b.addEventListener("mouseenter", () => { if (!pinned && hoverable()) showTip(b, k); });
      b.addEventListener("mouseleave", () => { if (!pinned && hoverable()) hideTip(); });
      b.addEventListener("click", (e) => { e.stopPropagation(); if (hoverable()) toggle(k); else if (pinned === b) hideTip(); else showTip(b, k, true); });
      return b;
    });
    const spentEl = h("b"), linkBtn = h("button", { type: "button", class: "st-btn primary" }, "Confirm Choices");
    function refresh() {
      nodeEls.forEach((b, k) => {
        if (!b) return;
        const d = N[k], v = view(k), isL = learned.has(k), ok = avail(k);
        b.classList.toggle("learned", isL); b.classList.toggle("unavail", !isL && !ok);
        const showIc = d.k === "c" && !chosen.has(k) ? null : v.ic;
        b.replaceChildren(showIc ? h("img", { src: showIc, alt: "", loading: "lazy" }) : d.k === "c" ? h("span", { class: "st-plus" }) : h("span", { class: "st-noicon" }, (v.n || "?").slice(0, 1)),
          (v.c || d.c) > 1 ? h("span", { class: "st-cost" }, v.c || d.c) : null);
        b.setAttribute("aria-pressed", isL ? "true" : "false");
      });
      edges.forEach(([p, ln]) => ln.classList.toggle("on", learned.has(p)));
      let pts = 0; learned.forEach((k) => { pts += cost(k); });
      spentEl.textContent = String(pts);
      const code = [...learned].sort((a, b) => a - b).map((k) => k + (chosen.has(k) ? "c" + chosen.get(k) : "")).join(".");
      history.replaceState(null, "", "#/skills/" + id + (code ? "?b=" + code : ""));
    }
    const canvas = h("div", { class: "st-canvas", style: `width:${W}px;height:${H}px` }, svg, tierMarks, nodeEls);
    const stage = h("div", { class: "st-stage" + (T.bg ? " has-bg" : ""), style: T.bg ? `background-image:linear-gradient(90deg, rgba(8,8,12,.55) 0%, rgba(8,8,12,.25) 60%, rgba(8,8,12,0) 100%), url("${T.bg}")` : null },
      h("div", { class: "st-scroll" }, canvas), tipHost);
    stage.addEventListener("click", () => hideTip());
    tipHost.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
    const note = h("span", { class: "st-note", "aria-live": "polite" });
    linkBtn.addEventListener("click", async () => {
      const url = location.href;
      try { await navigator.clipboard.writeText(url); note.textContent = "Build link copied."; } catch (e) { note.textContent = "Copy the address bar to share this build."; }
    });
    const win = h("section", { class: "st-window", "aria-label": "Skill tree" },
      h("header", { class: "st-head" }, h("span", { class: "st-emblem", "aria-hidden": "true" }), h("span", { class: "st-title" }, "Skill Tree"), h("kbd", null, "K"),
        h("span", { class: "st-name" }, T.name)),
      tabs, subs, stage,
      h("footer", { class: "st-foot" },
        h("span", { class: "st-points" }, h("span", { class: "pt-sq big" }), " " + ptName + " Points spent: ", spentEl),
        note,
        h("span", { class: "st-actions" }, h("button", { type: "button", class: "st-btn", onclick: () => { learned.clear(); chosen.clear(); refresh(); hideTip(); } }, "Respec"), linkBtn)),
      h("div", { class: "st-level" }, levelPicker()));
    setPage(T.name + " skill tree", h("p", { class: "crumbs" }, link("", "Codex"), " / ", link("skills", "Skill trees")), h("h1", null, "Skill trees"),
      h("p", { class: "lede small" }, "Plan a build like in the game: click a node to learn it, Respec to start over, Confirm Choices to copy a link to your build. Node order and unlocks come from game data. Cleric, Bard and Summoner use screenshot-guided layouts; other trees use a source-data-based arrangement pending visual verification."),
      win);
    refresh();
  }


  // ——— community proposals (not extracted or confirmed game features) ———
  function pageImprovements(slug) {
    if (!slug) {
      setPage("Possible Improvements",
        h("h1", null, "Possible Improvements"),
        h("p", { class: "lede small" }, "Independent proposals for expanding the world of Verra. These are design concepts, not features confirmed in the game client."),
        h("article", { class: "idea-card" },
          h("h2", null, "Guild Championships"),
          h("p", null, "What if Node mayors could organize regional guild tournaments? Eight-player guild teams compete in structured PvP events, funded by city treasuries and entrance fees. Victories bring valuable resources, temporary champion mounts and lasting recognition for the host city."),
          h("a", { class: "idea-more", href: "#/improvements/guild-championships" }, "SHOW MORE →")));
      return;
    }
    if (slug !== "guild-championships") { pageMissing(); return; }
    const pages = {
      overview: [["The concept", "A developed Node's mayor can host a regional championship. Eligible guilds register one team of eight players. Events are intentionally rare, with a proposed cadence of one or two championships per month."],
        ["Participation", "Registration closes before the tournament. Rosters lock at the start. Regional eligibility, minimum guild age and independent participation requirements discourage shell guilds and staged results."],
        ["Implementation path", "Start with a single 8v8 bracket, registration, escrow and validated payouts. Expand to other modes and champion mounts after the basic event works reliably."]],
      economy: [["Funding", "The host Node contributes from its treasury and guilds pay entrance fees. Both sources are committed to escrow before registration closes."],
        ["Example fee allocation", "Illustrative only: eight guilds each pay 200 gold (1,600 gold total). Allocate 75% to prizes, 15% to the host treasury and 10% to a currency sink. The city's separate treasury contribution is additional and must be balanced independently."],
        ["Resource integrity", "Rare material rewards should come from pre-funded existing inventories, rather than unlimited newly generated resources. Define material types, grades, amounts and refund rules before implementation."]],
      formats: [["Guild Clash", "Eight versus eight. A best-of-three elimination bracket is the recommended first playable format."],
        ["King of the Hill", "Teams fight over rotating control points, with scoring based on uncontested occupation."],
        ["Capture the Banner", "Steal and deliver the opposing banner while defending your own."],
        ["Relic Run", "Recover a contested relic and deliver it to an extraction point that changes between rounds."],
        ["Caravan Breaker", "One team escorts a tournament caravan while the other intercepts it; sides swap between rounds."]],
      rewards: [["Guild rewards", "Winning guilds earn a portion of the committed resources, public recognition and temporary champion ground mounts for the winning roster. The suggested +5% mount-speed advantage remains a balance question, not a fixed rule."],
        ["City Legacy — Champion's Endurance", "After a series of successfully hosted championships, the city earns a temporary blessing: +5% Stamina Regeneration for all residents of the host Node. A working milestone is five completed championships, held approximately one or two times per month. The milestone, buff duration and reset rules remain open for balancing."],
        ["Anti-exploit requirements", "Only legitimate completed tournaments with enough independent participating guilds count toward City Legacy. Cancelled, abandoned or collusive events must not advance the milestone."]],
      technical: [["Mayor permissions and scheduling", "Which Node stages can host? Who can spend treasury funds? How do cooldowns interact with sieges and other Node events?"],
        ["Eligibility and integrity", "How are regional membership, guild age, one-team-per-guild limits, locked rosters and shell guilds validated?"],
        ["Match rules", "Are matches isolated? Which PvP flagging, corruption, death penalties, party restrictions and disconnect rules apply?"],
        ["Treasury and escrow", "When are city contributions, guild fees and materials reserved? How are cancellations, refunds and failed matches handled?"],
        ["Rewards and entitlements", "How does the server verify winners, distribute material prizes and grant, expire or revoke non-tradable champion mounts?"],
        ["City Legacy", "How is a completed legitimate championship counted? Who qualifies as a resident? Does the stamina regeneration bonus apply in PvP? How long does it last, and can it stack?"],
        ["Operations", "What are the server-performance limits, administrative recovery procedures and audit requirements?"]]
    };
    const labels = [["overview", "Overview"], ["economy", "Economy"], ["formats", "PvP Formats"], ["rewards", "Rewards"], ["technical", "Technical Considerations"]];
    const tabs = h("nav", { class: "idea-tabs", "aria-label": "Guild Championships topics" });
    const body = h("div", { class: "idea-body" });
    const choose = (key) => {
      tabs.querySelectorAll("button").forEach((b) => { b.setAttribute("aria-selected", b.dataset.tab === key ? "true" : "false"); });
      body.replaceChildren(...pages[key].map(([title, copy]) => h("section", { class: "idea-panel" }, h("h2", null, title), h("p", null, copy))));
    };
    labels.forEach(([key, label]) => { const b = h("button", { type: "button", "data-tab": key, "aria-selected": "false", onclick: () => choose(key) }, label); tabs.append(b); });
    setPage("Guild Championships",
      h("p", { class: "crumbs" }, link("", "Codex"), " / ", link("improvements", "Possible Improvements")),
      h("h1", null, "Guild Championships"),
      h("p", { class: "lede small" }, "A proposal for city-sponsored regional guild tournaments: meaningful PvP, Node economics, and long-term civic rewards."),
      h("p", { class: "meta" }, "Community design proposal · Not an existing confirmed game mechanic"),
      tabs, body);
    choose("overview");
  }

  // ——— experience ———
  async function pageXp(tab) {
    const xp = await load("xp.json");
    const tabs = [["adv", "Character"], ["mods", "Multipliers"], ["craft", "Artisan"], ["weapons", "Weapons"], ["guild", "Guild"]];
    tab = tabs.some((t) => t[0] === tab) ? tab : "adv";
    const xpLine = (l, v) => [h("b", null, "Level " + l), ": " + fmt(v) + " total XP"];
    const rowsFor = (curve, cap) => curve.filter((p) => !cap || p[0] <= cap).map((p) => {
      const n = curve.find((q) => q[0] === p[0] + 1);
      return { cells: [p[0], fmt(p[1]), cap && p[0] >= cap ? "cap" : n ? fmt(n[1] - p[1]) : "—"], cls: cap && p[0] === cap ? "cap" : null };
    });
    let body;
    const a = xp.adventuring;
    if (tab === "adv") body = [h("p", { class: "lede small" }, "Total adventuring experience needed for each level. Level cap in this build: " + a.cap + "."),
      lineChart(a.curve.filter((p) => p[0] <= a.cap), { label: "Character XP", describe: xpLine }),
      dl([["Experience debt on death", a.usesDebt ? "Yes" : "No"], ["Skill points", (a.skillPoints[1] || 0) + " per level from level 2"]]),
      table(["Level", "Total XP", "To next"], rowsFor(a.curve, a.cap), [0, 1, 2])];
    else if (tab === "mods") body = [h("h2", null, "Party size"), barChart(a.party, { label: "Party XP multiplier", describe: (x, y) => [h("b", null, x + " in party"), ": ×" + fmt(y)] }),
      h("h2", null, "Level difference to target"), barChart(a.decay, { label: "XP by level difference", describe: (x, y) => [h("b", null, (x > 0 ? "+" : "") + x), ": ×" + fmt(y)] }),
      h("h2", null, "Level spread in party"), barChart(a.disparity, { label: "XP by party level spread", describe: (x, y) => [h("b", null, "spread " + x), ": ×" + fmt(y)] })];
    else if (tab === "craft") body = [["crafting", "Crafting"], ["gathering", "Gathering"]].map(([k, n]) => [h("h2", null, n), lineChart(xp[k].curve, { label: n, describe: xpLine })]);
    else if (tab === "weapons") body = [h("p", { class: "lede small" }, "All " + xp.weapons.length + " weapon types share one curve."), lineChart(xp.weapons[0].curve, { label: "Weapon XP", describe: xpLine }),
      table(["Weapon", "Levels"], xp.weapons.map((w) => [w.name, w.curve.length]), [1])];
    else body = [lineChart(xp.guild.curve.filter((p) => p[0] >= 1), { label: "Guild XP", describe: xpLine }), table(["Level", "Total XP", "To next"], rowsFor(xp.guild.curve.filter((p) => p[0] >= 1), xp.guild.cap), [0, 1, 2])];
    setPage("Experience", h("h1", null, "Experience"), h("nav", { class: "tabs", "aria-label": "Experience types" }, tabs.map(([id, n]) => h("a", { href: "#/xp/" + id, "aria-current": id === tab ? "page" : null }, n))), body);
  }

  function pageSoon() {
    setPage("Coming soon", h("p", { class: "crumbs" }, link("", "Codex")), h("h1", null, "Coming soon"),
      h("p", { class: "lede small" }, "This part of the codex is still being checked against the game. It will open soon."),
      h("p", null, "Open now: ", link("classes", "Classes"), ", ", link("skills", "Skill trees"), " and ", link("xp", "Experience"), "."));
  }
  function pageMissing() { setPage("Not found", h("h1", null, "Page not found"), h("p", null, "Check the address or go back to the ", link("", "codex"), ".")); }

  async function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = new URLSearchParams(query || "").get("q") || "";
    markNav(parts.join("/"));
    try {
      if (!parts.length) await pageHome();
      else if (parts[0] === "search" || parts[0] === "db") pageSoon();
      else if (parts[0] === "improvements") pageImprovements(parts[1]);
      else if (parts[0] === "xp") await pageXp(parts[1]);
      else if (parts[0] === "classes") await pageClasses(parts[1]);
      else if (parts[0] === "skills") await pageSkills(parts[1]);
      else if (parts[0] === "db" && parts.length === 2) await pageList(parts[1], q);
      else if (parts[0] === "db" && parts.length === 3) await pageRecord(parts[1], parts[2]);
      else pageMissing();
    } catch (e) {
      setPage("Error", h("h1", null, "This page could not be opened"), h("p", { class: "warn" }, e.message),
        h("p", { class: "muted" }, location.protocol === "file:" ? "Open the site through a web server, for example: python3 -m http.server" : "Check that the data/ folder is built and published."));
    }
  }

  load("index.json").then((idx) => { INDEX = idx; buildNav(); window.addEventListener("hashchange", route); route(); })
    .catch((e) => main.replaceChildren(h("div", { class: "page" }, h("h1", null, "No data"), h("p", { class: "warn" }, e.message))));
})();
