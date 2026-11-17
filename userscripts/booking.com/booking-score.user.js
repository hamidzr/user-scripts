// ==UserScript==
// @name                 Booking Listing Score
// @author               AZ
// @description          conservative review-count-aware scores for Booking.com list cards and map pins, with score and value sorting
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-score.user.js
// @grant                none
// @license              MIT
// @match                https://www.booking.com/searchresults.html*
// @namespace            https://latentbyte.com/products
// @run-at               document-body
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-score.user.js
// @version              0.3.0
// ==/UserScript==

'use strict';
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap).get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function") {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
    }
    __moduleCache.set(from, entry);
    return entry;
  };
  var __moduleCache;

  // src/booking.com/booking-score.user.ts
  var exports_booking_score_user = {};

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
  var runWhenReady = (fn) => {
    if (document.body) {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  };
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
  var scoreToScale = (score, lo, hi) => lo + (hi - lo) * score;
  var scoreToStars = (score) => scoreToScale(score, 1, 5);
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
  var scoreScaledRatingEntries = (entries, lo, hi) => scoreLowerBoundEntries(entries.map((entry) => ({
    ...entry,
    lb: boundedMeanLB(entry.rating, entry.reviewCount, lo, hi)
  })));
  var median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  var PRICE_SHIFT_PER_DOUBLING = 0.0375;
  var PRICE_SHIFT_CAP = 0.125;
  var priceShift = (ratio) => {
    if (ratio === null || ratio <= 0)
      return 0;
    const shift = -PRICE_SHIFT_PER_DOUBLING * Math.log2(ratio);
    return clip(shift, -PRICE_SHIFT_CAP, PRICE_SHIFT_CAP);
  };
  var medianPriceRatios = (prices, minPeers = 3) => {
    const known = prices.filter((price) => price !== null && price > 0);
    if (known.length < minPeers)
      return prices.map(() => null);
    const mid = median(known);
    return prices.map((price) => price !== null && price > 0 ? price / mid : null);
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
  var readTextStore = (key, fallback, opts) => {
    const value = readRawStore(key, opts);
    return value === null ? fallback : value;
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

  // src/lib/listing-sort.ts
  var LISTING_SORT_MODES = [
    { id: "site", label: "Site order" },
    { id: "score", label: "Score" },
    { id: "value", label: "Score + price" }
  ];
  var parseListingSortMode = (value) => LISTING_SORT_MODES.find((mode) => mode.id === value)?.id ?? "site";
  var readListingSortMode = (storeKey) => parseListingSortMode(readTextStore(storeKey, "site"));
  var listingSortValue = (lb, priceRatio, mode) => {
    if (lb === null)
      return null;
    return mode === "value" ? lb + priceShift(priceRatio) : lb;
  };
  var computeChildOrder = (children) => {
    const rowIndexes = children.flatMap((child, i) => child.isRow ? [i] : []);
    const firstRow = rowIndexes[0] ?? children.length;
    const ranked = rowIndexes.slice().sort((a, b) => {
      const va = children[a].value;
      const vb = children[b].value;
      if (va === null || vb === null)
        return va === vb ? a - b : va === null ? 1 : -1;
      return vb - va || a - b;
    });
    const rank = new Map(ranked.map((index, position) => [index, position]));
    return children.map((child, i) => {
      if (child.isRow)
        return rank.get(i);
      return i < firstRow ? i - firstRow : rowIndexes.length + i;
    });
  };
  var ORDER_ATTR = "data-lb-sort";
  var FLEX_ATTR = "data-lb-sort-flex";
  var CONTROL_STYLE_ID = "lb-listing-sort-style";
  var CONTROL_CSS = `
  .lb-listing-sort {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 2147483000;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 999px;
    background: #fff;
    color: #1a1a1a;
    font: 600 12px/1.2 system-ui, sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  }

  .lb-listing-sort select {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
`;
  var containsCard = (el, cardSel) => el.matches(cardSel) || el.querySelector(cardSel) !== null;
  var findRow = (card, cardSel) => {
    let el = card;
    while (el.parentElement && el.parentElement !== document.body) {
      const parent = el.parentElement;
      let cardChildren = 0;
      for (const child of Array.from(parent.children)) {
        if (containsCard(child, cardSel) && ++cardChildren >= 2)
          return el;
      }
      el = parent;
    }
    return null;
  };
  var setOrder = (el, order) => {
    if (el.style.order !== order)
      el.style.order = order;
    if (!el.hasAttribute(ORDER_ATTR))
      el.setAttribute(ORDER_ATTR, "");
  };
  var clearOrder = () => {
    document.querySelectorAll(`[${ORDER_ATTR}]`).forEach((el) => {
      el.style.order = "";
      el.removeAttribute(ORDER_ATTR);
    });
    document.querySelectorAll(`[${FLEX_ATTR}]`).forEach((el) => {
      el.style.display = "";
      el.style.flexDirection = "";
      el.removeAttribute(FLEX_ATTR);
    });
  };
  var ensureOrderable = (container) => {
    if (container.hasAttribute(FLEX_ATTR))
      return true;
    const display = getComputedStyle(container).display;
    if (/flex|grid/.test(display))
      return true;
    if (display !== "block")
      return false;
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.setAttribute(FLEX_ATTR, "");
    return true;
  };
  var applyListingOrder = (cards, cardSel, mode) => {
    if (mode === "site") {
      clearOrder();
      return;
    }
    const rowValues = new Map;
    cards.forEach(({ card, value }) => {
      const row = findRow(card, cardSel);
      if (!row)
        return;
      const prev = rowValues.get(row);
      rowValues.set(row, prev === undefined || prev === null ? value : Math.max(prev, value ?? prev));
    });
    const containers = new Set(Array.from(rowValues.keys()).flatMap((row) => row.parentElement ? [row.parentElement] : []));
    containers.forEach((container) => {
      if (!ensureOrderable(container))
        return;
      const children = Array.from(container.children);
      const orders = computeChildOrder(children.map((child) => ({
        isRow: rowValues.has(child),
        value: rowValues.get(child) ?? null
      })));
      children.forEach((child, i) => setOrder(child, String(orders[i])));
    });
  };
  var ensureListingSortControl = (storeKey, onChange) => {
    const id = `${storeKey}-control`;
    if (document.getElementById(id))
      return;
    injectCSS(CONTROL_STYLE_ID, CONTROL_CSS);
    const label = document.createElement("label");
    label.id = id;
    label.className = "lb-listing-sort";
    label.append("Sort by");
    const select = document.createElement("select");
    LISTING_SORT_MODES.forEach((mode) => {
      const option = document.createElement("option");
      option.value = mode.id;
      option.textContent = mode.label;
      select.appendChild(option);
    });
    select.value = readListingSortMode(storeKey);
    select.addEventListener("change", () => {
      writeTextStore(storeKey, select.value);
      onChange();
    });
    label.appendChild(select);
    document.body.appendChild(label);
  };

  // src/lib/score-pill.ts
  var setTextIfChanged = (el, text) => {
    if (el.textContent !== text)
      el.textContent = text;
  };
  var setAttrIfChanged = (el, name, value) => {
    if (el.getAttribute(name) !== value)
      el.setAttribute(name, value);
  };
  var upsertScorePill = (container, insert, opts) => {
    let pill = container.querySelector(`.${opts.className}`);
    if (!pill) {
      pill = document.createElement("span");
      pill.className = opts.className;
      insert(pill);
    }
    setTextIfChanged(pill, opts.text);
    setAttrIfChanged(pill, "title", opts.title);
    setAttrIfChanged(pill, "style", `background: ${getColorForScore(opts.rel)}`);
    return pill;
  };

  // src/lib/text.ts
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/booking.com/booking-score.user.ts
  var STYLE_ID = "booking-score-style";
  var LIST_CARD_SELECTOR = '[data-testid="property-card"]';
  var MAP_CARD_SELECTOR = '[data-testid="property-list-map-card"]';
  var CARD_SELECTOR = `${LIST_CARD_SELECTOR}, ${MAP_CARD_SELECTOR}`;
  var MARKER_SELECTOR = '[data-testid="custom-price-marker"]';
  var SORT_STORE_KEY = "lb-sort-booking";
  var CSS = `
  .bk-score-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: max-content;
    min-height: 22px;
    margin: 4px 0 2px;
    padding: 2px 8px;
    border-radius: 999px;
    color: #000;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
    white-space: nowrap;
  }

  [data-testid='header-title'] + .bk-score-pill {
    margin-top: 6px;
  }

  .bk-score-marker {
    position: relative !important;
    overflow: visible !important;
  }

  .bk-score-pin-pill {
    position: absolute;
    top: -18px;
    left: 50%;
    z-index: 2;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 16px;
    padding: 0 5px;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 999px;
    color: #000;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    pointer-events: none;
    white-space: nowrap;
  }
`;
  var parseMoney = (value) => {
    const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  var getCardTitle = (card) => {
    const titleEl = card.querySelector('[data-testid="title"], [data-testid="header-title"]');
    return normalizeWhitespace(titleEl?.textContent).replace(/\s*Opens in new window\s*/gi, "").trim();
  };
  var getCardKey = (card, title, priceTotal) => {
    const href = card.querySelector('a[href*="/hotel/"]')?.href;
    if (href) {
      try {
        const url = new URL(href);
        return url.pathname.replace(/\.[a-z]+$/i, "").toLowerCase();
      } catch (_e) {}
    }
    return `${title.toLowerCase()}|${priceTotal ?? ""}`;
  };
  var extractRatingData = (card) => {
    const reviewText = normalizeWhitespace(card.querySelector('[data-testid="review-score"]')?.textContent);
    const text = normalizeWhitespace(`${reviewText} ${card.innerText}`);
    const scoredMatch = text.match(/Scored\s+(\d+(?:\.\d+)?).*?(\d[\d,]*)\s+reviews?/i);
    const reviewMatch = scoredMatch ?? text.match(/(\d+(?:\.\d+)?)\s+(?:Wonderful|Very Good|Good|Excellent|Pleasant|Review score).*?(\d[\d,]*)\s+reviews?/i);
    if (!reviewMatch)
      return { rating: 0, reviewCount: 0 };
    return {
      rating: Number.parseFloat(reviewMatch[1]),
      reviewCount: parseReviewCount(reviewMatch[2])
    };
  };
  var parseNights = (card) => {
    const nightsText = normalizeWhitespace(card.querySelector('[data-testid="price-for-x-nights"]')?.textContent);
    const match = nightsText.match(/(\d+)\s+nights?/i) ?? card.innerText.match(/(\d+)\s+nights?/i);
    if (!match)
      return null;
    const nights = Number.parseInt(match[1], 10);
    return Number.isFinite(nights) && nights > 0 ? nights : null;
  };
  var parsePriceTotal = (card) => {
    const priceArea = card.querySelector('[data-testid="availability-rate-wrapper"]') ?? card.querySelector('[data-testid="availability-container"]') ?? card;
    const text = normalizeWhitespace(priceArea.innerText || priceArea.textContent);
    const explicitMatch = text.match(/Current price\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i) ?? text.match(/\bPrice\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (explicitMatch)
      return parseMoney(explicitMatch[1]);
    const perNightText = normalizeWhitespace(card.querySelector('[data-testid="price-and-discounted-price"]')?.textContent);
    const perNightMatch = perNightText.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    const nights = parseNights(card);
    if (perNightMatch && nights) {
      const perNight = parseMoney(perNightMatch[1]);
      if (perNight !== null)
        return Math.round(perNight * nights);
    }
    const beforeNights = text.split(/\d+\s+nights?/i)[0] ?? text;
    const amounts = Array.from(beforeNights.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g), (match) => parseMoney(match[1])).filter((value) => value !== null);
    return amounts.length ? amounts[amounts.length - 1] : null;
  };
  var parseCard = (card) => {
    const title = getCardTitle(card);
    const { rating, reviewCount } = extractRatingData(card);
    if (!title || !rating || !reviewCount)
      return null;
    const priceTotal = parsePriceTotal(card);
    return {
      card,
      key: getCardKey(card, title, priceTotal),
      title,
      rating,
      reviewCount,
      priceTotal
    };
  };
  var scoreEntries = (entries) => {
    const deduped = new Map;
    entries.forEach((entry) => {
      if (!deduped.has(entry.key))
        deduped.set(entry.key, entry);
    });
    return scoreScaledRatingEntries(Array.from(deduped.values()), 1, 10);
  };
  var toRating = (lb) => scoreToScale(lb, 1, 10).toFixed(1);
  var getBadgeAnchor = (card) => {
    return card.querySelector('[data-testid="title"], [data-testid="header-title"]');
  };
  var upsertCardScore = (card, score, priceRatio) => {
    const anchor = getBadgeAnchor(card);
    if (!anchor)
      return;
    upsertScorePill(card, (pill) => anchor.insertAdjacentElement("afterend", pill), {
      className: "bk-score-pill",
      text: `Score ${toRating(score.lb)}`,
      title: `${score.rating.toFixed(1)} Booking rating | ${score.reviewCount.toLocaleString()} reviews | ` + `95% lower bound: ${toRating(score.lb)} | page rank: ${score.rel.toFixed(3)}` + (priceRatio === null ? "" : ` | price: ${priceRatio.toFixed(2)}x page median`),
      rel: score.rel
    });
    card.dataset.bkScore = score.lb.toFixed(6);
    card.dataset.bkScoreRel = score.rel.toFixed(6);
  };
  var getMarkerPrice = (marker) => {
    const raw = normalizeWhitespace(marker.querySelector("span")?.textContent ?? marker.textContent);
    const match = raw.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    return match ? parseMoney(match[1]) : null;
  };
  var buildPinScoreMap = (scores) => {
    const pinScores = new Map;
    scores.forEach((score) => {
      if (score.priceTotal === null)
        return;
      const priceKey = Math.round(score.priceTotal);
      const existing = pinScores.get(priceKey);
      if (!existing) {
        pinScores.set(priceKey, { lb: score.lb, rel: score.rel, count: 1 });
        return;
      }
      const nextCount = existing.count + 1;
      existing.lb = (existing.lb * existing.count + score.lb) / nextCount;
      existing.rel = (existing.rel * existing.count + score.rel) / nextCount;
      existing.count = nextCount;
    });
    return pinScores;
  };
  var upsertPinScores = (pinScores) => {
    document.querySelectorAll(MARKER_SELECTOR).forEach((marker) => {
      const price = getMarkerPrice(marker);
      const score = price === null ? null : pinScores.get(Math.round(price));
      const existing = marker.querySelector(".bk-score-pin-pill");
      if (!score) {
        existing?.remove();
        marker.classList.remove("bk-score-marker");
        return;
      }
      if (!marker.classList.contains("bk-score-marker"))
        marker.classList.add("bk-score-marker");
      upsertScorePill(marker, (pill) => marker.appendChild(pill), {
        className: "bk-score-pin-pill",
        text: toRating(score.lb),
        title: `Booking score ${toRating(score.lb)}`,
        rel: score.rel
      });
    });
  };
  var processCards = () => {
    injectCSS(STYLE_ID, CSS);
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    const parsedCards = cards.map(parseCard).filter((entry) => entry !== null);
    const scores = scoreEntries(parsedCards);
    const scoresByKey = new Map(scores.map((score) => [score.key, score]));
    const ratios = medianPriceRatios(scores.map((score) => score.priceTotal));
    const ratioByKey = new Map(scores.map((score, i) => [score.key, ratios[i]]));
    parsedCards.forEach((entry) => {
      const score = scoresByKey.get(entry.key);
      if (score)
        upsertCardScore(entry.card, score, ratioByKey.get(entry.key) ?? null);
    });
    upsertPinScores(buildPinScoreMap(scores));
    sortListCards(parsedCards, scoresByKey, ratioByKey);
  };
  var sortListCards = (parsedCards, scoresByKey, ratioByKey) => {
    if (scoresByKey.size < 2)
      return;
    ensureListingSortControl(SORT_STORE_KEY, () => processCards());
    const mode = readListingSortMode(SORT_STORE_KEY);
    const keyByCard = new Map(parsedCards.map((entry) => [entry.card, entry.key]));
    const cards = Array.from(document.querySelectorAll(LIST_CARD_SELECTOR));
    const sortable = cards.map((card) => {
      const key = keyByCard.get(card);
      const lb = key ? scoresByKey.get(key)?.lb ?? null : null;
      return { card, value: listingSortValue(lb, key ? ratioByKey.get(key) ?? null : null, mode) };
    });
    applyListingOrder(sortable, LIST_CARD_SELECTOR, mode);
  };
  var observer = observeDomChanges(processCards, {
    root: document.body,
    debounceMs: 250
  });
  var main = () => {
    processCards();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  runWhenReady(main);
  watchLocationChange(() => {
    window.setTimeout(processCards, 250);
  }, { debounceMs: 250 });
})();
