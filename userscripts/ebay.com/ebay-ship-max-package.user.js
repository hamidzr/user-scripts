// ==UserScript==
// @name                 eBay Label Max Package
// @author               AZ
// @description          find the largest weight and dimensions that keep the selected label price
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-ship-max-package.user.js
// @grant                none
// @match                https://www.ebay.com/ship/single/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-ship-max-package.user.js
// @version              0.2.0
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

  // src/lib/dom-observe.ts
  var DEFAULT_INIT = {
    childList: true,
    subtree: true
  };
  var observeDomChanges = (run, opts) => {
    let timer = null;
    let disconnectTimer = null;
    let currentTarget = opts?.root ?? null;
    let currentInit = opts?.observerInit ?? DEFAULT_INIT;
    const disconnect = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (disconnectTimer) {
        window.clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      observer.disconnect();
    };
    const refreshDisconnectTimer = () => {
      if (disconnectTimer)
        window.clearTimeout(disconnectTimer);
      if (!opts?.disconnectAfterMs)
        return;
      disconnectTimer = window.setTimeout(() => {
        disconnect();
      }, opts.disconnectAfterMs);
    };
    const scheduleRun = () => {
      if (timer)
        window.clearTimeout(timer);
      const debounceMs = opts?.debounceMs ?? 0;
      if (debounceMs <= 0) {
        run();
        refreshDisconnectTimer();
        return;
      }
      timer = window.setTimeout(() => {
        timer = null;
        run();
        refreshDisconnectTimer();
      }, debounceMs);
    };
    const observer = new MutationObserver((mutations) => {
      if (opts?.shouldRun && !opts.shouldRun(mutations))
        return;
      scheduleRun();
    });
    const observe = (target, options) => {
      const nextTarget = target ?? currentTarget ?? document.body;
      if (!nextTarget)
        return;
      currentTarget = nextTarget;
      currentInit = options ?? currentInit;
      observer.disconnect();
      observer.observe(nextTarget, currentInit);
      refreshDisconnectTimer();
    };
    if (opts?.runImmediately)
      scheduleRun();
    return {
      disconnect,
      observe
    };
  };

  // src/lib/page-lifecycle.ts
  var runWhenReady = (fn) => {
    if (document.body) {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  };

  // src/ebay.com/ebay-ship-max-package.helpers.ts
  var DEFAULT_WEIGHT_CAP_OZ = 150 * 16;
  var DEFAULT_DIM_CAP_IN = 108;
  var rateKey = (rate) => [
    rate.shippingCarrierCode,
    rate.shippingServiceCode,
    rate.shippingPackageCode,
    rate.pickupType ?? ""
  ].join("-");
  var findRate = (quote, key) => quote.rates?.find((r) => rateKey(r) === key) ?? null;
  var ratePriceCents = (rate) => {
    const value = rate?.baseShippingCost?.value;
    if (value == null)
      return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  var toOunces = (m) => {
    const n = Number(m?.value);
    if (!m?.value || !Number.isFinite(n) || n <= 0)
      return null;
    const unit = (m.unit ?? "").toUpperCase();
    if (unit === "OUNCE")
      return n;
    if (unit === "POUND")
      return n * 16;
    if (unit === "KILOGRAM")
      return n * 35.274;
    if (unit === "GRAM")
      return n * 0.035274;
    return null;
  };
  var weightCapOz = (rate) => Math.floor(toOunces(rate.packageLimits?.weight) ?? DEFAULT_WEIGHT_CAP_OZ);
  var dimCapIn = (rate) => {
    const fromLimits = Number(rate.packageLimits?.dimensions?.length);
    const longest = Number(rate.maxLongestDimension?.value);
    const cap = Math.max(Number.isFinite(fromLimits) ? fromLimits : 0, Number.isFinite(longest) ? longest : 0);
    return Math.floor(cap > 0 ? cap : DEFAULT_DIM_CAP_IN);
  };
  var fmtNum = (n) => String(Math.round(n * 100) / 100);
  var toPackageSpec = (size, base) => ({
    ...base,
    weight: { ...base?.weight, value: fmtNum(size.weightOz), unit: "OUNCE", source: "USER" },
    dimensions: {
      ...base?.dimensions,
      length: fmtNum(size.length),
      width: fmtNum(size.width),
      height: fmtNum(size.height),
      unit: "INCH",
      source: "USER"
    }
  });
  var withPackageSize = (body, size) => {
    const parsed = JSON.parse(body);
    parsed.packageSpecification = toPackageSpec(size, parsed.packageSpecification);
    return JSON.stringify(parsed);
  };
  var formatWeight = (oz) => {
    const lb = Math.floor(oz / 16);
    const rest = Math.round((oz - lb * 16) * 100) / 100;
    if (!lb)
      return `${rest} oz`;
    return rest ? `${lb} lb ${rest} oz` : `${lb} lb`;
  };
  var splitWeight = (oz) => {
    const lb = Math.floor(oz / 16);
    return { lb, oz: Math.round((oz - lb * 16) * 100) / 100 };
  };
  var nextProbes = (lo, hi, step, growing, width) => {
    const raw = growing ? Array.from({ length: width }, (_, i) => lo + step * 2 ** i) : Array.from({ length: width }, (_, i) => lo + Math.ceil((hi - lo) * (i + 1) / (width + 1)));
    return [...new Set(raw)].filter((v) => v > lo && v < hi);
  };
  var findMaxSame = async (start, cap, isSame, width = 4) => {
    let lo = start;
    let hi = cap + 1;
    let step = 1;
    let growing = true;
    while (hi - lo > 1) {
      let probes = nextProbes(lo, hi, step, growing, width);
      if (!probes.length && growing) {
        growing = false;
        probes = nextProbes(lo, hi, step, growing, width);
      }
      if (!probes.length)
        break;
      const results = await Promise.all(probes.map(isSame));
      const firstBad = results.indexOf(false);
      if (firstBad === -1) {
        lo = probes[probes.length - 1];
        step *= 2 ** width;
      } else {
        hi = probes[firstBad];
        if (firstBad > 0)
          lo = probes[firstBad - 1];
        growing = false;
      }
    }
    return lo;
  };
  var DIMS = ["length", "width", "height"];
  var expandDimsEvenly = async (start, cap, isSame) => {
    let size = { ...start };
    let active = [...DIMS];
    const grow = (dims, by) => {
      const next = { ...size };
      for (const d of dims)
        next[d] += by;
      return next;
    };
    for (;; ) {
      active = active.filter((d) => size[d] + 1 <= cap);
      if (!active.length)
        return size;
      const longest = Math.max(...active.map((d) => size[d]));
      const by = await findMaxSame(0, cap - longest, (b) => isSame(grow(active, b)));
      size = grow(active, by);
      const room = active.filter((d) => size[d] + 1 <= cap);
      const fits = await Promise.all(room.map((d) => isSame(grow([d], 1))));
      active = room.filter((_, i) => fits[i]);
      const smallest = [...active].sort((a, b) => size[a] - size[b])[0];
      if (!smallest)
        return size;
      size = grow([smallest], 1);
    }
  };

  // src/ebay.com/ebay-ship-max-package.user.ts
  var PANEL_ID = "ebay-max-pkg";
  var STYLE_ID = "ebay-max-pkg-style";
  var QUOTES_PATH = "/ship/single/api/label-service/quotes";
  var sels = {
    form: "form#customWeightAndDimsPage",
    lb: 'input[aria-label="Package weight in pounds"]',
    oz: 'input[aria-label="Package weight in ounces"]',
    length: 'input[aria-label="Package length in inches"]',
    width: 'input[aria-label="Package width in inches"]',
    height: 'input[aria-label="Package height in inches"]',
    service: 'input[name="service"]:checked'
  };
  var FIELDS = [
    { field: "weightOz", label: "Weight" },
    { field: "length", label: "Length" },
    { field: "width", label: "Width" },
    { field: "height", label: "Height" }
  ];
  var CSS = `
#${PANEL_ID} { margin: 12px 0; padding: 10px 12px; border: 1px solid #c7c7c7; border-radius: 8px;
  font-size: 14px; background: #f7f9fc; }
#${PANEL_ID} button { margin-right: 8px; padding: 4px 12px; border-radius: 16px; border: 1px solid #3665f3;
  background: #fff; color: #3665f3; cursor: pointer; font-weight: 600; }
#${PANEL_ID} button.primary { background: #3665f3; color: #fff; }
#${PANEL_ID} button:disabled { opacity: 0.5; cursor: default; }
#${PANEL_ID} .status { margin-top: 6px; color: #555; }
#${PANEL_ID} .status.error { color: #c00; }
#${PANEL_ID} table { margin-top: 8px; border-collapse: collapse; }
#${PANEL_ID} td { padding: 2px 12px 2px 0; }
#${PANEL_ID} td.up { color: #0a7d32; font-weight: 600; }
`;
  var lastQuote = null;
  var _fetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const [input, init] = args;
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes(QUOTES_PATH) && typeof init?.body === "string") {
      lastQuote = { url, body: init.body };
    }
    return _fetch(...args);
  };
  var fetchQuote = async (size) => {
    if (!lastQuote)
      throw new Error("no quote request captured yet");
    const res = await _fetch(lastQuote.url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: withPackageSize(lastQuote.body, size)
    });
    if (!res.ok)
      throw new Error(`quote request failed: ${res.status}`);
    return res.json();
  };
  var inputEl = (sel) => document.querySelector(sel);
  var readNum = (sel) => Number(inputEl(sel)?.value || 0);
  var readSize = () => ({
    weightOz: readNum(sels.lb) * 16 + readNum(sels.oz),
    length: readNum(sels.length),
    width: readNum(sels.width),
    height: readNum(sels.height)
  });
  var setInput = (sel, value) => {
    const el = inputEl(sel);
    if (!el)
      return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  var applySize = (size) => {
    const { lb, oz } = splitWeight(size.weightOz);
    setInput(sels.lb, lb);
    setInput(sels.oz, oz);
    setInput(sels.length, size.length);
    setInput(sels.width, size.width);
    setInput(sels.height, size.height);
    document.querySelector(sels.form)?.requestSubmit();
  };
  var running = false;
  var status = null;
  var result = null;
  var serviceLabel = (radio) => radio.closest("tr")?.querySelector("label")?.textContent?.trim() || radio.id;
  var runSearch = async () => {
    const radio = inputEl(sels.service);
    if (!radio)
      throw new Error("select a shipping service first");
    if (!lastQuote)
      throw new Error("no quote captured yet, reload the page");
    const key = radio.id;
    const from = readSize();
    const cache = new Map;
    const priceFor = (size) => {
      const id = JSON.stringify(size);
      let p = cache.get(id);
      if (!p) {
        p = fetchQuote(size).then((q) => ratePriceCents(findRate(q, key)));
        cache.set(id, p);
      }
      return p;
    };
    const baseQuote = await fetchQuote(from);
    const rate = findRate(baseQuote, key);
    const price = ratePriceCents(rate);
    if (!rate || price == null)
      throw new Error("selected service has no price for this package");
    cache.set(JSON.stringify(from), Promise.resolve(price));
    const isSame = async (size) => await priceFor(size) === price;
    setStatus("checking weight...");
    const weightOz = await findMaxSame(from.weightOz, weightCapOz(rate), (v) => isSame({ ...from, weightOz: v }));
    setStatus(`checking dimensions... (${cache.size} quotes)`);
    const to = await expandDimsEvenly({ ...from, weightOz }, dimCapIn(rate), isSame);
    result = { serviceLabel: serviceLabel(radio), price, from, to, quotes: cache.size };
    status = null;
  };
  var fmtField = (field, v) => field === "weightOz" ? formatWeight(v) : `${v} in`;
  var fmtDelta = (field, d) => !d ? "" : field === "weightOz" ? `+${formatWeight(d)}` : `+${Math.round(d * 100) / 100} in`;
  var renderResult = (r) => {
    const rows = FIELDS.map(({ field, label }) => {
      const d = r.to[field] - r.from[field];
      return createElement("tr", {}, [
        createElement("td", {}, [label]),
        createElement("td", {}, [fmtField(field, r.from[field])]),
        createElement("td", {}, ["->"]),
        createElement("td", { className: d ? "up" : "" }, [fmtField(field, r.to[field])]),
        createElement("td", {}, [fmtDelta(field, d)])
      ]);
    });
    const apply = createElement("button", { type: "button", className: "primary" }, ["Apply max"]);
    apply.addEventListener("click", () => applySize(r.to));
    return createElement("div", {}, [
      createElement("div", { className: "status" }, [
        `${r.serviceLabel} stays $${(r.price / 100).toFixed(2)} up to these values together ` + `(${r.quotes} quotes). Weight is maxed first, then all sides grow evenly.`
      ]),
      createElement("table", {}, rows),
      apply
    ]);
  };
  var render = () => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel)
      return;
    const find = createElement("button", { type: "button", disabled: running }, [
      running ? "Searching..." : "Find max at same price"
    ]);
    find.addEventListener("click", () => {
      onFind();
    });
    const children = [find];
    if (status) {
      children.push(createElement("div", { className: status.error ? "status error" : "status" }, [status.text]));
    }
    if (result && !running)
      children.push(renderResult(result));
    panel.replaceChildren(...children);
  };
  var setStatus = (text, error = false) => {
    status = { text, error };
    render();
  };
  var onFind = async () => {
    if (running)
      return;
    running = true;
    result = null;
    setStatus("getting current price...");
    try {
      await runSearch();
    } catch (e) {
      status = { text: e instanceof Error ? e.message : String(e), error: true };
    } finally {
      running = false;
      render();
    }
  };
  var mount = () => {
    const form = document.querySelector(sels.form);
    if (!form || document.getElementById(PANEL_ID))
      return;
    form.after(createElement("div", { id: PANEL_ID }));
    render();
  };
  runWhenReady(() => {
    injectCSS(STYLE_ID, CSS);
    observeDomChanges(mount, { debounceMs: 200, runImmediately: true }).observe(document.body);
  });
})();
