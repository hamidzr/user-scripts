// ==UserScript==
// @name                 GreenCloudVPS Plan Filter
// @author               Zare
// @description          filter, sort, and tabulate GreenCloudVPS store plans by stock, location, specs, CPU, and annualized price; badge new and restocked plans across sale pages, with an optional watch mode
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/greencloudvps.com/greencloudvps-plan-filter.user.js
// @grant                none
// @match                https://greencloudvps.com/billing/store/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/greencloudvps.com/greencloudvps-plan-filter.user.js
// @version              1.5.1
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var injectCSS = (id, css) => {
    let style = document.getElementById(id);
    if (style) {
      style.textContent = css;
      return style;
    }
    style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
    return style;
  };
  var createElement = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "className") {
          el.className = value;
        } else {
          el[key] = value;
        }
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === "string") {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      }
    }
    return el;
  };

  // src/lib/store.ts
  var LOCAL_STORAGE_ADAPTER = {
    name: "localStorage",
    readText: (key) => {
      return localStorage.getItem(key);
    },
    writeText: (key, value) => {
      localStorage.setItem(key, value);
    }
  };
  var getAdapters = (adapters) => {
    return adapters?.length ? adapters : [LOCAL_STORAGE_ADAPTER];
  };
  var reportError = (opts, error, ctx) => {
    opts?.onError?.(error, ctx);
  };
  var readRawStore = (key, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        return adapter.readText(key);
      } catch (error) {
        reportError(opts, error, {
          action: "read",
          adapterName: adapter.name,
          key
        });
      }
    }
    return null;
  };
  var writeTextStore = (key, value, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        adapter.writeText(key, value);
        return true;
      } catch (error) {
        reportError(opts, error, {
          action: "write",
          adapterName: adapter.name,
          key
        });
      }
    }
    return false;
  };
  var readJsonStore = (key, fallback, opts) => {
    const raw = readRawStore(key, opts);
    if (raw === null)
      return fallback;
    try {
      const parsed = JSON.parse(raw);
      return opts?.parse ? opts.parse(parsed) : parsed;
    } catch (error) {
      reportError(opts, error, { action: "parse", key });
      return fallback;
    }
  };
  var writeJsonStore = (key, value, opts) => {
    try {
      return writeTextStore(key, JSON.stringify(value), opts);
    } catch (error) {
      reportError(opts, error, { action: "stringify", key });
      return false;
    }
  };

  // src/greencloudvps.com/greencloudvps-cpu.ts
  var CPUS = [
    {
      match: /milan\s*\/\s*genoa/i,
      label: "EPYC Milan/Genoa",
      score: 200,
      basis: "could land on either; scored as Milan (Genoa nodes ~290)"
    },
    {
      match: /genoa/i,
      label: "EPYC Genoa",
      score: 290,
      basis: "EPYC 9654, GB6 single-core ~2050 on a GreenCloud VDS (one sample)"
    },
    {
      match: /milan/i,
      label: "EPYC Milan",
      score: 200,
      basis: "mostly EPYC 7763 (also 7C13/7V13/7643/7543P), GB6 single-core ~1350-1470"
    },
    {
      match: /rome/i,
      label: "EPYC Rome",
      score: 160,
      basis: "EPYC 7642/7502P/7702P, GB6 single-core ~1070-1150"
    },
    {
      match: /platinum/i,
      label: "Xeon Platinum Gen 2",
      score: 125,
      basis: "unverified sku; estimate from Cascade Lake (e.g. Platinum 8260) on other hosts"
    },
    {
      match: /gold/i,
      label: "Xeon Gold",
      score: 120,
      basis: "Skylake-SP Gold 6148/6126/6132, GB6 single-core ~920 (one sample)"
    },
    {
      match: /e5\s*-?\s*v3\s*\/\s*v?4/i,
      label: "Xeon E5 v3/v4",
      score: 95,
      basis: "could be Haswell E5 v3 or Broadwell E5 v4; slightly below E5 v4"
    },
    {
      match: /e5\s*-?\s*v4/i,
      label: "Xeon E5 v4",
      score: 100,
      basis: "baseline: E5-2698 v4 / E5-2680 v4, GB6 single-core ~690"
    },
    {
      match: /e5\s*-?\s*v3/i,
      label: "Xeon E5 v3",
      score: 90,
      basis: "E5-2680 v3, Haswell, a bit slower per clock than E5 v4"
    },
    {
      match: /ryzen/i,
      label: "Ryzen",
      score: 300,
      basis: "model varies by batch (5950X/7950X/9950X seen); estimate, no GreenCloud GB6 sample"
    }
  ];
  var identifyCpu = (family) => {
    if (!family)
      return null;
    const hit = CPUS.find((c) => c.match.test(family));
    return hit ? { label: hit.label, score: hit.score, basis: hit.basis } : null;
  };

  // src/greencloudvps.com/greencloudvps-plan-filter.css
  var greencloudvps_plan_filter_default = `/* --- page space: drop the video hero and sidebar, let the store use the full width --- */
section:has(> video.video-background) {
  display: none;
}
#main-body > .container {
  width: auto;
  max-width: 1760px;
}
/* store links stay in the top Store menu; the hidden sidebar still feeds sale group discovery */
#order-standard_cart .cart-sidebar {
  display: none;
}
/* the cart theme stylesheet loads after ours (75% width, float right), so out-specify it */
#main-body #order-standard_cart .cart-body {
  float: none;
  width: 100%;
}
#order-standard_cart .header-lined h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

/* reflow bootstrap rows into one grid so hidden/reordered cards leave no gaps */
#products.gcvf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
#products.gcvf-grid > .row {
  display: contents;
}
/* bootstrap clearfix pseudo-elements would otherwise become empty grid cells */
#products.gcvf-grid::before,
#products.gcvf-grid::after,
#products.gcvf-grid > .row::before,
#products.gcvf-grid > .row::after {
  display: none;
}
#products.gcvf-grid .gcvf-col {
  width: auto;
  max-width: none;
  padding: 0;
  float: none;
}
#products.gcvf-grid .gcvf-col > .product {
  height: 100%;
  margin: 0;
}
.gcvf-col[hidden] {
  display: none !important;
}
.gcvf-oos {
  opacity: 0.45;
}

/* not sticky: with every chip row it covers half the viewport; the table header sticks instead */
.gcvf-bar {
  margin: 0 0 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #dde3ea;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  font-size: 13px;
  line-height: 1.3;
}
.gcvf-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.gcvf-row + .gcvf-row {
  margin-top: 6px;
}
.gcvf-label {
  min-width: 64px;
  font-weight: 600;
  color: #445;
}
.gcvf-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.gcvf-chip {
  padding: 2px 8px;
  border: 1px solid #c9d2dc;
  border-radius: 999px;
  background: #f6f8fa;
  color: #223;
  font-size: 12px;
  cursor: pointer;
}
.gcvf-chip:hover {
  border-color: #5b8def;
}
.gcvf-chip[aria-pressed='true'] {
  background: #2f6fde;
  border-color: #2f6fde;
  color: #fff;
}
.gcvf-chip.gcvf-empty:not([aria-pressed='true']) {
  opacity: 0.4;
}
.gcvf-chip small {
  margin-left: 4px;
  opacity: 0.7;
}
.gcvf-bar select,
.gcvf-bar input[type='number'] {
  height: 26px;
  padding: 2px 6px;
  border: 1px solid #c9d2dc;
  border-radius: 4px;
  font-size: 12px;
}
.gcvf-bar input[type='number'] {
  width: 80px;
}
.gcvf-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-weight: 600;
  cursor: pointer;
}
.gcvf-count {
  margin-left: auto;
  font-weight: 600;
  color: #2f6fde;
}
.gcvf-warn {
  flex-basis: 100%;
  text-align: right;
  font-weight: 600;
  color: #c62828;
}
.gcvf-reset {
  padding: 3px 10px;
  border: 1px solid #c9d2dc;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}
.gcvf-annual {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #2f6fde;
}

#products.gcvf-grid[hidden],
.gcvf-table-wrap[hidden] {
  display: none;
}
/* own scroll box so the sticky header works while horizontal overflow still scrolls */
.gcvf-table-wrap {
  max-height: calc(100vh - 24px);
  margin-bottom: 24px;
  overflow: auto;
  border: 1px solid #dde3ea;
  border-radius: 8px;
}
.gcvf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}
.gcvf-table th,
.gcvf-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #edf0f3;
  text-align: left;
}
.gcvf-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f6f8fa;
  font-weight: 600;
  color: #445;
}
.gcvf-table tbody tr:nth-child(even) {
  background: #fafbfc;
}
.gcvf-table tbody tr:hover {
  background: #eef4ff;
}
.gcvf-table .gcvf-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.gcvf-table a {
  font-weight: 600;
}
.gcvf-sortable {
  cursor: pointer;
  text-decoration: underline dotted;
}
.gcvf-table th.gcvf-sorted {
  color: #2f6fde;
  text-decoration: underline;
}

.gcvf-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  vertical-align: middle;
  color: #fff;
}
.gcvf-badge.gcvf-new {
  background: #1a9c5a;
}
.gcvf-badge.gcvf-restock {
  background: #d9822b;
}
`;

  // src/greencloudvps.com/greencloudvps-plan-filter.helpers.ts
  var DEFAULT_STATE = {
    view: "table",
    inStock: true,
    allGroups: false,
    groups: [],
    countries: [],
    locations: [],
    cores: [],
    ramMb: [],
    families: [],
    cycles: [],
    maxAnnual: null,
    minCores: null,
    minRamGb: null,
    minDiskGb: null,
    sort: "page"
  };
  var CYCLES_PER_YEAR = {
    monthly: 12,
    quarterly: 4,
    "semi-annually": 2,
    annually: 1,
    biennially: 0.5,
    triennially: 1 / 3
  };
  var parseQty = (text) => {
    const m = text?.match(/(\d+)\s*available/i);
    return m ? Number(m[1]) : null;
  };
  var CORE_WORD_RE = /\b(?:v?cores?|vcpus?)\b/i;
  var parseCores = (text) => {
    if (!text || !CORE_WORD_RE.test(text))
      return null;
    const m = text.match(/\d+/);
    return m ? Number(m[0]) : null;
  };
  var parseCpuFamily = (text) => {
    if (!text)
      return null;
    const rest = text.replace(/^\s*\d+\s*/, "").replace(/\b(?:v?cores?|vcpus?|dedicated|physical)\b/gi, "").replace(/@/g, "").replace(/\s+/g, " ").trim();
    return rest || null;
  };
  var US_STATES = new Set(("AL AK AZ AR CA CO CT FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM " + "NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" "));
  var COUNTRY_PATTERNS = [
    ["Canada", /canada|\(CAN\)|,\s*ON\b/i],
    ["Netherlands", /amsterdam|,\s*NL\b/i],
    ["Germany", /frankfurt|d(?:ü|ue|u)sseldorf|,\s*DE\b/i],
    ["United Kingdom", /coventry|london|,\s*UK\b/i],
    ["Japan", /tokyo|osaka|\bJP\b/i],
    ["Singapore", /singapore|,\s*SG\b/i],
    ["Hong Kong", /hong\s*kong|\bHK\b/i],
    ["Vietnam", /vietnam|hanoi|ho chi minh|,\s*VN\b/i]
  ];
  var parseCountries = (location2) => {
    if (!location2)
      return [];
    const found = new Set;
    const isUs = /\(USA\)|united states/i.test(location2) || [...location2.matchAll(/,\s*([A-Z]{2})\b/g)].some((m) => US_STATES.has(m[1]));
    if (isUs)
      found.add("United States");
    for (const [country, re] of COUNTRY_PATTERNS) {
      if (re.test(location2))
        found.add(country);
    }
    return [...found];
  };
  var SIZE_TO_GB = { MB: 1 / 1024, GB: 1, TB: 1024 };
  var parseSizeGb = (text) => {
    const m = text?.match(/([\d.]+)\s*(MB|GB|TB)/i);
    if (!m)
      return null;
    return Number(m[1]) * SIZE_TO_GB[m[2].toUpperCase()];
  };
  var parseRamMb = (text) => {
    const gb = parseSizeGb(text);
    return gb === null ? null : Math.round(gb * 1024);
  };
  var parsePrice = (text) => {
    const m = text?.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  };
  var CYCLE_NAMES = [
    "Monthly",
    "Quarterly",
    "Semi-Annually",
    "Annually",
    "Biennially",
    "Triennially",
    "One Time",
    "Free"
  ];
  var CYCLE_RE = new RegExp(`\\b(${CYCLE_NAMES.join("|")})\\b`, "i");
  var parseCycle = (text) => {
    const m = text?.match(CYCLE_RE);
    if (!m)
      return null;
    return CYCLE_NAMES.find((c) => c.toLowerCase() === m[1].toLowerCase()) ?? null;
  };
  var annualize = (price, cycle) => {
    if (price === null || !cycle)
      return null;
    const perYear = CYCLES_PER_YEAR[cycle.toLowerCase()];
    return perYear ? price * perYear : null;
  };
  var feature = (features, label) => {
    const key = Object.keys(features).find((k) => k.toLowerCase() === label.toLowerCase());
    return key ? features[key] : null;
  };
  var buildPlan = (fields) => {
    const cpu = feature(fields.features, "CPU");
    const disk = feature(fields.features, "Hard drive");
    const location2 = feature(fields.features, "Location")?.replace(/^location:\s*/i, "") ?? null;
    const rawFamily = parseCpuFamily(cpu);
    const known = identifyCpu(rawFamily);
    const price = parsePrice(fields.priceText);
    const cycle = parseCycle(fields.cycleText);
    return {
      id: fields.id,
      name: fields.name,
      group: fields.group ?? null,
      qty: parseQty(fields.qtyText),
      location: location2,
      countries: parseCountries(location2),
      cores: parseCores(cpu),
      cpuFamily: known?.label ?? rawFamily,
      cpuScore: known?.score ?? null,
      ramMb: parseRamMb(feature(fields.features, "RAM")),
      disk,
      diskGb: parseSizeGb(disk),
      bandwidthGb: parseSizeGb(feature(fields.features, "Bandwidth")),
      price,
      cycle,
      annual: annualize(price, cycle),
      orderUrl: fields.orderUrl
    };
  };
  var one = (v) => v === null ? [] : [v];
  var facetValues = (plan, key) => {
    switch (key) {
      case "groups":
        return one(plan.group);
      case "countries":
        return plan.countries;
      case "locations":
        return one(plan.location);
      case "cores":
        return one(plan.cores);
      case "ramMb":
        return one(plan.ramMb);
      case "families":
        return one(plan.cpuFamily);
      case "cycles":
        return one(plan.cycle);
    }
  };
  var FACET_KEYS = [
    "groups",
    "countries",
    "locations",
    "cores",
    "ramMb",
    "families",
    "cycles"
  ];
  var below = (value, min) => {
    return min !== null && value !== null && value < min;
  };
  var matchesFilter = (plan, state, ignore) => {
    if (state.inStock && plan.qty === 0)
      return false;
    if (state.maxAnnual !== null && plan.annual !== null && plan.annual > state.maxAnnual) {
      return false;
    }
    if (below(plan.cores, state.minCores))
      return false;
    if (below(plan.ramMb, state.minRamGb === null ? null : state.minRamGb * 1024))
      return false;
    if (below(plan.diskGb, state.minDiskGb))
      return false;
    for (const key of FACET_KEYS) {
      if (key === ignore)
        continue;
      const selected = state[key];
      if (!selected.length)
        continue;
      if (!facetValues(plan, key).some((v) => selected.includes(v)))
        return false;
    }
    return true;
  };
  var facetOptions = (plans, state, key) => {
    const counts = new Map;
    for (const plan of plans) {
      const hit = matchesFilter(plan, state, key) ? 1 : 0;
      for (const value of facetValues(plan, key)) {
        counts.set(value, (counts.get(value) ?? 0) + hit);
      }
    }
    const options = [...counts].map(([value, count]) => ({ value, count }));
    if (options.every((o) => typeof o.value === "number")) {
      options.sort((a, b) => a.value - b.value);
    }
    return options;
  };
  var sanitizeState = (state, plans) => {
    const next = { ...state };
    for (const key of FACET_KEYS) {
      const present = new Set(plans.flatMap((p) => facetValues(p, key)));
      next[key] = state[key].filter((v) => present.has(v));
    }
    return next;
  };
  var sortValue = (plan, key) => {
    switch (key) {
      case "annual":
        return plan.annual;
      case "perCore":
        return plan.annual !== null && plan.cores ? plan.annual / plan.cores : null;
      case "perGbRam":
        return plan.annual !== null && plan.ramMb ? plan.annual / (plan.ramMb / 1024) : null;
      case "perDiskGb":
        return plan.annual !== null && plan.diskGb ? plan.annual / plan.diskGb : null;
      case "qty":
        return plan.qty === null ? null : -plan.qty;
      case "cpuScore":
        return plan.cpuScore === null ? null : -plan.cpuScore;
      case "page":
        return null;
    }
  };
  var sortPlans = (plans, key) => {
    if (key === "page")
      return [...plans];
    return plans.map((plan, i) => ({ plan, i, v: sortValue(plan, key) })).sort((a, b) => {
      if (a.v === null && b.v === null)
        return a.i - b.i;
      if (a.v === null)
        return 1;
      if (b.v === null)
        return -1;
      return a.v - b.v || a.i - b.i;
    }).map((x) => x.plan);
  };
  var CHANGE_WINDOW_MS = 12 * 60 * 60 * 1000;
  var updateSeen = (plans, prev, now) => {
    const next = {};
    for (const plan of plans) {
      const old = prev?.[plan.id];
      if (!old) {
        next[plan.id] = { firstSeen: prev ? now : 0, qty: plan.qty, restockedAt: null };
        continue;
      }
      const restocked = old.qty === 0 && plan.qty !== null && plan.qty > 0;
      next[plan.id] = {
        firstSeen: old.firstSeen,
        qty: plan.qty,
        restockedAt: restocked ? now : old.restockedAt
      };
    }
    return next;
  };
  var planChange = (plan, entry, now, windowMs = CHANGE_WINDOW_MS) => {
    if (!entry)
      return null;
    if (entry.firstSeen && now - entry.firstSeen < windowMs)
      return "new";
    const inStock = plan.qty !== 0;
    if (inStock && entry.restockedAt !== null && now - entry.restockedAt < windowMs) {
      return "restock";
    }
    return null;
  };
  var freshChanges = (seen, now) => {
    return Object.entries(seen).filter(([, e]) => e.firstSeen === now || e.restockedAt === now).map(([id]) => id);
  };
  var saleGroups = (links) => {
    const groups = new Map;
    for (const { href, text } of links) {
      const m = href.match(/^\/billing\/store\/([\w-]*sale[\w-]*)\/?$/i);
      if (!m || groups.has(m[0]))
        continue;
      groups.set(m[0], { path: m[0].replace(/\/$/, ""), label: text.trim() || m[1] });
    }
    return [...groups.values()];
  };
  var formatRam = (mb) => {
    return mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
  };
  var formatCores = (n) => `${n} core${n === 1 ? "" : "s"}`;
  var formatMoney = (n) => `$${n.toFixed(2)}`;
  var formatSize = (gb) => {
    return gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${+gb.toFixed(1)} GB`;
  };

  // src/greencloudvps.com/greencloudvps-plan-filter.user.ts
  var STYLE_ID = "gcvf-styles";
  var STORE_KEY = "gcvf-filter-state";
  var seenKey = (path) => `gcvf-seen:${path}`;
  var WATCH_KEY = "gcvf-watch";
  var WATCH_MS = 60000;
  var WATCH_JITTER_MS = 15000;
  var sels = {
    products: "#products",
    card: "#products .product",
    header: "header",
    name: 'header [id$="-name"]',
    qty: "header .qty",
    feature: ".product-desc li",
    featureValue: ".feature-value",
    pricing: ".product-pricing",
    price: ".product-pricing .price",
    orderLink: ".btn-order-now",
    storeLink: 'a[href^="/billing/store/"]'
  };
  var SORTS = [
    { key: "page", label: "page order" },
    { key: "annual", label: "$/yr" },
    { key: "perCore", label: "$/core/yr" },
    { key: "perGbRam", label: "$/GB RAM/yr" },
    { key: "perDiskGb", label: "$/100GB disk/yr" },
    { key: "qty", label: "most stock" },
    { key: "cpuScore", label: "CPU score" }
  ];
  var VIEWS = [
    { key: "table", label: "table" },
    { key: "cards", label: "cards" }
  ];
  var perGbRam = (p) => {
    return p.annual !== null && p.ramMb ? p.annual / (p.ramMb / 1024) : null;
  };
  var CYCLE_ABBR = {
    Monthly: "mo",
    Quarterly: "qtr",
    "Semi-Annually": "6mo",
    Annually: "yr",
    Biennially: "2yr",
    Triennially: "3yr"
  };
  var formatPrice = (p) => {
    if (p.price === null)
      return "";
    if (!p.cycle)
      return formatMoney(p.price);
    return `${formatMoney(p.price)}/${CYCLE_ABBR[p.cycle] ?? p.cycle}`;
  };
  var formatCpuChip = (family) => {
    const score = identifyCpu(family)?.score;
    return score ? `${family} (${score})` : family;
  };
  var money = (n) => n === null ? "" : formatMoney(n);
  var changeBadge = (change) => {
    return change ? createElement("span", { className: `gcvf-badge gcvf-${change}` }, [change]) : null;
  };
  var buildColumns = (changes) => [
    {
      label: "plan",
      sort: "page",
      cell: (p) => {
        const name = p.orderUrl ? createElement("a", { href: p.orderUrl }, [p.name]) : p.name;
        const badge = changeBadge(changes.get(p.id) ?? null);
        return badge ? createElement("span", {}, [name, " ", badge]) : name;
      }
    },
    { label: "group", cell: (p) => p.group ?? "" },
    {
      label: "stock",
      numeric: true,
      sort: "qty",
      cell: (p) => p.qty === null ? "" : String(p.qty)
    },
    { label: "location", cell: (p) => p.location ?? "" },
    { label: "cores", numeric: true, cell: (p) => p.cores === null ? "" : String(p.cores) },
    { label: "RAM", numeric: true, cell: (p) => p.ramMb === null ? "" : formatRam(p.ramMb) },
    {
      label: "CPU",
      cell: (p) => createElement("span", { title: identifyCpu(p.cpuFamily)?.basis ?? "" }, [p.cpuFamily ?? ""])
    },
    {
      label: "CPU score",
      numeric: true,
      sort: "cpuScore",
      cell: (p) => p.cpuScore === null ? "" : String(p.cpuScore)
    },
    {
      label: "disk",
      numeric: true,
      cell: (p) => createElement("span", { title: p.disk ?? "" }, [
        p.diskGb === null ? p.disk ?? "" : formatSize(p.diskGb)
      ])
    },
    {
      label: "BW",
      numeric: true,
      cell: (p) => p.bandwidthGb === null ? "" : formatSize(p.bandwidthGb)
    },
    {
      label: "price",
      numeric: true,
      cell: formatPrice
    },
    { label: "$/yr", numeric: true, sort: "annual", cell: (p) => money(p.annual) },
    {
      label: "$/core",
      numeric: true,
      sort: "perCore",
      cell: (p) => money(p.annual !== null && p.cores ? p.annual / p.cores : null)
    },
    { label: "$/GB RAM", numeric: true, sort: "perGbRam", cell: (p) => money(perGbRam(p)) },
    {
      label: "$/100GB disk",
      numeric: true,
      sort: "perDiskGb",
      cell: (p) => money(p.annual !== null && p.diskGb ? p.annual / p.diskGb * 100 : null)
    }
  ];
  var readCard = (card, group) => {
    const features = {};
    for (const li of card.querySelectorAll(sels.feature)) {
      const valueEl = li.querySelector(sels.featureValue);
      if (!valueEl)
        continue;
      const value = valueEl.textContent?.trim() ?? "";
      const label = (li.textContent ?? "").replace(valueEl.textContent ?? "", "").trim();
      if (label)
        features[label] = value;
    }
    return buildPlan({
      id: card.id,
      name: card.querySelector(sels.name)?.textContent?.trim() ?? card.id,
      qtyText: card.querySelector(sels.qty)?.textContent ?? null,
      features,
      priceText: card.querySelector(sels.price)?.textContent ?? null,
      cycleText: card.querySelector(sels.pricing)?.textContent ?? null,
      group,
      orderUrl: orderUrl(card)
    });
  };
  var orderUrl = (card) => {
    const href = card.querySelector(sels.orderLink)?.getAttribute("href");
    return href ? new URL(href, location.origin).href : null;
  };
  var fetchGroupPlans = async ({ path, label }) => {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const plans = [...doc.querySelectorAll(sels.card)].map((card) => readCard(card, label));
      return { label, plans, error: plans.length ? null : "no plans found" };
    } catch (error) {
      console.warn(`gcvf: could not load ${path}`, error);
      return { label, plans: [], error: error instanceof Error ? error.message : String(error) };
    }
  };
  var navGroups = () => {
    const links = [...document.querySelectorAll(sels.storeLink)].map((a) => ({
      href: a.getAttribute("href") ?? "",
      text: a.textContent ?? ""
    }));
    return saleGroups(links);
  };
  var trackChanges = (path, plans, now) => {
    const seen = updateSeen(plans, readJsonStore(seenKey(path), null), now);
    writeJsonStore(seenKey(path), seen);
    return {
      changes: plans.map((p) => [p.id, planChange(p, seen[p.id], now)]),
      fresh: freshChanges(seen, now)
    };
  };
  var isWatching = () => sessionStorage.getItem(WATCH_KEY) === "1";
  var scheduleWatch = () => {
    if (!isWatching())
      return;
    setTimeout(() => location.reload(), WATCH_MS + Math.random() * WATCH_JITTER_MS);
  };
  var notifyFresh = (plans) => {
    if (!plans.length)
      return;
    document.title = `(${plans.length}) ${document.title.replace(/^\(\d+\) /, "")}`;
    if (!isWatching() || typeof Notification === "undefined")
      return;
    if (Notification.permission !== "granted")
      return;
    const body = plans.slice(0, 5).map((p) => [p.name, p.location, p.annual === null ? "" : `${formatMoney(p.annual)}/yr`].join(" ")).join(`
`);
    new Notification(`GreenCloud: ${plans.length} new or restocked`, { body, tag: "gcvf" });
  };
  var annotateCard = ({ plan, card }, change) => {
    card.classList.toggle("gcvf-oos", plan.qty === 0);
    const badge = changeBadge(change);
    if (badge)
      card.querySelector(sels.header)?.append(badge);
    if (plan.annual === null)
      return;
    const parts = [`${formatMoney(plan.annual)}/yr`];
    if (plan.cores)
      parts.push(`${formatMoney(plan.annual / plan.cores)}/core`);
    if (plan.cpuScore !== null)
      parts.push(`CPU ${plan.cpuScore}`);
    if (plan.ramMb)
      parts.push(`${formatMoney(plan.annual / (plan.ramMb / 1024))}/GB`);
    card.querySelector(sels.pricing)?.append(createElement("div", { className: "gcvf-annual" }, [parts.join(" | ")]));
  };
  var loadState = (plans) => {
    const saved = readJsonStore(STORE_KEY, {});
    return sanitizeState({ ...DEFAULT_STATE, ...saved }, plans);
  };
  var toggleValue = (list, value) => {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  };
  var mount = (entries, remote, products, changes, failed) => {
    const plans = [...entries.map((e) => e.plan), ...remote];
    const columns = buildColumns(changes);
    let state = loadState(plans);
    const bar = createElement("div", { className: "gcvf-bar" });
    const tableWrap = createElement("div", { className: "gcvf-table-wrap" });
    products.before(bar, tableWrap);
    const setState = (patch) => {
      state = { ...state, ...patch };
      writeJsonStore(STORE_KEY, state);
      render();
    };
    const chipRow = (label, key, format) => {
      const options = facetOptions(plans, state, key);
      if (options.length < 2)
        return null;
      const selected = state[key];
      const chips = options.map(({ value, count }) => {
        const chip = createElement("button", { type: "button", className: `gcvf-chip${count ? "" : " gcvf-empty"}` }, [format(value), createElement("small", {}, [String(count)])]);
        chip.setAttribute("aria-pressed", String(selected.includes(value)));
        chip.addEventListener("click", () => setState({ [key]: toggleValue(selected, value) }));
        return chip;
      });
      return createElement("div", { className: "gcvf-row" }, [
        createElement("span", { className: "gcvf-label" }, [label]),
        createElement("div", { className: "gcvf-group" }, chips)
      ]);
    };
    const controlsRow = (shown) => {
      const inStock = createElement("input", { type: "checkbox", checked: state.inStock });
      inStock.addEventListener("change", () => setState({ inStock: inStock.checked }));
      const allGroups = createElement("input", { type: "checkbox", checked: state.allGroups });
      allGroups.addEventListener("change", () => {
        setState({ allGroups: allGroups.checked });
        location.reload();
      });
      const watch = createElement("input", { type: "checkbox", checked: isWatching() });
      watch.addEventListener("change", () => {
        if (!watch.checked) {
          sessionStorage.removeItem(WATCH_KEY);
          location.reload();
          return;
        }
        sessionStorage.setItem(WATCH_KEY, "1");
        Notification.requestPermission?.().finally(scheduleWatch);
      });
      const sort = createElement("select", {}, SORTS.map((s) => createElement("option", { value: s.key, selected: s.key === state.sort }, [s.label])));
      sort.addEventListener("change", () => setState({ sort: sort.value }));
      const numberInput = (label, key, step) => {
        const input = createElement("input", {
          type: "number",
          min: "0",
          step: String(step),
          placeholder: "any",
          value: state[key] === null ? "" : String(state[key])
        });
        input.addEventListener("change", () => {
          const n = parseFloat(input.value);
          setState({ [key]: Number.isFinite(n) ? n : null });
        });
        return createElement("label", { className: "gcvf-toggle" }, [label, input]);
      };
      const reset = createElement("button", { type: "button", className: "gcvf-reset" }, ["reset"]);
      reset.addEventListener("click", () => setState({ ...DEFAULT_STATE }));
      const views = VIEWS.map(({ key, label }) => {
        const btn = createElement("button", { type: "button", className: "gcvf-chip" }, [label]);
        btn.setAttribute("aria-pressed", String(state.view === key));
        btn.addEventListener("click", () => setState({ view: key }));
        return btn;
      });
      return createElement("div", { className: "gcvf-row" }, [
        createElement("div", { className: "gcvf-group" }, views),
        createElement("label", { className: "gcvf-toggle" }, [inStock, "in stock only"]),
        createElement("label", { className: "gcvf-toggle", title: "table view" }, [
          allGroups,
          "all sale pages"
        ]),
        createElement("label", { className: "gcvf-toggle", title: "reload about every minute" }, [
          watch,
          "watch + notify"
        ]),
        createElement("label", { className: "gcvf-toggle" }, ["sort", sort]),
        numberInput("max $/yr", "maxAnnual", 5),
        numberInput("min cores", "minCores", 1),
        numberInput("min RAM GB", "minRamGb", 1),
        numberInput("min disk GB", "minDiskGb", 10),
        reset,
        createElement("span", { className: "gcvf-count" }, [countText(shown, total)]),
        ...failed.length ? [
          createElement("span", { className: "gcvf-warn" }, [
            `could not load ${failed.join(", ")}`
          ])
        ] : []
      ]);
    };
    const changeCounts = [...changes.values()].reduce((acc, c) => {
      if (c)
        acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {});
    const countText = (shown, total) => {
      const notes = Object.entries(changeCounts).map(([c, n]) => `${n} ${c}`);
      const base = `${shown} of ${total} plans`;
      return notes.length ? `${base} (${notes.join(", ")})` : base;
    };
    let total = plans.length;
    const applyCards = () => {
      const order = new Map(sortPlans(plans, state.sort).map((p, i) => [p.id, i]));
      let shown = 0;
      for (const { plan, col } of entries) {
        const visible = matchesFilter(plan, state);
        col.hidden = !visible;
        col.style.order = String(order.get(plan.id) ?? 0);
        if (visible)
          shown += 1;
      }
      return shown;
    };
    const renderTable = () => {
      const head = columns.map((col) => {
        const th = createElement("th", { className: col.numeric ? "gcvf-num" : "" }, [col.label]);
        if (col.sort) {
          const key = col.sort;
          th.classList.add("gcvf-sortable");
          th.classList.toggle("gcvf-sorted", state.sort === key);
          th.title = "sort";
          th.addEventListener("click", () => setState({ sort: state.sort === key ? "page" : key }));
        }
        return th;
      });
      const rows = sortPlans(plans, state.sort).filter((plan) => matchesFilter(plan, state)).map((plan) => createElement("tr", { className: plan.qty === 0 ? "gcvf-oos" : "" }, columns.map((col) => createElement("td", { className: col.numeric ? "gcvf-num" : "" }, [col.cell(plan)]))));
      const table = createElement("table", { className: "gcvf-table" }, [
        createElement("thead", {}, [createElement("tr", {}, head)]),
        createElement("tbody", {}, rows)
      ]);
      tableWrap.replaceChildren(table);
    };
    const render = () => {
      const cardsShown = applyCards();
      const isTable = state.view === "table";
      products.hidden = isTable;
      tableWrap.hidden = !isTable;
      if (isTable)
        renderTable();
      const shown = isTable ? plans.filter((p) => matchesFilter(p, state)).length : cardsShown;
      total = isTable ? plans.length : entries.length;
      const rows = [
        controlsRow(shown),
        chipRow("group", "groups", (v) => v),
        chipRow("country", "countries", (v) => v),
        chipRow("location", "locations", (v) => v),
        chipRow("cores", "cores", formatCores),
        chipRow("RAM", "ramMb", formatRam),
        chipRow("CPU", "families", formatCpuChip),
        chipRow("billing", "cycles", (v) => v)
      ];
      bar.replaceChildren(...rows.filter((r) => r !== null));
    };
    render();
  };
  var main = async () => {
    const products = document.querySelector(sels.products);
    const cards = [...document.querySelectorAll(sels.card)];
    if (!products || !cards.length)
      return;
    injectCSS(STYLE_ID, greencloudvps_plan_filter_default);
    products.classList.add("gcvf-grid");
    document.querySelector("video.video-background")?.pause();
    const here = location.pathname.replace(/\/$/, "");
    const groups = navGroups();
    const navLabel = document.querySelector(`${sels.storeLink}[href="${here}"]`)?.textContent?.trim();
    const label = navLabel || here.split("/").pop() || here;
    const entries = cards.map((card) => {
      const col = card.parentElement !== products ? card.parentElement : card;
      col.classList.add("gcvf-col");
      return { plan: readCard(card, label), col, card };
    });
    const others = readJsonStore(STORE_KEY, {}).allGroups ? groups.filter((g) => g.path !== here) : [];
    const loads = await Promise.all(others.map(fetchGroupPlans));
    const remote = loads.flatMap((load) => load.plans);
    const failed = loads.filter((load) => load.error).map((load) => `${load.label} (${load.error})`);
    const now = Date.now();
    const tracked = [
      trackChanges(here, entries.map((e) => e.plan), now),
      ...others.flatMap((g, i) => loads[i].error ? [] : [trackChanges(g.path, loads[i].plans, now)])
    ];
    const changes = new Map(tracked.flatMap((t) => t.changes));
    const fresh = new Set(tracked.flatMap((t) => t.fresh));
    entries.forEach((e) => annotateCard(e, changes.get(e.plan.id) ?? null));
    const allPlans = [...entries.map((e) => e.plan), ...remote];
    mount(entries, remote, products, changes, failed);
    const state = loadState(allPlans);
    notifyFresh(allPlans.filter((p) => fresh.has(p.id) && p.qty !== 0 && matchesFilter(p, { ...state, inStock: true })));
    scheduleWatch();
  };
  main();
})();
