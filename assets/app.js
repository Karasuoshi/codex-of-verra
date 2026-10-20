/* Codex of Verra — party notes for Ashes of Creation (Russian UI).
   No build step: reads JSON from data/ (generated) and content/ (hand-written pages), hash routes (#/...), runs on GitHub Pages. */
(function () {
  "use strict";

  const SVG = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
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
      const url = path.startsWith("content/") ? path : "data/" + path;
      cache.set(path, fetch(url).then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить " + url + " (HTTP " + r.status + ")");
        return r.json();
      }).catch((e) => { cache.delete(path); throw e; }));
    }
    return cache.get(path);
  }
  // Routes that exist on the site. Anything else (the old raw database under db/) is rendered as plain text.
  const OPEN = /^(|start|leveling|builds(\/.*)?|paths(\/.*)?|links|classes(\/.*)?|skills(\/.*)?|xp(\/.*)?|improvements(\/.*)?)$/;
  const isOpen = (to) => OPEN.test(String(to).split("?")[0]);
  const link = (to, text, cls) => isOpen(to) ? h("a", { href: "#/" + to, class: cls }, text)
    : h("span", { class: "locked" + (cls ? " " + cls : "") }, text);
  const icon = (src, cls) => src ? h("img", { src, alt: "", class: "ic" + (cls ? " " + cls : ""), loading: "lazy", decoding: "async" }) : null;


  function setPage(title, ...content) {
    document.title = title ? title + " · Codex of Verra" : "Codex of Verra — заметки пати по Ashes of Creation";
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
    const readout = h("p", { class: "readout", "aria-live": "polite" }, "Наведи или нажми на точку, чтобы увидеть значение.");
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
    const readout = h("p", { class: "readout", "aria-live": "polite" }, "Нажми на столбец, чтобы увидеть значение.");
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
    const groups = [["Играть", [["start", "Где качать"], ["leveling", "Прокачка"], ["builds", "Билды"]]],
      ["Справочник", [["classes", "Классы"], ["skills", "Деревья навыков"], ["xp", "Опыт"]]],
      ["Сообщество", [["links", "Ссылки"]]]];
    nav.replaceChildren(link("", "Главная"),
      ...groups.map(([g, items]) => [h("span", { class: "nav-group" }, g), items.map(([id, n]) => link(id, n))]).flat(2));
  }
  function markNav(route) {
    nav.querySelectorAll("a").forEach((a) => {
      const r = a.getAttribute("href").slice(2);
      const on = r === "" ? route === "" : route === r || route.startsWith(r + "/") || (r.startsWith("db/") && route.startsWith(r.slice(3) + "/"));
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  // ——— home ———
  const homeCard = (to, title, count, blurb) => h("li", null, h("a", { href: "#/" + to, class: "card" },
    h("span", { class: "card-title" }, title), count ? h("span", { class: "card-count" }, count) : h("span"), h("span", { class: "card-blurb" }, blurb)));
  async function pageHome() {
    setPage("",
      h("section", { class: "hero" },
        h("p", { class: "hero-kicker" }, "Заметки нашей пати по Ashes of Creation"),
        h("h1", null, "Codex of Verra"),
        h("p", { class: "lede" }, "Где скачать игру и как зайти на сервер, как качаться, какие брать билды. Плюс справочник по классам и деревьям навыков из данных игры."),
        h("div", { class: "wip", role: "status" }, h("b", null, "Сайт для своих."), " Пишем по ходу игры. Нашли ошибку или есть что добавить — говорите, поправим.")),
      h("h2", { class: "home-h" }, "С чего начать"),
      h("ul", { class: "cards" },
        homeCard("start", "Где качать и как зайти", "1", "Клиент из Steam, сервер Evolve, лаунчер Companion: по шагам."),
        homeCard("leveling", "Прокачка", "2", "Опыт и группа, маршрут 1–25, свитки, оружие и профессии."),
        homeCard("builds", "Билды", "3", "Стартовые билды всех 8 классов с ротациями и ссылкой в планировщик."),
        homeCard("links", "Полезные ссылки", null, "Другие проекты: сервер, гайды, базы, калькуляторы, новости.")),
      h("h2", { class: "home-h" }, "Справочник"),
      h("ul", { class: "cards" },
        homeCard("classes", "Классы", "8", "Tank, Fighter, Rogue, Ranger, Mage, Cleric, Summoner и Bard: все способности с маной, кулдаунами и дальностью."),
        homeCard("skills", "Деревья навыков", "23", "Деревья архетипов, оружия и выносливости как в игре. Собери билд и поделись ссылкой."),
        INDEX.xp ? homeCard("xp", "Опыт", "XP", "Сколько опыта нужно на уровень: персонаж, оружие, ремесло, гильдия.") : null),
      h("footer", { class: "foot" }, "Codex of Verra — некоммерческий фанатский проект. Не связан с Intrepid Studios. Ashes of Creation — товарный знак своего владельца. Справочник собран из данных клиента Early Access (январь 2026)."));
  }

  // ——— hand-written pages (content/*.json) ———
  // Inline markup in content strings: **bold**, `code`, [text](url). External links open in a new tab.
  function rich(str) {
    const out = []; const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g; let pos = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > pos) out.push(str.slice(pos, m.index));
      if (m[1]) out.push(h("b", null, m[1]));
      else if (m[2]) out.push(h("code", null, m[2]));
      else {
        const u = m[4], ext = /^https?:/.test(u);
        out.push(h("a", { href: u, target: ext ? "_blank" : null, rel: ext ? "noopener noreferrer" : null }, m[3]));
      }
      pos = m.index + m[0].length;
    }
    if (pos < str.length) out.push(str.slice(pos));
    return out;
  }
  const paras = (arr) => (arr || []).map((t) => h("p", null, rich(t)));
  function docBlock(b) {
    return h("section", { class: "doc-block" },
      b.h ? h("h2", null, b.h) : null,
      paras(b.p),
      b.list ? h("ul", { class: "doc-list" }, b.list.map((t) => h("li", null, rich(t)))) : null,
      b.steps ? h("ol", { class: "doc-steps" }, b.steps.map((t) => h("li", null, rich(t)))) : null,
      b.table ? table(b.table.head, b.table.rows.map((r) => r.map((c) => h("span", null, rich(String(c)))))) : null,
      paras(b.after),
      b.note ? h("p", { class: "doc-note" }, rich(b.note)) : null);
  }
  function sourcesList(src) {
    return src && src.length ? h("section", { class: "doc-sources" }, h("h2", null, "Источники"),
      h("ul", null, src.map(([t, u]) => h("li", null, h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, t))))) : null;
  }
  const updated = (d) => d ? h("p", { class: "meta" }, "Обновлено " + d.split("-").reverse().join(".")) : null;
  async function pageDoc(name) {
    const D = await load("content/" + name + ".json");
    setPage(D.title, h("p", { class: "crumbs" }, link("", "Главная")), h("h1", null, D.title), h("p", { class: "lede small" }, rich(D.lede)), updated(D.updated),
      D.blocks.map(docBlock), sourcesList(D.sources));
  }
  async function pageLinks() {
    const D = await load("content/links.json");
    setPage(D.title, h("p", { class: "crumbs" }, link("", "Главная")), h("h1", null, D.title), h("p", { class: "lede small" }, rich(D.lede)), updated(D.updated),
      D.groups.map((g) => h("section", { class: "doc-block" }, h("h2", null, g.h),
        h("ul", { class: "linkcards" }, g.items.map((it) => h("li", { class: "linkcard" },
          h("div", { class: "lc-head" }, h("a", { href: it.url, target: "_blank", rel: "noopener noreferrer", class: "lc-name" }, it.name),
            it.status ? h("span", { class: "tag" + (it.status === "закрыт" ? " off" : "") }, it.status) : null),
          h("span", { class: "lc-host" }, it.url.replace(/^https?:\/\//, "").replace(/\/$/, "")),
          h("p", null, rich(it.what))))))),
      D.add ? h("p", { class: "doc-note" }, rich(D.add)) : null);
  }

  // ——— gear paths (content/paths/<id>.json): stages, final set, stats, crafters ———
  async function pagePath(id) {
    if (!id) {
      const L = await load("content/paths/index.json");
      return setPage(L.title, h("p", { class: "crumbs" }, link("", "Главная")), h("h1", null, L.title), h("p", { class: "lede small" }, rich(L.lede)),
        h("ul", { class: "cards" }, L.paths.map((p) => homeCard("paths/" + p.id, p.title, p.cls, p.blurb))));
    }
    const P = await load("content/paths/" + id + ".json");
    const maxKills = Math.max(1, ...P.stages.flatMap((st) => (st.farm || []).map((f) => f.kills)));
    const item = (d) => h("li", { class: "pi" }, icon(d.ic, "pi-ic"), h("span", { class: "pi-txt" }, h("b", null, d.name), d.note ? h("small", null, rich(d.note)) : null));
    const stage = (st) => h("li", { class: "ps" },
      h("div", { class: "ps-head" }, h("span", { class: "ps-n" }, st.n), h("div", null, h("span", { class: "ps-lv" }, "Уровень " + st.levels), h("h3", null, st.title))),
      h("p", { class: "ps-where" }, rich(st.where)),
      h("ul", { class: "pi-list" }, st.drops.map(item)),
      (st.farm || []).length ? h("div", { class: "farm" }, st.farm.map((f) => h("div", { class: "farm-row" },
        h("span", { class: "farm-l" }, f.label), h("span", { class: "farm-v" }, "~" + fmt(f.kills) + " убийств"),
        h("span", { class: "farm-bar" }, h("i", { style: "width:" + (100 * f.kills / maxKills).toFixed(1) + "%" }))))) : null,
      st.wear ? h("p", { class: "ps-wear" }, rich(st.wear)) : null);
    const slot = (d, big) => h("li", { class: "gs" + (big ? " big" : "") + (d.set ? " set-" + d.set : "") },
      h("span", { class: "gs-frame" }, icon(d.ic, "gs-ic")),
      h("span", { class: "gs-txt" }, h("span", { class: "gs-slot" }, d.slot, d.set === "gp" ? h("span", { class: "tag" }, "23") : h("span", { class: "tag epic" }, "26 · Epic")),
        h("b", { class: "gs-name" }, d.name), h("small", null, d.stats)));
    const pips = (n) => h("span", { class: "pips", "aria-label": n + " из 7" }, [1, 2, 3, 4, 5, 6, 7].map((i) => h("i", { class: i <= n ? "on" : null })));
    setPage(P.title,
      h("p", { class: "crumbs" }, link("", "Главная"), " / ", link("paths", "Путь шмота")),
      h("section", { class: "path-hero" },
        h("p", { class: "hero-kicker" }, "Путь шмота"),
        h("h1", null, P.title),
        h("p", { class: "lede small" }, rich(P.lede)),
        h("ul", { class: "chips" }, P.tags.map((t) => h("li", null, t)))),
      updated(P.updated),
      h("h2", { class: "home-h" }, "Этапы"),
      h("ol", { class: "path-stages" }, P.stages.map(stage)),
      h("h2", { class: "home-h" }, "Итоговый комплект"),
      h("div", { class: "kit" },
        h("ul", { class: "kit-armor" }, P.paperdoll.map((d) => slot(d))),
        h("div", { class: "kit-side" },
          h("ul", { class: "kit-weapons" }, P.weapons.map((d) => slot(d, true))),
          h("div", { class: "bonus" }, h("h3", null, "Бонус сета Cryptward"),
            h("ul", null, P.setbonus.map((b) => h("li", null, pips(b.pcs), h("span", { class: "b-pcs" }, b.pcs + " шт."), h("span", null, b.text))))),
          h("div", { class: "bonus" }, h("h3", null, "Бонус типа брони"),
            h("ul", null, P.typebonus.map((b) => h("li", null, h("span", { class: "b-pcs wide" }, b.pcs), h("span", null, b.text))))))),
      h("h2", { class: "home-h" }, "Что получится"),
      h("ul", { class: "stat-tiles" }, P.final.map((f) => h("li", null, h("span", { class: "st-v" }, f.value), h("span", { class: "st-l" }, f.label), f.note ? h("small", null, f.note) : null))),
      h("h2", { class: "home-h" }, "Кто что качает в пати"),
      table(["#", "Сбор", "Переработка", "Крафт", "Делает"], P.chain.map((c) => [c.who, c.gather, c.process, c.craft, c.makes])),
      P.notes ? h("ul", { class: "doc-list path-notes" }, P.notes.map((t) => h("li", null, rich(t)))) : null);
  }

  // ——— builds ———
  // A build lists skill names; they are matched to tree nodes (or options of a choice node) and their prerequisites are added.
  function buildCode(T, names) {
    const N = T.nodes, pick = new Map(), missing = [];
    names.forEach((nm) => {
      let hit = null;
      for (let i = 0; i < N.length && !hit; i++) {
        const d = N[i];
        if (d.k !== "c" && d.n === nm) hit = [i, null];
        else if (d.k === "c") d.opts.forEach((o, j) => { if (!hit && o.n === nm) hit = [i, j]; });
      }
      if (hit) pick.set(hit[0], hit[1]); else missing.push(nm);
    });
    const addPre = (i) => (N[i].pre || []).forEach((p) => { if (!pick.has(p)) { pick.set(p, N[p].k === "c" ? 0 : null); addPre(p); } });
    [...pick.keys()].forEach(addPre);
    let pts = 0;
    pick.forEach((c, i) => { const v = c != null && N[i].opts ? N[i].opts[c] : N[i]; pts += v.c || N[i].c || 1; });
    const code = [...pick.keys()].sort((a, b) => a - b).map((i) => i + (pick.get(i) != null ? "c" + pick.get(i) : "")).join(".");
    return { code, pts, missing };
  }
  async function pageBuilds(id) {
    const B = await load("content/builds.json");
    const crumbs = h("p", { class: "crumbs" }, link("", "Главная"), id ? [" / ", link("builds", "Билды")] : null);
    const switcher = h("nav", { class: "tabs", "aria-label": "Классы" }, B.classes.map((c) => h("a", { href: "#/builds/" + c.id, "aria-current": c.id === id ? "page" : null }, c.name)));
    if (!id) {
      return setPage(B.title, crumbs, h("h1", null, B.title), h("p", { class: "lede small" }, rich(B.lede)), updated(B.updated),
        B.note ? h("p", { class: "doc-note" }, rich(B.note)) : null,
        h("ul", { class: "cards" }, B.classes.map((c) => h("li", null, h("a", { href: "#/builds/" + c.id, class: "card" },
          h("span", { class: "card-title" }, c.name), h("span", { class: "card-count" }, c.difficulty), h("span", { class: "card-blurb" }, c.role + ". " + c.weapons))))),
        sourcesList(B.sources));
    }
    const c = B.classes.find((x) => x.id === id);
    if (!c) return pageMissing();
    const T = await load("trees/" + c.id + ".json");
    const ST = c.stamina ? await load("trees/stamina.json") : null;
    const pre = c.stamina ? B.stamina_presets[c.stamina] : null;
    const plan = (tree, b, budget) => {
      const r = buildCode(tree, b.skills);
      return h("div", { class: "plan" },
        h("div", { class: "plan-head" }, h("h3", null, b.name),
          h("span", { class: "plan-pts" + (budget && r.pts > budget ? " over" : "") }, r.pts + (budget ? " из " + budget : "") + " очк."),
          h("a", { class: "st-btn primary", href: "#/skills/" + tree.id + (r.code ? "?b=" + r.code : "") }, "Открыть в планировщике")),
        h("ul", { class: "chips" }, b.skills.map((n) => h("li", { class: r.missing.includes(n) ? "miss" : null, title: r.missing.includes(n) ? "Нет в дереве клиента" : null }, n))),
        budget && r.pts > budget ? h("p", { class: "small warn" }, "Больше, чем даёт 25-й уровень: выбери главное.") : null);
    };
    setPage(c.name + " — билд", crumbs, h("h1", null, c.name), switcher,
      h("dl", { class: "facts" }, h("dt", null, "Роль"), h("dd", null, c.role), h("dt", null, "Сложность"), h("dd", null, c.difficulty), h("dt", null, "Оружие"), h("dd", null, rich(c.weapons))),
      h("h2", null, "Навыки архетипа"),
      h("p", { class: "small muted" }, "Отмечены ключевые навыки и всё, что нужно для их открытия. На 25-м уровне — 24 очка архетипа."),
      c.builds.map((b) => plan(T, b, 24)),
      h("h2", null, "Ротации"),
      h("div", { class: "rot" }, c.rotations.map(([n, t]) => h("div", { class: "rot-row" }, h("b", null, n), h("p", null, rich(t))))),
      h("h2", null, "Выносливость (Stamina)"),
      pre ? [h("p", null, rich(pre.text)), plan(ST, { name: pre.name, skills: pre.skills })] : h("p", null, rich(c.stamina_text || "")),
      h("h2", null, "Советы"),
      h("ul", { class: "doc-list" }, c.tips.map((t) => h("li", null, rich(t)))),
      h("p", { class: "small muted" }, "Источник: ", [].concat(c.source).map((u, i) => [i ? ", " : "", h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, "MetaBattle: " + (/PvE/.test(u) ? "PvE" : /PvP/.test(u) ? "PvP" : "прокачка"))]), ". Названия навыков — как в игре."),
      B.note ? h("p", { class: "doc-note" }, rich(B.note)) : null);
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
  const PH_RU = { cooldown: "перезарядка", charges: "заряды", duration: "длительность", "per tick": "за тик", "stat bonus": "бонус стата", effect: "эффект", amount: "величина", value: "значение" };
  const ph = (kind, tok) => h("span", { class: "ph", title: "Значение подставляет игра: " + tok + " (ещё не расшифровано)" }, PH_RU[kind] || kind);
  function segNodes(segs) {
    return segs.map((x) => typeof x === "string" ? x
      : x.v ? h("span", { class: /healing/.test(x.v) ? "num heal" : "num" }, x.v)
      : x.e ? h("span", { class: "fx" }, x.n)
      : x.p ? ph(x.p, x.t) : h("span", { class: "fx" }, x.n));
  }
  // ——— ability numbers ———
  let LEVEL = 50;
  try { LEVEL = Math.min(50, Math.max(1, parseInt(localStorage.getItem("cov.level") || "50", 10) || 50)); } catch (e) { /* storage blocked */ }
  let CURVE = null;
  const secs = (v) => v >= 60 ? (Math.floor(v / 60) + " мин" + (v % 60 ? " " + fmt(+(v % 60).toFixed(2)) + " с" : "")) : fmt(v) + " с";
  const chRu = (v) => String(v).replace("(+2 with talent)", "(+2 с талантом)").replace(/with talent/g, "с талантом");
  const manaAt = (base, lvl) => CURVE && CURVE[lvl - 1] != null ? Math.ceil(base * CURVE[lvl - 1] / 32) : null;
  function statLine(st) {
    if (!st) return null;
    const parts = [];
    if (st.m != null) {
      const v = manaAt(st.m, LEVEL);
      parts.push(h("span", { class: "stat mana", "data-base": st.m }, h("b", null, v != null ? v : "?"), " маны"));
    }
    if (st.cd) parts.push(h("span", { class: "stat" }, "перезарядка ", h("b", null, secs(st.cd))));
    if (st.ch) parts.push(h("span", { class: "stat" }, "заряды ", h("b", null, chRu(st.ch))));
    if (st.r) parts.push(h("span", { class: "stat" }, "дальность ", h("b", null, fmt(st.r) + " м")));
    return parts.length ? h("p", { class: "stats" }, parts) : null;
  }
  function levelPicker(onChange) {
    const out = h("output", { for: "lvl" }, String(LEVEL));
    const inp = h("input", { type: "range", id: "lvl", min: 1, max: 50, step: 1, value: LEVEL, "aria-label": "Уровень персонажа" });
    inp.addEventListener("input", () => {
      LEVEL = +inp.value; out.textContent = String(LEVEL);
      try { localStorage.setItem("cov.level", String(LEVEL)); } catch (e) { /* ignore */ }
      document.querySelectorAll(".stat.mana").forEach((el) => { el.firstChild.textContent = manaAt(+el.dataset.base, LEVEL); });
      if (onChange) onChange();
    });
    return h("div", { class: "level-pick" }, h("label", { for: "lvl" }, "Уровень персонажа"), inp, out,
      h("span", { class: "small muted" }, "Расход маны растёт с уровнем."));
  }

  // ——— classes ———
  const CLASS_RU = { tank: "Передняя линия: держит внимание врагов, защищает союзников и контролирует бой.",
    fighter: "Урон в ближнем бою: быстро сближается и сильно бьёт.", rogue: "Скрытный боец ближнего боя: позиция, взрывной урон и ослабления.",
    ranger: "Физический урон издалека: луки, ловушки и мобильность.", mage: "Магический урон издалека: огонь, лёд и заклинания по площади.",
    cleric: "Хил: лечит и защищает группу, особенно силён против нежити.", summoner: "Призывает существ и сражается через них.",
    bard: "Поддержка: песни усиливают союзников и ослабляют врагов." };
  function abilityCards(list) {
    return h("ul", { class: "abil" }, list.map((a) => h("li", null,
      h("h3", null, icon(a.ic, "sm"), a.n),
      statLine(a.st),
      a.x ? h("p", { class: "desc" }, segNodes(a.x)) : h("p", { class: "muted small" }, "Описания в данных нет."))));
  }
  async function pageClasses(id) {
    const C = await load("classes.json");
    CURVE = C.mana_curve || CURVE;
    const all = [...C.classes, ...C.kinds];
    const crumbs = h("p", { class: "crumbs" }, link("", "Главная"), id ? [" / ", link("classes", "Классы")] : null);
    const switcher = h("nav", { class: "tabs", "aria-label": "Классы" }, C.classes.map((c) => h("a", { href: "#/classes/" + c.id, "aria-current": c.id === id ? "page" : null }, c.name)));
    if (!id) {
      const card = (c, n) => h("li", null, h("a", { href: "#/classes/" + c.id, class: "card" },
        h("span", { class: "card-title" }, c.name), h("span", { class: "card-count" }, fmt(n)), h("span", { class: "card-blurb" }, CLASS_RU[c.id] || c.blurb)));
      return setPage("Классы", crumbs, h("h1", null, "Классы"),
        h("p", { class: "lede small" }, "Восемь архетипов и их способности по данным клиента января 2026. Названия и описания — английские, как в игре. Готовые сборки — в разделе ", link("builds", "Билды"), "."),
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
        h("summary", null, h("span", null, "Старые версии (Alpha)"), h("span", { class: "count" }, c.legacy.length)),
        h("p", { class: "small muted" }, "Ранние варианты способностей. В текущей игре их может не быть."), abilityCards(c.legacy)) : null];
    setPage(c.name, crumbs, h("h1", null, c.name), isClass ? switcher : null, h("p", { class: "lede small" }, CLASS_RU[c.id] || c.blurb),
      isClass ? levelPicker() : null,
      h("p", { class: "small muted" }, "Цифры — из данных игры. Времени каста там нет; пунктиром отмечены значения, которые ещё не расшифрованы."),
      h("p", null, link("builds/" + c.id, "Билд для " + c.name + " →"), " · ", link("skills/" + c.id, "Дерево навыков →")), body);
  }

  // ——— skill trees (in-game style panel) ———
  const STEP = 52, ROWH = 64, PADX = 34, PADY = 34, TIERGAP = 18;
  function tipBody(d) {
    const kids = [];
    const st = d.st;
    if (st) {
      const left = [], right = [];
      if (st.m != null) left.push(h("div", { class: "tt-mana" }, h("span", { class: "stat mana", "data-base": st.m }, manaAt(st.m, LEVEL)), " маны"));
      if (st.r) left.push(h("div", null, "Дальность " + fmt(st.r) + " м"));
      if (st.cd) right.push(h("div", null, "Перезарядка " + secs(st.cd)));
      if (st.ch) right.push(h("div", null, "Заряды: " + chRu(st.ch)));
      if (left.length || right.length) kids.push(h("div", { class: "tt-stats" }, h("div", null, left), h("div", { class: "tt-right" }, right)));
    }
    if (d.x) kids.push(h("p", { class: "tt-desc" }, segNodes(d.x)));
    return kids;
  }
  function costLine(d) {
    const kind = /Weapon/.test(d.pt || "") ? "оружия" : /Stamina/.test(d.pt || "") ? "выносливости" : "архетипа";
    return d.c || d.pt ? h("div", { class: "tt-cost" }, "Стоимость: " + (d.c || 1) + " ", h("span", { class: "pt-sq" }), " очк. " + kind) : null;
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
    const ptName = { Archetype: "архетипа", Weapon: "оружия", Stamina: "выносливости" }[T.group] || "";
    const unlearn = (k) => { learned.delete(k); chosen.delete(k); kids[k].forEach((c) => learned.has(c) && unlearn(c)); };
    const view = (k) => (N[k].k === "c" && chosen.has(k) ? N[k].opts[chosen.get(k)] : N[k]);

    const group = T.group;
    const TAB_RU = { Archetype: "Архетип", Weapon: "Оружие", Stamina: "Выносливость" };
    const tabs = h("div", { class: "st-tabs", role: "tablist" }, ["Archetype", "Weapon", "Stamina"].map((g) => {
      const first = list.find((t) => t.group === g);
      return h("a", { href: "#/skills/" + (g === group ? id : first.id), class: "st-tab", "aria-current": g === group ? "page" : null }, TAB_RU[g], g === "Archetype" ? h("span", { class: "st-dia" }, "◆") : null);
    }));
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
      const action = !ok ? h("div", { class: "tt-hint warn" }, "Сначала изучи: " + d.pre.filter((p) => !learned.has(p)).map((p) => view(p).n).join(", "))
        : d.k === "c" && !isL ? h("div", { class: "tt-hint" }, "Выбери один вариант.")
        : h("div", { class: "tt-actions" }, h("button", { type: "button", class: "tt-btn", onclick: (e) => { e.stopPropagation(); toggle(k); } }, isL ? "Забыть" : "Изучить"),
            hoverable() ? h("span", { class: "tt-hint" }, "или кликни по узлу") : null);
      const opts = d.k === "c" ? d.opts.map((o, i) => h("div", { class: "tt-opt" + (chosen.get(k) === i ? " on" : "") },
        h("div", { class: "tt-opt-name" }, icon(o.ic, "sm"), o.n), tipBody(o),
        ok ? h("button", { type: "button", class: "tt-btn", onclick: (e) => { e.stopPropagation(); chosen.set(k, i); learned.add(k); refresh(); showTip(nodeEls[k], k, true); } }, chosen.get(k) === i ? "Выбрано" : "Выбрать") : null)) : null;
      return h("div", { class: "tt", role: "tooltip" },
        h("div", { class: "tt-head" }, d.k === "c" && !chosen.has(k) ? "Выбери один" : v.n),
        h("div", { class: "tt-body" }, d.k === "c" && !chosen.has(k) ? opts : [tipBody(v), d.k === "c" ? h("details", { class: "tt-more" }, h("summary", null, "Другие варианты"), opts) : null],
          costLine(v.c ? v : d), action));
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
    const spentEl = h("b"), linkBtn = h("button", { type: "button", class: "st-btn primary" }, "Скопировать ссылку");
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
      try { await navigator.clipboard.writeText(url); note.textContent = "Ссылка на билд скопирована."; } catch (e) { note.textContent = "Скопируй адрес из строки браузера."; }
    });
    const win = h("section", { class: "st-window", "aria-label": "Дерево навыков" },
      h("header", { class: "st-head" }, h("span", { class: "st-emblem", "aria-hidden": "true" }), h("span", { class: "st-title" }, "Дерево навыков"), h("kbd", null, "K"),
        h("span", { class: "st-name" }, T.name)),
      tabs, subs, stage,
      h("footer", { class: "st-foot" },
        h("span", { class: "st-points" }, h("span", { class: "pt-sq big" }), " Потрачено очков " + ptName + ": ", spentEl),
        note,
        h("span", { class: "st-actions" }, h("button", { type: "button", class: "st-btn", onclick: () => { learned.clear(); chosen.clear(); refresh(); hideTip(); } }, "Сбросить"), linkBtn)),
      h("div", { class: "st-level" }, levelPicker()));
    const ownBuild = T.group === "Archetype" ? link("builds/" + id, "Готовый билд для " + T.name + " →") : null;
    setPage(T.name + " — дерево навыков", h("p", { class: "crumbs" }, link("", "Главная"), " / ", link("skills", "Деревья навыков")), h("h1", null, "Деревья навыков"),
      h("p", { class: "lede small" }, "Собери билд как в игре: клик по узлу — изучить, «Сбросить» — начать заново, «Скопировать ссылку» — поделиться билдом с пати. Порядок узлов и условия открытия — из данных игры. У Cleric, Bard и Summoner расположение как на скриншотах из игры, у остальных пока по цепочкам открытия."),
      ownBuild ? h("p", null, ownBuild) : null, win);
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
      h("p", { class: "crumbs" }, link("", "Главная"), " / ", link("improvements", "Possible Improvements")),
      h("h1", null, "Guild Championships"),
      h("p", { class: "lede small" }, "A proposal for city-sponsored regional guild tournaments: meaningful PvP, Node economics, and long-term civic rewards."),
      h("p", { class: "meta" }, "Community design proposal · Not an existing confirmed game mechanic"),
      tabs, body);
    choose("overview");
  }

  // ——— experience ———
  async function pageXp(tab) {
    const xp = await load("xp.json");
    const tabs = [["adv", "Персонаж"], ["mods", "Множители"], ["craft", "Ремесло"], ["weapons", "Оружие"], ["guild", "Гильдия"]];
    tab = tabs.some((t) => t[0] === tab) ? tab : "adv";
    const xpLine = (l, v) => [h("b", null, "Уровень " + l), ": всего " + fmt(v) + " опыта"];
    const rowsFor = (curve, cap) => curve.filter((p) => !cap || p[0] <= cap).map((p) => {
      const n = curve.find((q) => q[0] === p[0] + 1);
      return { cells: [p[0], fmt(p[1]), cap && p[0] >= cap ? "кап" : n ? fmt(n[1] - p[1]) : "—"], cls: cap && p[0] === cap ? "cap" : null };
    });
    let body;
    const a = xp.adventuring;
    if (tab === "adv") body = [h("p", { class: "lede small" }, "Сколько всего опыта нужно на каждый уровень. Кап в этой версии: " + a.cap + ". Советы — в разделе ", link("leveling", "Прокачка"), "."),
      lineChart(a.curve.filter((p) => p[0] <= a.cap), { label: "Опыт персонажа", describe: xpLine }),
      dl([["Долг опыта при смерти", a.usesDebt ? "Да" : "Нет"], ["Очки навыков", (a.skillPoints[1] || 0) + " за уровень, начиная со 2-го"]]),
      table(["Уровень", "Всего опыта", "До следующего"], rowsFor(a.curve, a.cap), [0, 1, 2])];
    else if (tab === "mods") body = [h("h2", null, "Размер группы"), barChart(a.party, { label: "Множитель опыта группы", describe: (x, y) => [h("b", null, x + " в группе"), ": ×" + fmt(y)] }),
      h("h2", null, "Разница уровней с целью"), barChart(a.decay, { label: "Опыт от разницы уровней", describe: (x, y) => [h("b", null, (x > 0 ? "+" : "") + x), ": ×" + fmt(y)] }),
      h("h2", null, "Разброс уровней в группе"), barChart(a.disparity, { label: "Опыт от разброса уровней в группе", describe: (x, y) => [h("b", null, "разброс " + x), ": ×" + fmt(y)] })];
    else if (tab === "craft") body = [["crafting", "Крафт и переработка"], ["gathering", "Сбор"]].map(([k, n]) => [h("h2", null, n), lineChart(xp[k].curve, { label: n, describe: xpLine })]);
    else if (tab === "weapons") body = [h("p", { class: "lede small" }, "Все виды оружия растут по одной кривой."), lineChart(xp.weapons[0].curve, { label: "Опыт оружия", describe: xpLine }),
      table(["Оружие", "Уровней"], xp.weapons.filter((w) => w.name !== "Weapon").map((w) => [w.name, w.curve.length]), [1])];
    else body = [lineChart(xp.guild.curve.filter((p) => p[0] >= 1), { label: "Опыт гильдии", describe: xpLine }), table(["Уровень", "Всего опыта", "До следующего"], rowsFor(xp.guild.curve.filter((p) => p[0] >= 1), xp.guild.cap), [0, 1, 2])];
    setPage("Опыт", h("p", { class: "crumbs" }, link("", "Главная")), h("h1", null, "Опыт"), h("nav", { class: "tabs", "aria-label": "Виды опыта" }, tabs.map(([id, n]) => h("a", { href: "#/xp/" + id, "aria-current": id === tab ? "page" : null }, n))), body);
  }

  function pageGone() {
    setPage("Раздела больше нет", h("p", { class: "crumbs" }, link("", "Главная")), h("h1", null, "Раздела больше нет"),
      h("p", { class: "lede small" }, "Сырую базу (предметы, лут, квесты) мы убрали: есть проекты, где это сделано лучше. Их список — в ", link("links", "Ссылках"), "."),
      h("p", null, "Есть на сайте: ", link("start", "Где качать"), ", ", link("leveling", "Прокачка"), ", ", link("builds", "Билды"), ", ", link("classes", "Классы"), ", ", link("skills", "Деревья навыков"), ", ", link("xp", "Опыт"), "."));
  }
  function pageMissing() { setPage("Не найдено", h("h1", null, "Страница не найдена"), h("p", null, "Проверь адрес или вернись на ", link("", "главную"), ".")); }

  async function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    markNav(parts.join("/"));
    try {
      if (!parts.length) await pageHome();
      else if (parts[0] === "start" || parts[0] === "leveling") await pageDoc(parts[0]);
      else if (parts[0] === "builds") await pageBuilds(parts[1]);
      else if (parts[0] === "links") await pageLinks();
      else if (parts[0] === "paths") await pagePath(parts[1]);
      else if (parts[0] === "search" || parts[0] === "db") pageGone();
      else if (parts[0] === "improvements") pageImprovements(parts[1]);
      else if (parts[0] === "xp") await pageXp(parts[1]);
      else if (parts[0] === "classes") await pageClasses(parts[1]);
      else if (parts[0] === "skills") await pageSkills(parts[1]);
      else pageMissing();
    } catch (e) {
      setPage("Ошибка", h("h1", null, "Страница не открылась"), h("p", { class: "warn" }, e.message),
        h("p", { class: "muted" }, location.protocol === "file:" ? "Открой сайт через веб-сервер, например: python3 -m http.server" : "Проверь, что папки data/ и content/ на месте."));
    }
  }

  load("index.json").then((idx) => { INDEX = idx; buildNav(); window.addEventListener("hashchange", route); route(); })
    .catch((e) => main.replaceChildren(h("div", { class: "page" }, h("h1", null, "Нет данных"), h("p", { class: "warn" }, e.message))));
})();
