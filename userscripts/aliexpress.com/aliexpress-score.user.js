// ==UserScript==
// @name                 AliExpress Review Score Color Borders
// @author               AZ
// @description          score, filter, and highlight AliExpress search results
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/aliexpress.com/aliexpress-score.user.js
// @grant                none
// @match                https://www.aliexpress.com/w/*
// @match                https://www.aliexpress.us/w/*
// @match                https://www.aliexpress.com/af/*
// @match                https://www.aliexpress.us/af/*
// @match                https://www.aliexpress.com/wholesale*
// @match                https://www.aliexpress.us/wholesale*
// @match                https://*.aliexpress.com/w/*
// @match                https://*.aliexpress.us/w/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/aliexpress.com/aliexpress-score.user.js
// @version              1.2.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/scoring.ts
  var A = 20;
  var B = 5;
  var Z = 1.28;
  var clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  var starsToP = (stars) => clip((stars - 3) / 2, 0, 1);
  var wilsonLB = (stars, reviewCount) => {
    if (!stars || !reviewCount)
      return 0;
    const p = starsToP(stars);
    const v = reviewCount;
    const n = v + A + B;
    const pHat = (p * v + A) / n;
    const z2 = Z * Z;
    const numerator = pHat + z2 / (2 * n) - Z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * n)) / n);
    const denominator = 1 + z2 / n;
    return numerator / denominator;
  };
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
  var scoreReviewEntries = (entries) => {
    return scoreLowerBoundEntries(entries.map((entry) => ({
      ...entry,
      lb: wilsonLB(entry.stars, entry.reviewCount)
    })));
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
    const multiplier = /k/i.test(trimmed) ? 1000 : 1;
    return Math.round(parseFloat(trimmed.replace(/[,kK]/g, "")) * multiplier);
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

  // src/lib/page-lifecycle.ts
  var KEY = "__lbLocationChangeController__";
  var scheduleListener = (listener) => {
    const nextHref = window.location.href;
    if (nextHref === listener.lastHref)
      return;
    listener.lastHref = nextHref;
    if (listener.timer)
      window.clearTimeout(listener.timer);
    if (listener.debounceMs <= 0) {
      listener.callback();
      return;
    }
    listener.timer = window.setTimeout(() => {
      listener.timer = null;
      listener.callback();
    }, listener.debounceMs);
  };
  var ensureController = () => {
    const existing = window[KEY];
    if (existing)
      return existing;
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    const controller = {
      listeners: new Set,
      pushState,
      replaceState,
      notify: () => {
        controller.listeners.forEach((listener) => {
          scheduleListener(listener);
        });
      },
      restore: () => {
        history.pushState = pushState;
        history.replaceState = replaceState;
        window.removeEventListener("popstate", controller.onPopState);
        if ("navigation" in window) {
          window.navigation.removeEventListener("navigatesuccess", controller.onPopState);
        }
        delete window[KEY];
      },
      onPopState: () => {
        controller.notify();
      }
    };
    history.pushState = (...args) => {
      pushState(...args);
      controller.notify();
    };
    history.replaceState = (...args) => {
      replaceState(...args);
      controller.notify();
    };
    window.addEventListener("popstate", controller.onPopState);
    if ("navigation" in window) {
      window.navigation.addEventListener("navigatesuccess", controller.onPopState);
    }
    window[KEY] = controller;
    return controller;
  };
  var watchLocationChange = (callback, opts) => {
    const controller = ensureController();
    const listener = {
      callback,
      debounceMs: opts?.debounceMs ?? 0,
      lastHref: window.location.href,
      timer: null
    };
    controller.listeners.add(listener);
    return () => {
      if (listener.timer)
        window.clearTimeout(listener.timer);
      controller.listeners.delete(listener);
      if (controller.listeners.size === 0)
        controller.restore();
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

  // src/aliexpress.com/aliexpress-score.helpers.ts
  var parseSoldCount = (text) => {
    if (!text)
      return 0;
    const match = text.match(/(\d[\d,]*(?:\.\d+)?\s*[KkMm]?)\s*\+?\s*sold\b/i);
    if (!match)
      return 0;
    return parseReviewCount(match[1].replace(/\s+/g, ""));
  };
  var extractOrderFromHref = (href) => {
    if (!href)
      return null;
    const match = href.match(/[?&]pdp_ext_f=([^&]+)/i) || href.match(/pdp_ext_f=([^&]+)/i);
    if (!match)
      return null;
    try {
      const json = JSON.parse(decodeURIComponent(match[1]));
      if (json.order == null)
        return null;
      const n = Number(String(json.order).replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    } catch (_e) {
      return null;
    }
  };
  var extractRatingData = (item) => {
    let stars = 0;
    let reviewCount = 0;
    let volumeLabel = "sold";
    const starEl = item.querySelector('[class*="starRating"]');
    const starText = (starEl?.textContent ?? "").trim();
    if (starText) {
      const starMatch = starText.match(/(\d(?:\.\d+)?)/);
      if (starMatch)
        stars = parseFloat(starMatch[1]);
    }
    const itemLink = item.querySelector('a[href*="/item/"]');
    const href = itemLink?.getAttribute("href") ?? itemLink?.href ?? "";
    const orderFromHref = extractOrderFromHref(href) ?? 0;
    const tradeEl = item.querySelector('[class*="trade--"]');
    const tradeText = tradeEl?.textContent ?? item.textContent ?? "";
    const visibleSold = parseSoldCount(tradeText);
    reviewCount = Math.max(orderFromHref, visibleSold);
    volumeLabel = orderFromHref >= visibleSold && orderFromHref > 0 ? "orders" : "sold";
    if (!stars) {
      const itemText = item.textContent ?? "";
      const ratingMatch = itemText.match(/\b(\d(?:\.\d+)?)\s*(?:\n|$)/);
      const nearSold = itemText.match(/(\d(?:\.\d+)?)\s*\n?\s*[0-9,.]+[KkMm]?\+?\s*sold/i);
      if (nearSold)
        stars = parseFloat(nearSold[1]);
      else if (ratingMatch)
        stars = parseFloat(ratingMatch[1]);
    }
    return { stars, reviewCount, volumeLabel };
  };

  // src/aliexpress.com/aliexpress-score.css
  var aliexpress_score_default = `.ae-score-item {
  transition: opacity 120ms ease;
}
.ae-score-item:hover {
  opacity: 1 !important;
}
.ae-score-hidden {
  display: none !important;
}
#ae-score-menu {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 8px 12px;
  margin: 0 0 10px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #fff;
  color: #111;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  font-size: 13px;
  line-height: 1.4;
  width: 100%;
  box-sizing: border-box;
}
#ae-score-menu .ae-menu-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
#ae-score-menu label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
#ae-score-menu input[type='number'],
#ae-score-menu input[type='text'] {
  width: 72px;
  padding: 2px 6px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
}
#ae-score-menu input[type='text'] {
  width: 150px;
}
#ae-score-menu input:invalid {
  border-color: #d32f2f;
}
.ae-keyword-match {
  padding: 0 1px;
  border-radius: 2px;
  background: #ffeb3b;
  color: inherit;
}
.ae-score-pill {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1000;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #000;
  opacity: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
`;

  // src/aliexpress.com/aliexpress-score.user.ts
  var ITEM_CLASS = "ae-score-item";
  var HIDDEN_CLASS = "ae-score-hidden";
  var STYLE_ID = "ae-score-style";
  var MENU_ID = "ae-score-menu";
  var SETTINGS_KEY = "ae-score-settings-v2";
  var RESULT_ITEM_SELECTOR = '[class*="search-item-card-wrapper"], .search-item-card-wrapper-gallery';
  var RESULTS_CONTAINER_SELECTOR = '[class*="galleryWrapper"], [class*="list--gallery"], [class*="list--listWrapper"]';
  var RIGHT_CONTAINER_SELECTOR = '[class*="rightContent2023--rightContainer"]';
  var SORT_CONTAINER_SELECTOR = '[class*="topRefine2023--sortContainer"]';
  var SELECTED_REFINE_SELECTOR = '[class*="selectedRefine2023"]';
  var TITLE_SELECTOR = 'h3[class*="titleText"], h3[class*="title--"]';
  var MATCH_CLASS = "ae-keyword-match";
  var DEFAULT_SETTINGS = {
    sortByScore: false,
    minStars: 0,
    minSold: 0,
    titlePattern: ""
  };
  var nextOrigIndex = 0;
  var observedRoot = null;
  var settings = loadSettings();
  var isSearchRoute = () => {
    const path = window.location.pathname;
    return path.includes("/w/") || path.includes("/af/") || path.startsWith("/wholesale") || /SearchText=/i.test(window.location.search);
  };
  var getResultItems = () => {
    const items = Array.from(document.querySelectorAll(RESULT_ITEM_SELECTOR));
    return items.filter((item) => !item.querySelector(RESULT_ITEM_SELECTOR));
  };
  var getResultsContainer = () => {
    const container = document.querySelector(RESULTS_CONTAINER_SELECTOR);
    if (container)
      return container;
    const firstItem = getResultItems()[0];
    return firstItem?.parentElement ?? null;
  };
  var getResultsColumnChild = (right) => {
    const gallery = getResultsContainer();
    if (!gallery || !right.contains(gallery))
      return null;
    let el = gallery;
    while (el && el.parentElement !== right)
      el = el.parentElement;
    return el?.parentElement === right && el.id !== MENU_ID ? el : null;
  };
  var getMenuMount = () => {
    const right = document.querySelector(RIGHT_CONTAINER_SELECTOR);
    if (right) {
      const resultsChild = getResultsColumnChild(right);
      if (resultsChild)
        return { parent: right, before: resultsChild };
      const selected = right.querySelector(SELECTED_REFINE_SELECTOR);
      if (selected) {
        let before = selected.nextElementSibling;
        while (before?.id === MENU_ID)
          before = before.nextElementSibling;
        return { parent: right, before };
      }
      const sortContainer = right.querySelector(SORT_CONTAINER_SELECTOR);
      const sortWrap = sortContainer?.parentElement;
      if (sortWrap && sortWrap.parentElement === right) {
        let before = sortWrap.nextElementSibling;
        while (before?.id === MENU_ID)
          before = before.nextElementSibling;
        return { parent: right, before };
      }
      return { parent: right, before: null };
    }
    const gallery = getResultsContainer();
    if (gallery?.parentElement) {
      return { parent: gallery.parentElement, before: gallery };
    }
    return null;
  };
  var ensureStyles = () => {
    injectCSS(STYLE_ID, aliexpress_score_default);
  };
  var parseNonNegNumber = (value, fallback) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0)
      return fallback;
    return n;
  };
  function loadSettings() {
    return readJsonStore(SETTINGS_KEY, DEFAULT_SETTINGS, {
      parse: (value) => {
        if (!value || typeof value !== "object")
          return { ...DEFAULT_SETTINGS };
        const raw = value;
        return {
          sortByScore: Boolean(raw.sortByScore),
          minStars: parseNonNegNumber(raw.minStars, 0),
          minSold: parseNonNegNumber(raw.minSold, 0),
          titlePattern: typeof raw.titlePattern === "string" ? raw.titlePattern : ""
        };
      }
    });
  }
  var saveSettings = () => {
    writeJsonStore(SETTINGS_KEY, settings);
  };
  var bindMenuControls = (menu) => {
    const sortToggle = menu.querySelector("#ae-sort-toggle");
    const minStarsInput = menu.querySelector("#ae-min-stars");
    const minSoldInput = menu.querySelector("#ae-min-sold");
    const titlePatternInput = menu.querySelector("#ae-title-pattern");
    if (!sortToggle || !minStarsInput || !minSoldInput || !titlePatternInput)
      return;
    sortToggle.checked = settings.sortByScore;
    minStarsInput.value = String(settings.minStars || "");
    minSoldInput.value = String(settings.minSold || "");
    titlePatternInput.value = settings.titlePattern;
    if (menu.dataset.aeBound === "true")
      return;
    menu.dataset.aeBound = "true";
    sortToggle.addEventListener("change", () => {
      settings.sortByScore = sortToggle.checked;
      saveSettings();
      applySortMode();
    });
    const onFilterChange = () => {
      settings.minStars = parseNonNegNumber(minStarsInput.value, 0);
      settings.minSold = parseNonNegNumber(minSoldInput.value, 0);
      minStarsInput.value = settings.minStars ? String(settings.minStars) : "";
      minSoldInput.value = settings.minSold ? String(settings.minSold) : "";
      saveSettings();
      processResults({ rescore: true });
    };
    minStarsInput.addEventListener("change", onFilterChange);
    minSoldInput.addEventListener("change", onFilterChange);
    titlePatternInput.addEventListener("input", () => {
      settings.titlePattern = titlePatternInput.value;
      titlePatternInput.setCustomValidity(getTitleRegex() ? "" : "Invalid regular expression");
      saveSettings();
      processResults({ rescore: true });
    });
  };
  var ensureMenu = () => {
    const mount = getMenuMount();
    if (!mount)
      return;
    const existing = document.getElementById(MENU_ID);
    if (existing) {
      const placed = existing.parentElement === mount.parent && existing.nextElementSibling === mount.before;
      if (!placed)
        mount.parent.insertBefore(existing, mount.before);
      bindMenuControls(existing);
      return;
    }
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.innerHTML = '<div class="ae-menu-title">AE score</div>' + '<label><input type="checkbox" id="ae-sort-toggle"> sort by score</label>' + '<label>min ★ <input type="number" id="ae-min-stars" min="0" max="5" step="0.1" placeholder="0"></label>' + '<label>min sold <input type="number" id="ae-min-sold" min="0" step="1" placeholder="0"></label>' + '<label>title regex <input type="text" id="ae-title-pattern" placeholder="e.g. usb.?c" spellcheck="false"></label>';
    mount.parent.insertBefore(menu, mount.before);
    bindMenuControls(menu);
  };
  var ensureOrigIndexes = (items) => {
    items.forEach((item) => {
      if (!item.dataset.aeOrigIndex) {
        item.dataset.aeOrigIndex = String(nextOrigIndex++);
      }
    });
  };
  var getItemKey = (item) => item.querySelector('a[href*="/item/"]')?.href ?? item.textContent ?? "";
  var syncItemMeta = (item) => {
    const itemKey = getItemKey(item);
    if (item.dataset.aeItemKey === itemKey && item.dataset.aeStars != null && item.dataset.aeSold != null) {
      return {
        item,
        stars: Number(item.dataset.aeStars) || 0,
        reviewCount: Number(item.dataset.aeSold) || 0,
        volumeLabel: item.dataset.aeVolumeLabel || "sold"
      };
    }
    const { stars, reviewCount, volumeLabel } = extractRatingData(item);
    item.dataset.aeItemKey = itemKey;
    item.dataset.aeStars = String(stars);
    item.dataset.aeSold = String(reviewCount);
    item.dataset.aeVolumeLabel = volumeLabel;
    return { item, stars, reviewCount, volumeLabel };
  };
  var getTitleRegex = () => {
    if (!settings.titlePattern.trim())
      return null;
    try {
      return new RegExp(settings.titlePattern, "i");
    } catch (_e) {
      return null;
    }
  };
  var clearTitleHighlights = (item) => {
    item.querySelectorAll(`.${MATCH_CLASS}`).forEach((match) => {
      match.replaceWith(document.createTextNode(match.textContent ?? ""));
    });
    item.querySelector(TITLE_SELECTOR)?.normalize();
  };
  var highlightTitleMatches = (item, regex) => {
    clearTitleHighlights(item);
    if (!regex)
      return;
    const title = item.querySelector(TITLE_SELECTOR);
    if (!title)
      return;
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const text = node.data;
      const matches = Array.from(text.matchAll(new RegExp(regex.source, "gi")));
      if (!matches.length)
        return;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      matches.forEach((match) => {
        const index = match.index ?? 0;
        if (index > offset)
          fragment.append(text.slice(offset, index));
        const mark = document.createElement("mark");
        mark.className = MATCH_CLASS;
        mark.textContent = match[0];
        fragment.append(mark);
        offset = index + match[0].length;
      });
      if (offset < text.length)
        fragment.append(text.slice(offset));
      node.replaceWith(fragment);
    });
  };
  var passesFilters = (datum, titleRegex) => {
    if (settings.minStars > 0 && datum.stars < settings.minStars)
      return false;
    if (settings.minSold > 0 && datum.reviewCount < settings.minSold)
      return false;
    if (titleRegex) {
      const title = datum.item.querySelector(TITLE_SELECTOR)?.textContent ?? "";
      if (!titleRegex.test(title))
        return false;
    }
    return true;
  };
  var getSortScore = (item) => {
    const val = Number(item.dataset.aeFinal);
    return Number.isFinite(val) ? val : -1;
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
  var applySortMode = () => {
    const items = getResultItems();
    if (!items.length)
      return;
    ensureOrigIndexes(items);
    getItemGroups(items).forEach((groupItems, parent) => {
      const sorted = groupItems.slice().sort((a, b) => {
        if (settings.sortByScore) {
          const scoreDelta = getSortScore(b) - getSortScore(a);
          if (scoreDelta)
            return scoreDelta;
        }
        return Number(a.dataset.aeOrigIndex) - Number(b.dataset.aeOrigIndex);
      });
      let changed = false;
      for (let i = 0;i < groupItems.length; i++) {
        if (groupItems[i] !== sorted[i]) {
          changed = true;
          break;
        }
      }
      if (!changed)
        return;
      const anchor = document.createComment("ae-sort-anchor");
      parent.insertBefore(anchor, groupItems[0]);
      sorted.forEach((item) => parent.insertBefore(item, anchor));
      anchor.remove();
    });
  };
  var clearItemScoreUi = (item) => {
    item.querySelectorAll(".ae-score-pill").forEach((pill) => pill.remove());
    item.classList.remove(ITEM_CLASS);
    item.style.opacity = "";
    item.removeAttribute("title");
    delete item.dataset.aeFinal;
  };
  var applyScoreUi = (d) => {
    clearItemScoreUi(d.item);
    const opacity = 0.3 + 0.7 * d.rel;
    d.item.style.opacity = opacity.toFixed(2);
    d.item.style.position = "relative";
    d.item.classList.add(ITEM_CLASS);
    const color = getColorForScore(d.rel);
    const pill = document.createElement("div");
    pill.className = "ae-score-pill";
    pill.textContent = d.finalStars.toFixed(1) + "★";
    pill.style.background = color;
    d.item.appendChild(pill);
    d.item.title = `${d.stars}★ | ${d.reviewCount} ${d.volumeLabel} | ` + `LB: ${d.lb.toFixed(3)} | Rel: ${d.rel.toFixed(3)} | ` + `Final: ${d.final.toFixed(3)} (${d.finalStars.toFixed(1)}★)`;
    d.item.dataset.aeFinal = d.final.toFixed(6);
  };
  var processResults = (opts) => {
    if (!isSearchRoute())
      return;
    ensureStyles();
    ensureMenu();
    const items = getResultItems();
    if (items.length === 0)
      return;
    ensureOrigIndexes(items);
    const data = items.map(syncItemMeta);
    const titleRegex = getTitleRegex();
    data.forEach((datum) => {
      const pass = passesFilters(datum, titleRegex);
      datum.item.classList.toggle(HIDDEN_CLASS, !pass);
      highlightTitleMatches(datum.item, pass ? titleRegex : null);
      if (!pass)
        clearItemScoreUi(datum.item);
    });
    const visible = data.filter((datum) => passesFilters(datum, titleRegex));
    const needsScore = opts?.rescore ? visible : visible.filter((d) => d.item.dataset.aeFinal == null);
    if (needsScore.length === 0) {
      applySortMode();
      return;
    }
    const scored = scoreReviewEntries(visible);
    scored.forEach(applyScoreUi);
    applySortMode();
    const lbValues = scored.map((d) => d.lb);
    console.log(`[AliExpress Review Colors] Processed ${scored.length}/${items.length} items ` + `(LB range: ${Math.min(...lbValues).toFixed(3)} - ${Math.max(...lbValues).toFixed(3)})`);
  };
  var observer = observeDomChanges(() => processResults(), {
    root: document.body,
    debounceMs: 500,
    shouldRun: (mutations) => mutations.some((m) => {
      const t = m.target;
      if (t instanceof Element && (t.id === MENU_ID || t.closest(`#${MENU_ID}`)))
        return false;
      return true;
    })
  });
  var observeResults = () => {
    const right = document.querySelector(RIGHT_CONTAINER_SELECTOR);
    const target = right ?? getResultsContainer() ?? document.body;
    if (observedRoot === target)
      return;
    observedRoot = target;
    observer.observe(target, { childList: true, subtree: true });
  };
  var boot = () => {
    nextOrigIndex = 0;
    observedRoot = null;
    observeResults();
    processResults({ rescore: true });
    [800, 2000, 4000].forEach((ms) => {
      window.setTimeout(() => {
        observeResults();
        processResults();
      }, ms);
    });
  };
  boot();
  watchLocationChange(boot, { debounceMs: 400 });
})();
