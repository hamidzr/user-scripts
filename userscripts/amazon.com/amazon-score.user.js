// ==UserScript==
// @name                 Amazon Review Score Color Borders
// @author               AZ
// @description          rank Amazon results by a 95% lower bound on star rating, optionally with price
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/amazon.com/amazon-score.user.js
// @grant                none
// @match                https://www.amazon.com/s*
// @match                https://www.amazon.com/*/s*
// @match                https://www.amazon.com/*/b/*
// @match                https://www.amazon.com/b/*
// @match                https://www.amazon.com/gp/bestsellers/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/amazon.com/amazon-score.user.js
// @version              3.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/scoring.ts
  var clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  var boundedMeanLB = (mean, reviewCount, lo, hi, z = 1.645) => {
    if (!mean || !reviewCount)
      return 0;
    const p = clip((mean - lo) / (hi - lo), 0, 1);
    const n = reviewCount;
    const z2 = z * z;
    const numerator = p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
    return numerator / (1 + z2 / n);
  };
  var starMeanLB = (stars, reviewCount, z = 1.645) => boundedMeanLB(stars, reviewCount, 1, 5, z);
  var avgRanks = (values) => {
    const N = values.length;
    if (N <= 1)
      return [0];
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(N);
    let pos = 0;
    while (pos < N) {
      let end = pos + 1;
      while (end < N && indexed[end].v === indexed[pos].v)
        end++;
      const avg = (pos + end - 1) / 2;
      for (let k = pos;k < end; k++)
        ranks[indexed[k].i] = avg;
      pos = end;
    }
    return ranks;
  };
  var scoreToStars = (score) => 1 + 4 * score;
  var computeReviewFinalScore = (lb, rel) => 0.75 * lb + 0.25 * rel;
  var scoreLowerBoundEntries = (entries) => {
    if (!entries.length)
      return [];
    const ranks = avgRanks(entries.map((entry) => entry.lb));
    const total = entries.length;
    return entries.map((entry, index) => {
      const rel = total <= 1 ? 0.5 : ranks[index] / (total - 1);
      const final = computeReviewFinalScore(entry.lb, rel);
      return {
        ...entry,
        rel,
        final,
        finalStars: scoreToStars(final)
      };
    });
  };
  var getColorForScore = (score, maxChannel = 255) => {
    const max = Math.max(0, maxChannel);
    let r, g;
    if (score < 0.5) {
      r = max;
      g = Math.round(score * 2 * max);
    } else {
      r = Math.round((1 - (score - 0.5) * 2) * max);
      g = max;
    }
    return `rgb(${r}, ${g}, 0)`;
  };
  var parseReviewCount = (str) => {
    if (!str)
      return 0;
    const trimmed = str.trim();
    const multiplier = /m/i.test(trimmed) ? 1e6 : /k/i.test(trimmed) ? 1000 : 1;
    return Math.round(parseFloat(trimmed.replace(/[,kKmM]/g, "")) * multiplier);
  };

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

  // src/amazon.com/amazon-score.css
  var amazon_score_default = `.vm-score-item {
  transition: opacity 120ms ease;
}
.vm-score-item:hover {
  opacity: 1 !important;
}
#vm-score-menu {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  margin: 8px 0 12px;
  border: 1px solid #d5d9d9;
  border-radius: 8px;
  background: #fff;
  color: #111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
  font-size: 13px;
  line-height: 1.4;
}
#vm-score-menu .vm-menu-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
}
#vm-score-menu label {
  display: flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
`;

  // src/amazon.com/amazon-score.helpers.ts
  var STARS_RE = /(\d(?:\.\d+)?)\s+out of 5 stars/i;
  var COUNT_RE = /([0-9,.]+[KMk]?)\s+(?:ratings|rating|reviews?|review)\b/i;
  var PAREN_COUNT_RE = /\(([0-9,.]+[KMk]?)\)/;
  var extractRatingData = (item) => {
    let stars = 0;
    let reviewCount = 0;
    const ratingLabel = item.querySelector('[aria-label*="out of 5 stars"]')?.getAttribute("aria-label") ?? "";
    const starsMatch = ratingLabel.match(STARS_RE);
    if (starsMatch)
      stars = parseFloat(starsMatch[1]);
    const labelCount = ratingLabel.match(COUNT_RE);
    if (labelCount)
      reviewCount = parseReviewCount(labelCount[1]);
    const block = item.querySelector('[data-cy="reviews-block"]');
    if (!reviewCount) {
      const countLabel = block?.querySelector('a[aria-label$="ratings"], a[aria-label$="rating"]')?.getAttribute("aria-label") ?? "";
      const m = countLabel.match(COUNT_RE);
      if (m)
        reviewCount = parseReviewCount(m[1]);
    }
    if (!stars || !reviewCount) {
      const text = (block ?? item).textContent ?? "";
      if (!stars) {
        const m = text.match(STARS_RE);
        if (m)
          stars = parseFloat(m[1]);
      }
      if (!reviewCount) {
        const m = text.match(COUNT_RE) ?? text.match(PAREN_COUNT_RE);
        if (m)
          reviewCount = parseReviewCount(m[1]);
      }
    }
    if (!stars || !Number.isFinite(reviewCount))
      return { stars: 0, reviewCount: 0 };
    return { stars, reviewCount };
  };
  var UNIT_PRICE_RE = /\(\$([\d,]+(?:\.\d+)?)(?:\$[\d,.]+)?\s*\/\s*([^)]+)\)/;
  var MONEY_RE = /\$\s*([\d,]+(?:\.\d+)?)/;
  var parseMoney = (text) => {
    const m = (text ?? "").match(MONEY_RE);
    if (!m)
      return null;
    const value = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  var extractPriceData = (item) => {
    const price = parseMoney(item.querySelector(".a-price:not(.a-text-price) .a-offscreen")?.textContent ?? item.querySelector('[class*="p13n-sc-price"], .a-color-price')?.textContent);
    const recipe = item.querySelector('[data-cy="price-recipe"]');
    const unitMatch = (recipe?.textContent ?? "").match(UNIT_PRICE_RE);
    const unitPrice = unitMatch ? parseFloat(unitMatch[1].replace(/,/g, "")) : null;
    return {
      price,
      unitPrice: unitPrice && Number.isFinite(unitPrice) ? unitPrice : null,
      unit: unitMatch ? unitMatch[2].trim().toLowerCase().replace(/\s+/g, " ") : null
    };
  };
  var median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  var MIN_PRICE_PEERS = 3;
  var MAX_UNIT_DISAGREEMENT = 50;
  var computePriceRatios = (prices) => {
    const itemPrices = prices.flatMap((p) => p?.price ? [p.price] : []);
    const itemMedian = itemPrices.length >= MIN_PRICE_PEERS ? median(itemPrices) : null;
    const byUnit = new Map;
    prices.forEach((p) => {
      if (!p?.unit || !p.unitPrice)
        return;
      byUnit.set(p.unit, [...byUnit.get(p.unit) ?? [], p.unitPrice]);
    });
    const unitMedians = new Map;
    byUnit.forEach((values, unit) => {
      if (values.length >= MIN_PRICE_PEERS)
        unitMedians.set(unit, median(values));
    });
    return prices.map((p) => {
      const itemRatio = p?.price && itemMedian ? p.price / itemMedian : null;
      const unitMedian = p?.unit ? unitMedians.get(p.unit) : undefined;
      const unitRatio = p?.unitPrice && unitMedian ? p.unitPrice / unitMedian : null;
      if (unitRatio === null)
        return itemRatio;
      if (itemRatio === null)
        return unitRatio;
      const disagreement = Math.max(unitRatio / itemRatio, itemRatio / unitRatio);
      return disagreement > MAX_UNIT_DISAGREEMENT ? itemRatio : unitRatio;
    });
  };
  var FLOOR_STARS = 4.3;
  var NUDGE_PER_DOUBLING = 0.15;
  var NUDGE_CAP = 0.5;
  var BLEND_PRICE_WEIGHT = 0.3;
  var SORT_MODES = [
    { id: "nudge", label: "Rating + price (recommended)" },
    { id: "rating", label: "Rating only" },
    { id: "blend", label: "Rating + price rank" },
    { id: "floor", label: `Cheapest rated ${FLOOR_STARS}+` },
    { id: "amazon", label: "Amazon order" }
  ];
  var DEFAULT_SORT_MODE = "nudge";
  var parseSortMode = (value) => {
    if (!value || typeof value !== "object")
      return DEFAULT_SORT_MODE;
    const raw = value;
    const known = SORT_MODES.find((m) => m.id === raw.sortMode);
    if (known)
      return known.id;
    return raw.sortByScore === true ? "rating" : DEFAULT_SORT_MODE;
  };
  var isPriceMode = (mode) => mode === "nudge" || mode === "blend" || mode === "floor";
  var nudgeStars = (lbStars, ratio) => {
    if (ratio === null || ratio <= 0)
      return lbStars;
    const shift = -NUDGE_PER_DOUBLING * Math.log2(ratio);
    return lbStars + Math.max(-NUDGE_CAP, Math.min(NUDGE_CAP, shift));
  };
  var prepareRankRows = (inputs) => {
    const ratios = computePriceRatios(inputs.map((d) => d.lbStars === null ? null : d.price));
    const priced = ratios.flatMap((r, i) => r === null ? [] : [{ r, i }]);
    priced.sort((a, b) => a.r - b.r);
    const priceRel = new Array(inputs.length).fill(0.5);
    priced.forEach((d, rank) => {
      priceRel[d.i] = priced.length <= 1 ? 0.5 : 1 - rank / (priced.length - 1);
    });
    return inputs.map((d, i) => ({ ...d, ratio: ratios[i], priceRel: priceRel[i] }));
  };
  var sortValue = (row, mode) => {
    const lb = row.lbStars;
    if (mode === "nudge")
      return nudgeStars(lb, row.ratio);
    if (mode === "blend")
      return (1 - BLEND_PRICE_WEIGHT) * ((lb - 1) / 4) + BLEND_PRICE_WEIGHT * row.priceRel;
    return lb;
  };
  var compareRows = (mode) => (a, b) => {
    if (mode === "amazon")
      return a.orig - b.orig;
    if (a.lbStars === null || b.lbStars === null) {
      if (a.lbStars !== b.lbStars)
        return a.lbStars === null ? 1 : -1;
      return a.orig - b.orig;
    }
    if (mode === "floor") {
      const aPass = a.lbStars >= FLOOR_STARS;
      const bPass = b.lbStars >= FLOOR_STARS;
      if (aPass !== bPass)
        return aPass ? -1 : 1;
      if (aPass) {
        const ar = a.ratio ?? Infinity;
        const br = b.ratio ?? Infinity;
        if (ar !== br)
          return ar - br;
        return a.orig - b.orig;
      }
    }
    return sortValue(b, mode) - sortValue(a, mode) || a.orig - b.orig;
  };

  // src/amazon.com/amazon-score.user.ts
  var ITEM_CLASS = "vm-score-item";
  var STYLE_ID = "vm-score-style";
  var MENU_ID = "vm-score-menu";
  var SETTINGS_KEY = "vm-score-settings-v1";
  var SEARCH_RESULT_SELECTOR = '[data-component-type="s-search-result"]';
  var BESTSELLER_RESULT_SELECTOR = '[id="gridItemRoot"], div[class*="_cDEzb_grid-cell_"]';
  var RESULT_ITEM_SELECTOR = `${SEARCH_RESULT_SELECTOR}, ${BESTSELLER_RESULT_SELECTOR}`;
  var nextOrigIndex = 0;
  var settings = loadSettings();
  var getResultItems = () => {
    const items = Array.from(document.querySelectorAll(RESULT_ITEM_SELECTOR));
    return items.filter((item) => !item.querySelector(RESULT_ITEM_SELECTOR));
  };
  var getResultsContainer = () => {
    const searchResultsContainer = document.querySelector('[data-component-type="s-search-results"]');
    if (searchResultsContainer)
      return searchResultsContainer;
    const firstItem = getResultItems()[0];
    if (!firstItem)
      return null;
    return firstItem.closest("#zg") || firstItem.closest("main") || firstItem.parentElement;
  };
  var ensureStyles = () => {
    injectCSS(STYLE_ID, amazon_score_default);
  };
  function loadSettings() {
    return readJsonStore(SETTINGS_KEY, { sortMode: parseSortMode(null) }, { parse: (value) => ({ sortMode: parseSortMode(value) }) });
  }
  var saveSettings = () => {
    writeJsonStore(SETTINGS_KEY, settings);
  };
  var ensureMenu = () => {
    const firstItem = getResultItems()[0];
    if (!firstItem?.parentElement)
      return;
    const parent = firstItem.parentElement;
    const existing = document.getElementById(MENU_ID);
    if (existing) {
      if (existing.parentElement !== parent)
        parent.insertBefore(existing, firstItem);
      return;
    }
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.innerHTML = '<div class="vm-menu-title">VM score options</div>' + '<label>sort by <select id="vm-sort-mode"></select></label>';
    parent.insertBefore(menu, firstItem);
    const select = menu.querySelector("#vm-sort-mode");
    SORT_MODES.forEach((mode) => select.add(new Option(mode.label, mode.id)));
    select.value = settings.sortMode;
    select.addEventListener("change", () => {
      settings.sortMode = parseSortMode({ sortMode: select.value });
      saveSettings();
      applySortMode();
    });
  };
  var ensureOrigIndexes = (items) => {
    items.forEach((item) => {
      if (!item.dataset.vmOrigIndex) {
        item.dataset.vmOrigIndex = String(nextOrigIndex++);
      }
    });
  };
  var getItemGroups = (items) => {
    const groups = new Map;
    items.forEach((item) => {
      const parent = item.parentElement;
      if (!parent)
        return;
      const arr = groups.get(parent) || [];
      arr.push(item);
      groups.set(parent, arr);
    });
    return groups;
  };
  var formatRatio = (ratio) => ratio.toFixed(ratio < 0.1 ? 2 : 1) + "x";
  var setText = (el, text) => {
    if (el && el.textContent !== text)
      el.textContent = text;
  };
  var applyPriceLabels = (item, ratio, lbStars) => {
    const showPrice = isPriceMode(settings.sortMode) && ratio !== null;
    setText(item.querySelector(".vm-pill-price"), showPrice ? ` · ${formatRatio(ratio)}` : "");
    let title = item.dataset.vmTitleBase ?? "";
    if (ratio !== null)
      title += ` | price: ${formatRatio(ratio)} page median`;
    if (ratio !== null && settings.sortMode === "nudge") {
      title += ` | with price: ${nudgeStars(lbStars, ratio).toFixed(2)}★`;
    }
    if (item.title !== title)
      item.title = title;
  };
  var applySortMode = () => {
    const items = getResultItems();
    if (!items.length)
      return;
    ensureOrigIndexes(items);
    const rows = prepareRankRows(items.map((item) => ({
      lbStars: item.dataset.vmLb ? scoreToStars(Number(item.dataset.vmLb)) : null,
      price: extractPriceData(item),
      orig: Number(item.dataset.vmOrigIndex)
    })));
    const rowByItem = new Map(items.map((item, i) => [item, rows[i]]));
    rows.forEach((row, i) => {
      if (row.lbStars !== null)
        applyPriceLabels(items[i], row.ratio, row.lbStars);
    });
    const compare = compareRows(settings.sortMode);
    getItemGroups(items).forEach((groupItems, parent) => {
      const sorted = groupItems.slice().sort((a, b) => compare(rowByItem.get(a), rowByItem.get(b)));
      let changed = false;
      for (let i = 0;i < groupItems.length; i++) {
        if (groupItems[i] !== sorted[i]) {
          changed = true;
          break;
        }
      }
      if (!changed)
        return;
      const anchor = document.createComment("vm-sort-anchor");
      parent.insertBefore(anchor, groupItems[0]);
      sorted.forEach((item) => parent.insertBefore(item, anchor));
      anchor.remove();
    });
  };
  var processResults = () => {
    ensureStyles();
    ensureMenu();
    const items = getResultItems();
    if (items.length === 0)
      return;
    ensureOrigIndexes(items);
    const pending = [];
    items.forEach((item) => {
      if (item.dataset.vmProcessed === "true")
        return;
      if (item.offsetParent === null || window.getComputedStyle(item).display === "none" || window.getComputedStyle(item).visibility === "hidden") {
        return;
      }
      const { stars, reviewCount } = extractRatingData(item);
      pending.push({ item, stars, reviewCount });
    });
    if (pending.length === 0) {
      applySortMode();
      return;
    }
    const itemData = scoreLowerBoundEntries(pending.map((d) => ({ ...d, lb: starMeanLB(d.stars, d.reviewCount) })));
    const N = itemData.length;
    const lbValues = itemData.map((d) => d.lb);
    itemData.forEach((d) => {
      const opacity = 0.3 + 0.7 * d.rel;
      d.item.style.opacity = opacity.toFixed(2);
      d.item.style.position = "relative";
      d.item.classList.add(ITEM_CLASS);
      const color = getColorForScore(d.rel);
      const pill = document.createElement("div");
      pill.className = "vm-score-pill";
      const lbStars = scoreToStars(d.lb);
      pill.innerHTML = '<span class="vm-pill-stars"></span><span class="vm-pill-price"></span>';
      setText(pill.firstElementChild, lbStars.toFixed(1) + "★");
      pill.style.cssText = "position:absolute;top:4px;right:4px;z-index:1000;" + "padding:3px 8px;border-radius:12px;font-size:12px;font-weight:bold;" + "color:#000;opacity:1;box-shadow:0 1px 3px rgba(0,0,0,0.25);" + "background:" + color;
      d.item.appendChild(pill);
      d.item.dataset.vmTitleBase = `${d.stars}★ | ${d.reviewCount} ratings | ` + `95% lower bound: ${lbStars.toFixed(2)}★ | page rank: ${d.rel.toFixed(3)}`;
      d.item.dataset.vmLb = d.lb.toFixed(6);
      d.item.dataset.vmProcessed = "true";
    });
    applySortMode();
    console.log(`[Amazon Review Colors] Processed ${N} items ` + `(LB range: ${Math.min(...lbValues).toFixed(3)} - ${Math.max(...lbValues).toFixed(3)})`);
  };
  processResults();
  var resultsContainer = getResultsContainer();
  if (resultsContainer) {
    const amzObserver = observeDomChanges(processResults, {
      root: resultsContainer,
      debounceMs: 500
    });
    amzObserver.observe(resultsContainer, { childList: true, subtree: true });
  }
})();
