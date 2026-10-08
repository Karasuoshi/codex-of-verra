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
  const link = (to, text, cls) => h("a", { href: "#/" + to, class: cls }, text);
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
    const groups = [["Database", ["items", "creatures", "recipes", "loot", "quests", "places"]], ["Combat & lore", [["skills", "Skill trees"], ["classes", "Classes"], "abilities", "effects", "lore"]], ["Rules", ["formulas"]]];
    const has = (id) => Array.isArray(id) || INDEX.sections.some((x) => x.id === id);
    nav.replaceChildren(
      link("", "Home"),
      ...groups.map(([g, ids]) => [h("span", { class: "nav-group" }, g),
        ids.filter(has).map((id) => Array.isArray(id) ? link(id[0], id[1]) : link("db/" + id, section(id).title))]).flat(2),
      INDEX.xp ? link("xp", "Experience") : null);
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
    const search = h("input", { type: "search", id: "home-search", placeholder: "Search items, creatures, recipes…", "aria-label": "Search the codex",
      onkeydown: (e) => { if (e.key === "Enter" && e.target.value.trim()) location.hash = "#/search?q=" + encodeURIComponent(e.target.value.trim()); } });
    setPage("",
      h("section", { class: "hero" },
        h("p", { class: "hero-kicker" }, "A field guide to the world of Verra"),
        h("h1", null, "Codex of Verra"),
        h("p", { class: "lede" }, "Items, creatures, recipes, loot tables and game formulas, read straight from the Ashes of Creation design data."),
        h("div", { class: "hero-search" }, search, h("button", { type: "button", class: "btn", onclick: () => search.value.trim() && (location.hash = "#/search?q=" + encodeURIComponent(search.value.trim())) }, "Search")),
        h("p", { class: "meta" }, fmt(total) + " entries · " + INDEX.source)),
      h("ul", { class: "cards" }, h("li", null, h("a", { href: "#/classes", class: "card" },
        h("span", { class: "card-title" }, "Classes"), h("span", { class: "card-count" }, "8"), h("span", { class: "card-blurb" }, "Tank, Fighter, Rogue, Ranger, Mage, Cleric, Summoner and Bard with their abilities."))),
        INDEX.sections.map((x) => h("li", null, h("a", { href: "#/db/" + x.id, class: "card" },
        h("span", { class: "card-title" }, x.title), h("span", { class: "card-count" }, fmt(x.count)), h("span", { class: "card-blurb" }, x.blurb))))),
      h("section", { class: "notes" },
        h("h2", null, "About this data"),
        h("p", null, "Everything here comes from the design-data cache that shipped with the last Early Access client (January 2026). Drop sources are shown where the data links them: quests, recipes, gathering, events, containers, zones, points of interest and some creatures."),
        h("p", null, "Most creature-specific loot tables are not linked to their creatures in the client data, so creature drops are incomplete until we confirm them in game. Legacy and test records are hidden by default; turn them on in any list.")),
      h("footer", { class: "foot" }, "Codex of Verra is an independent, non-commercial fan project. It is not affiliated with or endorsed by Intrepid Studios. Ashes of Creation is a trademark of its owner."));
    search.focus();
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
        h("ul", { class: "cards" }, C.classes.map((c) => card(c, c.abilities.length))),
        h("h2", null, "Other abilities"),
        h("ul", { class: "cards" }, C.kinds.map((k) => card(k, k.abilities ? k.abilities.length : k.families.reduce((a, f) => a + f.abilities.length, 0)))));
    }
    const c = all.find((x) => x.id === id);
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
  const STEP = 84, ROWH = 96, PADX = 48, PADY = 44, TIERGAP = 34;
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
  function tooltip(d) {
    const opts = d.opts ? d.opts.map((o) => h("div", { class: "tt-opt" }, h("div", { class: "tt-opt-name" }, icon(o.ic, "sm"), o.n), tipBody(o))) : null;
    return h("div", { class: "tt", role: "tooltip" },
      h("div", { class: "tt-head" }, d.k === "c" ? "Choose one" : d.n),
      h("div", { class: "tt-body" }, d.k === "c" ? opts : tipBody(d),
        d.c || d.pt ? h("div", { class: "tt-cost" }, "Cost: " + (d.c || 1) + " ", h("span", { class: "pt-sq" }), " " + (d.pt || "Skill Pt.")) : null,
        d.l ? h("div", { class: "tt-link" }, link("db/" + d.l, "Open in the codex →")) : null));
  }
  async function pageSkills(id) {
    const idx = await load("trees.json");
    const list = idx.trees;
    id = list.some((t) => t.id === id) ? id : "fighter";
    const T = await load("trees/" + id + ".json");
    try { CURVE = CURVE || (await load("classes.json")).mana_curve; } catch (e) { /* optional */ }
    const group = T.group;
    const tabs = h("div", { class: "st-tabs", role: "tablist" }, ["Archetype", "Weapon", "Stamina"].map((g) => {
      const first = list.find((t) => t.group === g);
      return h("a", { href: "#/skills/" + (g === group ? id : first.id), class: "st-tab", "aria-current": g === group ? "page" : null }, g);
    }));
    const subs = group === "Stamina" ? null : h("div", { class: "st-sub" }, list.filter((t) => t.group === group).map((t) =>
      h("a", { href: "#/skills/" + t.id, class: "st-chip", "aria-current": t.id === id ? "page" : null }, icon(t.ic, "sm"), t.name)));
    // geometry
    let y = PADY, prevT = null, maxX = 0;
    const place = {}, tiers = [];
    T.rows.forEach((r) => {
      if (prevT !== null && r.t !== prevT) { y += TIERGAP; tiers.push(y - TIERGAP / 2 - ROWH / 2 + 26); }
      r.nodes.forEach(([k, x]) => { place[k] = [PADX + x * STEP, y]; maxX = Math.max(maxX, x); });
      y += ROWH; prevT = r.t;
    });
    const W = PADX * 2 + maxX * STEP, H = y - ROWH + PADY + 40;
    const svg = s("svg", { class: "st-lines", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
    const defs = s("defs"); const mk = s("marker", { id: "st-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    mk.append(s("path", { d: "M0 0 L10 5 L0 10 z", class: "st-arrowhead" })); defs.append(mk); svg.append(defs);
    T.nodes.forEach((d, k) => (d.pre || []).forEach((p) => {
      if (!place[p] || !place[k]) return;
      const [x1, y1] = place[p], [x2, y2] = place[k];
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, r1 = 30, r2 = 32;
      svg.append(s("line", { x1: x1 + dx / len * r1, y1: y1 + dy / len * r1, x2: x2 - dx / len * r2, y2: y2 - dy / len * r2, class: "st-edge", "marker-end": "url(#st-arrow)" }));
    }));
    const tierMarks = tiers.map((ty) => h("div", { class: "st-tier", style: `top:${ty}px` }));
    let pinned = null;
    const tipHost = h("div", { class: "st-tiphost" });
    const showTip = (btn, d, pin) => {
      tipHost.replaceChildren(tooltip(d));
      tipHost.classList.add("on");
      const box = btn.getBoundingClientRect(), wrap = stage.getBoundingClientRect();
      const narrow = window.innerWidth < 700;
      tipHost.classList.toggle("dock", narrow);
      if (!narrow) {
        let left = box.right - wrap.left + 12; const tw = 340;
        if (box.right + 12 + tw > window.innerWidth - 8) left = box.left - wrap.left - 12 - tw;
        tipHost.style.left = Math.max(4, left) + "px";
        tipHost.style.top = Math.max(4, box.top - wrap.top - 10) + "px";
      } else { tipHost.style.left = ""; tipHost.style.top = ""; }
      if (pin) pinned = btn;
    };
    const hideTip = () => { tipHost.classList.remove("on"); pinned = null; };
    const nodesEl = T.nodes.map((d, k) => {
      if (!place[k]) return null;
      const [x, yy] = place[k];
      const b = h("button", { type: "button", class: "st-node " + (d.k === "a" ? "act" : d.k === "c" ? "choice" : "pas"), style: `left:${x}px;top:${yy}px`, "aria-label": d.n },
        d.ic ? h("img", { src: d.ic, alt: "", loading: "lazy" }) : h("span", { class: "st-noicon" }, (d.n || "?").slice(0, 1)),
        d.c && d.c > 1 ? h("span", { class: "st-cost" }, d.c) : null,
        d.k === "c" ? h("span", { class: "st-choice" }, "◆") : null);
      const hoverable = () => window.matchMedia("(hover: hover)").matches && window.innerWidth >= 700;
      b.addEventListener("mouseenter", () => { if (!pinned && hoverable()) showTip(b, d); });
      b.addEventListener("mouseleave", () => { if (!pinned && hoverable()) hideTip(); });
      b.addEventListener("focus", () => { if (hoverable() && !pinned) showTip(b, d); });
      b.addEventListener("click", (e) => { e.stopPropagation(); if (pinned === b) hideTip(); else showTip(b, d, true); });
      return b;
    });
    const canvas = h("div", { class: "st-canvas", style: `width:${W}px;height:${H}px` }, svg, tierMarks, nodesEl);
    const stage = h("div", { class: "st-stage" + (T.bg ? " has-bg" : ""), style: T.bg ? `background-image:linear-gradient(90deg, rgba(10,10,14,.9) 0%, rgba(10,10,14,.5) 55%, rgba(10,10,14,.15) 100%), url("${T.bg}")` : null }, h("div", { class: "st-scroll" }, canvas), tipHost);
    stage.addEventListener("click", () => hideTip());
    tipHost.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
    const win = h("section", { class: "st-window", "aria-label": "Skill tree" },
      h("header", { class: "st-head" }, h("span", { class: "st-title" }, "Skill Tree"), h("kbd", null, "K"), h("span", { class: "st-name" }, T.name)),
      tabs, subs, stage,
      h("footer", { class: "st-foot" }, levelPicker(), h("span", { class: "small muted" }, "Hover or tap a node. Arrows show what unlocks what.")));
    setPage(T.name + " skill tree", h("p", { class: "crumbs" }, link("", "Codex"), " / ", link("skills", "Skill trees")), h("h1", null, "Skill trees"),
      h("p", { class: "lede small" }, "The archetype, weapon and stamina trees as they are laid out in the game data: nodes, unlock order and point costs. Exact node positions live in the game interface, so the layout here follows the unlock chains."),
      win);
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

  function pageMissing() { setPage("Not found", h("h1", null, "Page not found"), h("p", null, "Check the address or go back to the ", link("", "codex"), ".")); }

  async function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const q = new URLSearchParams(query || "").get("q") || "";
    markNav(parts.join("/"));
    try {
      if (!parts.length) await pageHome();
      else if (parts[0] === "search") await pageSearch(q);
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
