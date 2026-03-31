// ==UserScript==
// @name                 Airbnb Listing Score
// @author               AZ
// @description          Wilson lower-bound + page-relative scoring with color-coded score pills, text dimming, sort controls, and all-pages loading
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/airbnb.com/airbnb-score.user.js
// @grant                none
// @match                https://www.airbnb.com/s/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/airbnb.com/airbnb-score.user.js
// @version              1.11.0
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
    document.head.appendChild(style);
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

  // src/airbnb.com/airbnb-score.css
  var airbnb_score_default = `.ab-score-item {
  transition: opacity 120ms ease;
}
[data-testid='card-container']:hover .ab-score-item {
  opacity: 1 !important;
}

.ab-pill-row {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 10;
  display: flex;
  gap: 5px;
  align-items: center;
  pointer-events: none;
}

.ab-score-pill {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: #000;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.ab-photo-idx {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: none;
}

#ab-sort-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 2px;
  margin-bottom: 10px;
  font-size: 12px;
  font-family: inherit;
}
#ab-sort-bar .ab-sort-label {
  font-weight: 600;
  color: #222;
  margin-right: 2px;
}
.ab-value-model-ctrl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ab-value-model-select {
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #b0b0b0;
  background: #fff;
  color: #222;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
}
.ab-value-model-select:hover {
  background: #f7f7f7;
}
#ab-sort-bar .ab-sort-btn {
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid #b0b0b0;
  background: #fff;
  color: #222;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition:
    background 80ms,
    border-color 80ms;
  white-space: nowrap;
}
#ab-sort-bar .ab-sort-btn:hover {
  background: #f0f0f0;
}
#ab-sort-bar .ab-sort-btn.ab-active {
  background: #222;
  color: #fff;
  border-color: #222;
}
#ab-sort-bar .ab-divider {
  width: 1px;
  height: 18px;
  background: #ddd;
  margin: 0 2px;
}
#ab-load-all-btn {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #e00;
  background: #fff;
  color: #c00;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 80ms;
  white-space: nowrap;
}
#ab-load-all-btn:hover:not(:disabled) {
  background: #fff0f0;
}
#ab-load-all-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
#ab-load-all-btn.ab-done {
  border-color: #060;
  color: #060;
}

#ab-agg-view-btn {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #1f5ba8;
  background: #fff;
  color: #1f5ba8;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 80ms;
  white-space: nowrap;
}

#ab-agg-view-btn:hover:not(:disabled) {
  background: #eef5ff;
}

#ab-agg-view-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

body.ab-agg-open {
  overflow: hidden;
}

.ab-agg-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: #fff;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif;
}

.ab-agg-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ab-agg-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid #ebebeb;
  background: #fff;
}

.ab-agg-heading {
  font-size: 15px;
  font-weight: 600;
  color: #222;
  flex: 1;
}

.ab-agg-subheading {
  font-size: 13px;
  color: #717171;
}

.ab-agg-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ab-agg-refresh {
  border: 1px solid #b0b0b0;
  background: #fff;
  color: #222;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 80ms;
}

.ab-agg-refresh:hover {
  background: #f7f7f7;
}

.ab-agg-close {
  border: none;
  background: transparent;
  color: #222;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 80ms;
  padding: 0;
}

.ab-agg-close:hover {
  background: #f0f0f0;
}

/* --- sort bar inside overlay --- */

.ab-agg-sort-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  border-bottom: 1px solid #ebebeb;
  background: #fff;
  font-size: 12px;
  font-family: inherit;
}

.ab-agg-cols-ctrl {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

/* --- grid: flows naturally with auto-fill columns --- */

.ab-agg-grid {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 32px 20px;
  align-content: start;
}

@media (max-width: 560px) {
  .ab-agg-grid {
    padding: 16px;
    gap: 20px 12px;
  }
  .ab-agg-header {
    padding: 12px 16px;
  }
  .ab-agg-sort-bar {
    padding: 8px 16px;
  }
}

/* --- card tile: no container styling, just photo + text (matches Airbnb) --- */

.ab-agg-tile {
  position: relative;
  cursor: pointer;
  background: transparent;
  display: block;
  text-decoration: none;
  color: inherit;
}

/* photo */

.ab-agg-photo {
  position: relative;
  width: 100%;
  aspect-ratio: 20 / 13;
  background: #e8e8e8;
  border-radius: 12px;
  overflow: hidden;
}

.ab-agg-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  scroll-behavior: auto;
}

.ab-agg-img {
  min-width: 100%;
  height: 100%;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
}

/* guest favorite pill */

.ab-agg-gf {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 3;
  background: #fff;
  color: #222;
  border-radius: 20px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

.ab-agg-free-cancel {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 3;
  background: #fff;
  color: #222;
  border-radius: 20px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

/* info section */

.ab-agg-info {
  padding: 8px 0 0;
  transition: opacity 120ms ease;
}

.ab-agg-tile:hover .ab-agg-info {
  opacity: 1 !important;
}

.ab-agg-top-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 1px;
}

.ab-agg-name {
  font-size: 14px;
  font-weight: 400;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  line-height: 1.4;
}

.ab-agg-rating {
  font-size: 13px;
  color: #222;
  font-weight: 400;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.4;
}

.ab-agg-subtitle {
  font-size: 13px;
  color: #717171;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  margin-bottom: 2px;
}

.ab-agg-price-row {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-top: 2px;
}

.ab-agg-price {
  font-size: 14px;
  font-weight: 600;
  color: #222;
  line-height: 1.4;
}

.ab-agg-nightly {
  font-size: 14px;
  color: #222;
  font-weight: 400;
  line-height: 1.4;
}

.ab-nightly-rate {
  margin-left: 4px;
}

.ab-nightly-rate-value {
  font-weight: 700;
}

/* loading spinner shown while an unloaded image is pending */

.ab-img-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -12px 0 0 -12px;
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ab-spin 0.65s linear infinite;
  z-index: 20;
  display: none;
  pointer-events: none;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
}

@keyframes ab-spin {
  to {
    transform: rotate(360deg);
  }
}
`;

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
  var getColorForScore = (score) => {
    let r, g;
    if (score < 0.5) {
      r = 255;
      g = Math.round(score * 2 * 255);
    } else {
      r = Math.round((1 - (score - 0.5) * 2) * 255);
      g = 255;
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

  // src/airbnb.com/airbnb-score-helpers.ts
  var SETTINGS_KEY = "ab-score-settings-v1";
  var SORT_FIELDS = [
    { id: "score", label: "Score", field: "abScore" },
    { id: "value", label: "Value", field: "abValue" },
    { id: "rating", label: "Rating", field: "abStars" },
    { id: "count", label: "Reviews", field: "abCount" }
  ];
  var VALUE_MODELS = [
    {
      id: "nightly",
      label: "Nightly blend",
      shortLabel: "Nightly",
      description: "Blend score with the cheapest nightly rates in the result set"
    },
    {
      id: "deal",
      label: "Score-relative price",
      shortLabel: "Deal",
      description: "Rank price after adjusting for quality, so strong listings can justify higher rates"
    }
  ];
  var DEFAULT_VALUE_MODEL = "nightly";
  var VALUE_FLOOR = 0.05;
  function parseValueModel(valueModel) {
    return VALUE_MODELS.some((model) => model.id === valueModel) ? valueModel : DEFAULT_VALUE_MODEL;
  }
  function loadSettings() {
    return readJsonStore(SETTINGS_KEY, { sortMode: "default", valueModel: DEFAULT_VALUE_MODEL }, {
      parse: (value) => {
        if (!value || typeof value !== "object") {
          return { sortMode: "default", valueModel: DEFAULT_VALUE_MODEL };
        }
        const parsed = value;
        const sortMode = typeof parsed.sortMode === "string" ? parsed.sortMode : "default";
        const valueModel = parseValueModel(parsed.valueModel);
        const valid = sortMode === "default" || Boolean(parseSortMode(sortMode));
        return { sortMode: valid ? sortMode : "default", valueModel };
      }
    });
  }
  var settings = loadSettings();
  function saveSettings() {
    writeJsonStore(SETTINGS_KEY, settings);
  }
  function parseSortMode(sortMode) {
    if (!sortMode || sortMode === "default")
      return null;
    const m = sortMode.match(/^([a-z]+)-(asc|desc)$/);
    if (!m)
      return null;
    const fieldDef = SORT_FIELDS.find((f) => f.id === m[1]);
    if (!fieldDef)
      return null;
    return {
      fieldId: fieldDef.id,
      field: fieldDef.field,
      dir: m[2] === "desc" ? 1 : -1,
      dirLabel: m[2] === "desc" ? "↓" : "↑"
    };
  }
  function nextSortMode(currentSortMode, fieldId) {
    const parsed = parseSortMode(currentSortMode);
    if (!parsed || parsed.fieldId !== fieldId)
      return `${fieldId}-desc`;
    if (parsed.dir === 1)
      return `${fieldId}-asc`;
    return "default";
  }
  function getValueModelDef(valueModel = settings.valueModel) {
    return VALUE_MODELS.find((model) => model.id === valueModel) ?? VALUE_MODELS[0];
  }
  function getValueMetricBasis(score, nightly, valueModel) {
    if (!Number.isFinite(nightly) || nightly <= 0)
      return null;
    if (valueModel === "deal")
      return nightly / Math.max(score, VALUE_FLOOR);
    return nightly;
  }
  function computeValueMetric(score, nightly, valueModel) {
    return getValueMetricBasis(score, nightly, valueModel);
  }
  function computeValueScore(score, valueRel) {
    return 0.7 * score + 0.3 * valueRel;
  }
  function createValueModelControl(className, onChange) {
    const label = document.createElement("label");
    label.className = className;
    label.title = getValueModelDef().description;
    const text = document.createElement("span");
    text.className = "ab-sort-label";
    text.textContent = "Value:";
    label.appendChild(text);
    const select = document.createElement("select");
    select.className = "ab-value-model-select";
    VALUE_MODELS.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.shortLabel;
      option.title = model.description;
      select.appendChild(option);
    });
    select.value = settings.valueModel;
    select.addEventListener("change", () => {
      settings.valueModel = parseValueModel(select.value);
      label.title = getValueModelDef().description;
      saveSettings();
      onChange(settings.valueModel);
    });
    label.appendChild(select);
    return label;
  }
  function getTextColorForScore(score) {
    const MAX = 185;
    let r, g;
    if (score < 0.5) {
      r = MAX;
      g = Math.round(score * 2 * MAX);
    } else {
      r = Math.round((1 - (score - 0.5) * 2) * MAX);
      g = MAX;
    }
    return `rgb(${r}, ${g}, 0)`;
  }
  function parsePriceNights(text) {
    if (!text)
      return null;
    const normalized = text.replace(/\s+/g, " ").trim();
    const m = normalized.match(/(.+?)\s+for\s+(\d+)\s+nights?/i);
    if (!m)
      return null;
    const nights = parseInt(m[2], 10);
    if (!Number.isFinite(nights) || nights <= 0)
      return null;
    const amounts = Array.from(m[1].matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g), (x) => parseFloat(x[1].replace(/,/g, ""))).filter((n) => Number.isFinite(n));
    if (!amounts.length)
      return null;
    return { total: amounts[amounts.length - 1], nights };
  }
  function formatUsd(value) {
    return Math.round(value).toLocaleString("en-US");
  }
  function getInfoSection(card) {
    const inner = card.children[1];
    if (!inner)
      return null;
    return inner.children[1] || null;
  }
  function getPhotoSection(card) {
    const inner = card.children[1];
    if (!inner)
      return null;
    return inner.children[0] || null;
  }
  function extractRatingData(card) {
    const text = card.textContent || "";
    const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s+out of 5 average rating[,\s]+([0-9,]+)\s+review/i);
    if (m)
      return { stars: parseFloat(m[1]), reviewCount: parseReviewCount(m[2]) };
    return { stars: 0, reviewCount: 0 };
  }
  function getCardRow(card) {
    let el = card;
    for (let i = 0;i < 5; i++)
      el = el?.parentElement ?? null;
    return el || null;
  }
  function getNearestSectionHeading(card) {
    let headingText = "";
    for (const heading of document.querySelectorAll("h1, h2, h3")) {
      const pos = heading.compareDocumentPosition(card);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        headingText = (heading.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        continue;
      }
      if (pos & Node.DOCUMENT_POSITION_PRECEDING)
        break;
    }
    return headingText;
  }
  function getCardSectionRank(card) {
    const headingText = getNearestSectionHeading(card);
    if (headingText.includes("available for similar dates"))
      return 2;
    if (headingText.includes("more stays available for your dates"))
      return 1;
    return 0;
  }
  function getHeadingTexts(root) {
    return Array.from(root.querySelectorAll("h1, h2, h3")).map((el) => (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
  }
  function findAvailableSimilarDatesSection() {
    const heading = Array.from(document.querySelectorAll("h1, h2, h3")).find((el2) => /available for similar dates/i.test(el2.textContent || ""));
    if (!heading)
      return null;
    let best = null;
    let el = heading.parentElement;
    while (el && el !== document.body) {
      const headingTexts = getHeadingTexts(el);
      const hasSimilar = headingTexts.some((text) => text.includes("available for similar dates"));
      const hasMoreStays = headingTexts.some((text) => text.includes("more stays available for your dates"));
      const cardCount = el.querySelectorAll('[data-testid="card-container"]').length;
      if (cardCount > 0 && hasSimilar && !hasMoreStays)
        best = el;
      if (hasMoreStays)
        break;
      el = el.parentElement;
    }
    return best;
  }
  function removeAvailableSimilarDatesSection() {
    const section = findAvailableSimilarDatesSection();
    if (section)
      section.remove();
  }
  function colorRatingDisplay(card, starsRel, reviewRel) {
    if (!isFinite(starsRel) || !isFinite(reviewRel))
      return;
    const existing = card.querySelector(".ab-rating-val");
    if (existing) {
      existing.style.color = getTextColorForScore(starsRel);
      const cEl = card.querySelector(".ab-review-val");
      if (cEl)
        cEl.style.color = getTextColorForScore(reviewRel);
      return;
    }
    const span = Array.from(card.querySelectorAll('span[aria-hidden="true"]')).find((el) => /^\d+\.\d+\s*\(\d[\d,]*\)$/.test(el.textContent?.trim() ?? ""));
    if (!span)
      return;
    const m = (span.textContent ?? "").trim().match(/^(\d+\.\d+)\s*(\(\d[\d,]*\))$/);
    if (!m)
      return;
    span.innerHTML = `<span class="ab-rating-val" style="color:${getTextColorForScore(starsRel)};font-weight:700">${m[1]}</span>` + ` <span class="ab-review-val" style="color:${getTextColorForScore(reviewRel)}">${m[2]}</span>`;
  }
  var HOVER_PRELOAD_COUNT = 2;
  var THRESHOLD_PRELOAD_COUNT = 4;
  var HOVER_FETCH_DEBOUNCE_MS = 120;
  function pushImageDebug(entry) {
    const w = window;
    const next = [...w.__abImageLogs ?? [], entry];
    w.__abImageLogs = next.slice(-200);
  }
  function getHoverDebugLabel(photoSection) {
    const link = photoSection.closest('a[href*="/rooms/"]');
    if (link?.href)
      return link.href;
    const img = photoSection.querySelector("img");
    return img?.getAttribute("src") || "unknown-photo";
  }
  function recordImageDebug(event, details = {}) {
    pushImageDebug({
      ts: new Date().toISOString(),
      event,
      details
    });
    console.log("[Airbnb Score][images]", event, details);
  }
  function logHoverImageEvent(photoSection, event, details = {}) {
    recordImageDebug(event, {
      listing: getHoverDebugLabel(photoSection),
      ...details
    });
  }
  function warmImage(img) {
    if (!img)
      return;
    img.loading = "eager";
    img.decode().catch(() => {});
  }
  function warmImageRange(imgs, startIdx, count) {
    for (let i = 0;i < count; i++)
      warmImage(imgs[startIdx + i]);
  }
  function attachHoverCycle(photoSection, onThreshold) {
    if (photoSection.dataset.abHoverAttached)
      return;
    photoSection.dataset.abHoverAttached = "1";
    let strip = null;
    function getStrip() {
      if (strip && strip.scrollWidth > strip.clientWidth + 20)
        return strip;
      for (const el of photoSection.querySelectorAll("*")) {
        if (el.scrollWidth > el.clientWidth + 20 && el.children.length >= 2) {
          strip = el;
          return strip;
        }
      }
      return null;
    }
    const spinner = document.createElement("div");
    spinner.className = "ab-img-spinner";
    photoSection.appendChild(spinner);
    let halfwayFired = false;
    let hasLoggedHover = false;
    let hoverFetchStarted = false;
    let hoverFetchTimer = 0;
    let hoverRaf = 0;
    let lastLoadedIdx = 0;
    let pendingIdx = 0;
    let pendingClientX = 0;
    const ensureExtraPhotos = (targetStrip, eagerCount, reason) => {
      if (hoverFetchStarted || !onThreshold)
        return;
      hoverFetchStarted = true;
      logHoverImageEvent(photoSection, "extra-photos-requested", {
        reason,
        eagerCount,
        currentImages: targetStrip.querySelectorAll("img").length
      });
      onThreshold().then((newUrls) => {
        const existingSrcs = new Set(Array.from(targetStrip.querySelectorAll("img")).map((i) => i.src));
        const imgClass = targetStrip.querySelector("img")?.className ?? "";
        const appended = [];
        newUrls.filter((u) => !existingSrcs.has(u)).forEach((u, idx) => {
          const img = document.createElement("img");
          img.className = imgClass;
          img.src = u;
          img.loading = idx < eagerCount ? "eager" : "lazy";
          img.alt = "";
          targetStrip.appendChild(img);
          appended.push(img);
        });
        warmImageRange(appended, 0, eagerCount);
        logHoverImageEvent(photoSection, "extra-photos-appended", {
          reason,
          added: appended.length,
          totalImages: targetStrip.querySelectorAll("img").length
        });
      });
    };
    const scheduleHoverFetch = () => {
      if (!onThreshold || hoverFetchStarted || hoverFetchTimer)
        return;
      hoverFetchTimer = window.setTimeout(() => {
        hoverFetchTimer = 0;
        const s = getStrip();
        if (!s)
          return;
        ensureExtraPhotos(s, HOVER_PRELOAD_COUNT, "debounce");
      }, HOVER_FETCH_DEBOUNCE_MS);
    };
    const processHover = () => {
      hoverRaf = 0;
      const s = getStrip();
      if (!s)
        return;
      const rect = photoSection.getBoundingClientRect();
      const xFrac = Math.max(0, Math.min(1, (pendingClientX - rect.left) / rect.width));
      const totalImgs = Math.round(s.scrollWidth / s.clientWidth) || 1;
      const imgIdx = Math.min(Math.floor(xFrac * totalImgs), totalImgs - 1);
      pendingIdx = imgIdx;
      const imgs = Array.from(s.querySelectorAll("img"));
      const eagerWarmCount = halfwayFired ? THRESHOLD_PRELOAD_COUNT : HOVER_PRELOAD_COUNT;
      warmImageRange(imgs, imgIdx + 1, eagerWarmCount);
      const targetImg = imgs[imgIdx];
      const isLoaded = !targetImg || targetImg.complete && targetImg.naturalWidth > 0;
      if (isLoaded) {
        s.scrollLeft = imgIdx * s.clientWidth;
        lastLoadedIdx = imgIdx;
        spinner.style.display = "none";
      } else {
        s.scrollLeft = lastLoadedIdx * s.clientWidth;
        spinner.style.display = "block";
        if (!targetImg.dataset.abLoadWatched) {
          targetImg.dataset.abLoadWatched = "1";
          const capturedIdx = imgIdx;
          logHoverImageEvent(photoSection, "target-image-cold", {
            idx: capturedIdx,
            totalImgs
          });
          targetImg.addEventListener("load", () => {
            if (pendingIdx === capturedIdx) {
              s.scrollLeft = capturedIdx * s.clientWidth;
              lastLoadedIdx = capturedIdx;
              spinner.style.display = "none";
            }
          }, { once: true });
        }
      }
      const idxEl = photoSection.querySelector(".ab-photo-idx");
      if (idxEl) {
        idxEl.textContent = `${imgIdx + 1}/${totalImgs}`;
        idxEl.style.display = "block";
      }
      if (!halfwayFired && onThreshold && imgIdx >= Math.ceil(totalImgs * 0.3)) {
        halfwayFired = true;
        ensureExtraPhotos(s, THRESHOLD_PRELOAD_COUNT, "threshold");
        warmImageRange(imgs, imgIdx + 1, THRESHOLD_PRELOAD_COUNT);
      }
    };
    photoSection.addEventListener("mouseenter", () => {
      const s = getStrip();
      if (!s)
        return;
      const imgs = Array.from(s.querySelectorAll("img"));
      warmImageRange(imgs, 1, HOVER_PRELOAD_COUNT);
      if (!hasLoggedHover) {
        hasLoggedHover = true;
        logHoverImageEvent(photoSection, "hover-enter", {
          initialImages: imgs.length,
          preloaded: Math.min(HOVER_PRELOAD_COUNT, Math.max(imgs.length - 1, 0))
        });
      }
      scheduleHoverFetch();
    });
    photoSection.addEventListener("mousemove", (e) => {
      pendingClientX = e.clientX;
      scheduleHoverFetch();
      if (hoverRaf)
        return;
      hoverRaf = window.requestAnimationFrame(processHover);
    });
    photoSection.addEventListener("mouseleave", () => {
      if (hoverFetchTimer) {
        window.clearTimeout(hoverFetchTimer);
        hoverFetchTimer = 0;
      }
      if (hoverRaf) {
        window.cancelAnimationFrame(hoverRaf);
        hoverRaf = 0;
      }
      if (strip)
        strip.scrollLeft = 0;
      lastLoadedIdx = 0;
      spinner.style.display = "none";
      const idxEl = photoSection.querySelector(".ab-photo-idx");
      if (idxEl)
        idxEl.style.display = "none";
    });
  }
  function buildPillRow(rel, finalStars) {
    const pillRow = document.createElement("div");
    pillRow.className = "ab-pill-row";
    const scorePill = document.createElement("div");
    scorePill.className = "ab-score-pill";
    scorePill.style.background = getColorForScore(rel);
    scorePill.textContent = `${finalStars.toFixed(1)}★`;
    pillRow.appendChild(scorePill);
    const idxEl = document.createElement("div");
    idxEl.className = "ab-photo-idx";
    pillRow.appendChild(idxEl);
    return { pillRow, scorePill, idxEl };
  }
  function upsertValuePill(pillRow, valueRel, valueScore) {
    let valuePill = pillRow.querySelector(".ab-value-pill");
    if (!valuePill) {
      valuePill = document.createElement("div");
      valuePill.className = "ab-score-pill ab-value-pill";
      const idxEl = pillRow.querySelector(".ab-photo-idx");
      if (idxEl)
        pillRow.insertBefore(valuePill, idxEl);
      else
        pillRow.appendChild(valuePill);
    }
    const model = getValueModelDef();
    valuePill.style.background = getColorForScore(valueRel);
    valuePill.textContent = `${(1 + 4 * valueScore).toFixed(1)}$`;
    valuePill.title = `${model.label} value`;
  }
  function upsertNightlyRate(card) {
    delete card.dataset.abNightly;
    const existing = card.querySelectorAll(".ab-nightly-rate");
    existing.forEach((el) => el.remove());
    const candidates = Array.from(card.querySelectorAll("span, div"));
    const isVisible = (el) => {
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden")
        return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const parseDollars = (txt) => Array.from(txt.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g), (m) => parseFloat(m[1].replace(/,/g, ""))).filter((n) => Number.isFinite(n));
    let target = null;
    let parsed = null;
    const nightOnlyEls = candidates.filter((el) => {
      if (!isVisible(el))
        return false;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /^for\s+(\d+)\s+nights?$/i.test(txt);
    });
    const nightAnyEls = candidates.filter((el) => {
      if (!isVisible(el))
        return false;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /for\s+\d+\s+nights?/i.test(txt);
    });
    for (const nightsEl of nightOnlyEls) {
      const m = (nightsEl.textContent || "").replace(/\s+/g, " ").trim().match(/^for\s+(\d+)\s+nights?$/i);
      if (!m)
        continue;
      const nights = parseInt(m[1], 10);
      if (!Number.isFinite(nights) || nights <= 0)
        continue;
      let scan = nightsEl;
      while (scan && scan !== card) {
        const txt = (scan.textContent || "").replace(/\s+/g, " ").trim();
        const dollars = parseDollars(txt);
        if (dollars.length) {
          target = nightsEl;
          parsed = { total: dollars[dollars.length - 1], nights };
          break;
        }
        scan = scan.parentElement;
      }
      if (target && parsed)
        break;
    }
    if (!target || !parsed) {
      const fallback = parsePriceNights((card.textContent || "").replace(/\s+/g, " "));
      if (!fallback)
        return;
      target = nightOnlyEls[0] || nightAnyEls.slice().sort((a, b) => (a.textContent || "").replace(/\s+/g, " ").trim().length - (b.textContent || "").replace(/\s+/g, " ").trim().length)[0] || null;
      parsed = fallback;
    }
    if (!target)
      return;
    const priceContainer = target.parentElement;
    if (priceContainer) {
      Array.from(priceContainer.querySelectorAll("span, div")).forEach((el) => {
        if (el.classList?.contains("ab-nightly-rate"))
          return;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!/\$\s*\d/.test(txt))
          return;
        el.style.fontWeight = "400";
      });
    }
    const nightly = parsed.total / parsed.nights;
    card.dataset.abNightly = nightly.toFixed(6);
    const rateEl = document.createElement("span");
    rateEl.className = "ab-nightly-rate";
    rateEl.innerHTML = ` (<span class="ab-nightly-rate-value">$${formatUsd(nightly)}</span>/n)`;
    target.insertAdjacentElement("afterend", rateEl);
  }

  // src/airbnb.com/airbnb-score-fetch.ts
  var getAggregationKey = () => {
    const url = new URL(location.href);
    url.searchParams.delete("cursor");
    url.searchParams.delete("pagination_search");
    return `${url.pathname}?${url.searchParams.toString()}`;
  };
  var parseRatingLabel = (label) => {
    const m = (label || "").match(/([0-9.]+)\s+out of 5[^,]+,\s*([0-9,]+)/i);
    if (!m)
      return null;
    return { stars: parseFloat(m[1]), reviewCount: parseReviewCount(m[2]) };
  };
  var parseUsdAmount = (text) => {
    if (!text)
      return null;
    const m = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!m)
      return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  var listingPhotosCache = new Map;
  function logPhotoFetch(event, details) {
    recordImageDebug(event, details);
  }
  var decodeDemandId = (b64) => {
    if (!b64)
      return "";
    try {
      const decoded = atob(b64);
      return decoded.replace(/^[^:]+:/, "");
    } catch (_e) {
      return "";
    }
  };
  var collectExcludedListingIds = (doc) => {
    const excluded = new Set;
    const heading = Array.from(doc.querySelectorAll("h1, h2, h3")).find((el) => /available for similar dates/i.test(el.textContent || ""));
    if (!heading)
      return excluded;
    let section = heading.parentElement;
    let best = null;
    while (section && section !== doc.body) {
      const headingTexts = Array.from(section.querySelectorAll("h1, h2, h3")).map((el) => (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
      const hasSimilar = headingTexts.some((text) => text.includes("available for similar dates"));
      const hasMoreStays = headingTexts.some((text) => text.includes("more stays available for your dates"));
      const cardCount = section.querySelectorAll('[data-testid="card-container"]').length;
      if (cardCount > 0 && hasSimilar && !hasMoreStays)
        best = section;
      if (hasMoreStays)
        break;
      section = section.parentElement;
    }
    if (!best)
      return excluded;
    Array.from(best.querySelectorAll('a[href*="/rooms/"]')).forEach((anchor) => {
      const match = anchor.href.match(/\/rooms\/(\d+)/);
      if (match)
        excluded.add(match[1]);
    });
    return excluded;
  };
  var mapAggregatedListing = (result, fallbackIdx) => {
    const rating = parseRatingLabel(result.avgRatingA11yLabel);
    if (!rating)
      return null;
    const listingId = decodeDemandId(result.demandStayListing?.id);
    const url = listingId ? `https://www.airbnb.com/rooms/${listingId}` : "";
    const key = listingId || `fallback-${fallbackIdx}`;
    const name = result.nameLocalized?.localizedStringWithTranslationPreference || result.subtitle || result.title || "Listing";
    const typeLabel = result.title || "";
    const allContentLines = [
      ...result.structuredContent?.primaryLine || [],
      ...result.structuredContent?.secondaryLine || []
    ];
    const bedsLabel = allContentLines.filter((l) => l.type === "BEDINFO" || l.body?.toLowerCase().includes("bed")).map((l) => l.body).filter(Boolean).join(" · ");
    const guestFavorite = result.badges?.some((b) => b.loggingContext?.badgeType?.includes("GUEST_FAVORITE")) ?? false;
    const freeCancellation = result.badges?.some((b) => b.text?.toLowerCase().includes("free cancellation")) ?? false;
    const pictures = (result.contextualPictures || []).map((p) => p.picture).filter((p) => Boolean(p));
    const priceAccLabel = result.structuredDisplayPrice?.primaryLine?.accessibilityLabel || "";
    const priceLabel = result.structuredDisplayPrice?.primaryLine?.price || "";
    const qualifier = result.structuredDisplayPrice?.primaryLine?.qualifier || "";
    let nightly = null;
    const accMatch = priceAccLabel.match(/\$([\d,]+(?:\.\d{1,2})?)\s+for\s+(\d+)\s+nights?/i);
    if (accMatch) {
      const total = parseFloat(accMatch[1].replace(/,/g, ""));
      const nights = parseInt(accMatch[2], 10);
      if (Number.isFinite(total) && nights > 0)
        nightly = total / nights;
    }
    if (!nightly) {
      const totalUsd = parseUsdAmount(priceLabel);
      const nightsMatch = qualifier.match(/(\d+)\s+nights?/i);
      const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 0;
      if (totalUsd && nights > 0)
        nightly = totalUsd / nights;
      else if (totalUsd && qualifier.includes("night"))
        nightly = totalUsd;
    }
    if (!nightly) {
      console.warn("[Airbnb Score] could not compute nightly rate:", {
        priceAccLabel,
        priceLabel,
        qualifier
      });
    }
    const nightlyLabel = nightly ? `$${formatUsd(nightly)}/n` : "";
    const lb = wilsonLB(rating.stars, rating.reviewCount);
    const priceDisplayLabel = priceAccLabel || (priceLabel && qualifier ? `${priceLabel} ${qualifier}` : priceLabel);
    return {
      key,
      listingId,
      url,
      name,
      typeLabel,
      bedsLabel,
      guestFavorite,
      freeCancellation,
      pictures,
      priceLabel: priceDisplayLabel,
      nightlyLabel,
      nightly,
      stars: rating.stars,
      reviewCount: rating.reviewCount,
      ratingLabel: result.avgRatingLocalized || `${rating.stars} (${rating.reviewCount})`,
      lb,
      rel: 0,
      final: 0,
      finalStars: 0,
      starsRel: 0,
      reviewRel: 0,
      priceRel: 0.5,
      dealRel: 0.5,
      valueRel: 0.5,
      valueScore: 0
    };
  };
  async function fetchListingPhotos(url) {
    const cached = listingPhotosCache.get(url);
    if (cached) {
      logPhotoFetch("listing-photos-cache-hit", { url });
      return cached;
    }
    logPhotoFetch("listing-photos-fetch-start", { url });
    const pending = (async () => {
      const startedAt = performance.now();
      try {
        const html = await fetch(url, { credentials: "include" }).then((r) => r.text());
        const doc = new DOMParser().parseFromString(html, "text/html");
        const s = Array.from(doc.querySelectorAll("script:not([src])")).find((sc) => sc.textContent?.includes("niobeClientData"));
        if (!s) {
          logPhotoFetch("listing-photos-fetch-missing-data", {
            url,
            durationMs: Math.round(performance.now() - startedAt)
          });
          return [];
        }
        const data = JSON.parse(s.textContent ?? "");
        const secs = data?.niobeClientData?.[0]?.[1]?.data?.presentation?.stayProductDetailPage?.sections?.sections ?? [];
        const photoSec = secs.find((x) => x.sectionId === "PHOTO_TOUR_SCROLLABLE_MODAL");
        const urls = (photoSec?.section?.mediaItems ?? []).map((i) => i.baseUrl).filter((u) => Boolean(u));
        logPhotoFetch("listing-photos-fetch-done", {
          url,
          count: urls.length,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return urls;
      } catch (_e) {
        logPhotoFetch("listing-photos-fetch-error", {
          url,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return [];
      }
    })();
    listingPhotosCache.set(url, pending);
    return pending;
  }
  async function fetchSearchPage(cursor) {
    const url = new URL(location.href);
    url.searchParams.delete("cursor");
    url.searchParams.delete("pagination_search");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
      url.searchParams.set("pagination_search", "true");
    }
    try {
      const html = await fetch(url.toString(), { credentials: "include" }).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, "text/html");
      const s = Array.from(doc.querySelectorAll("script:not([src])")).find((sc) => sc.textContent?.includes("niobeClientData"));
      if (!s)
        return { searchResults: [], pageCursors: null, nextCursor: null };
      const data = JSON.parse(s.textContent ?? "");
      const staysResults = data?.niobeClientData?.[0]?.[1]?.data?.presentation?.staysSearch?.results;
      const excludedListingIds = collectExcludedListingIds(doc);
      const searchResults = (staysResults?.searchResults || []).filter((result) => {
        const listingId = decodeDemandId(result.demandStayListing?.id);
        return !listingId || !excludedListingIds.has(listingId);
      });
      const pageCursors = staysResults?.paginationInfo?.pageCursors || null;
      const nextLink = doc.querySelector('a[aria-label="Next"]');
      let nextCursor = null;
      if (nextLink) {
        const href = nextLink.getAttribute("href");
        if (href) {
          try {
            nextCursor = new URL(href, "https://www.airbnb.com").searchParams.get("cursor");
          } catch (_e) {}
        }
      }
      return { searchResults, pageCursors, nextCursor };
    } catch (e) {
      console.error("[Airbnb Score] fetchSearchPage error:", e);
      return { searchResults: [], pageCursors: null, nextCursor: null };
    }
  }
  async function fetchPageRatings(cursor) {
    const { searchResults, pageCursors, nextCursor } = await fetchSearchPage(cursor);
    const ratings = searchResults.map((r) => parseRatingLabel(r.avgRatingA11yLabel)).filter((r) => Boolean(r));
    return { ratings, pageCursors, nextCursor };
  }
  async function fetchAggregatedListings(limit, onProgress) {
    const byKey = new Map;
    onProgress(1);
    const firstPage = await fetchSearchPage(null);
    firstPage.searchResults.forEach((result, i) => {
      if (byKey.size >= limit)
        return;
      const mapped = mapAggregatedListing(result, i);
      if (!mapped)
        return;
      if (!byKey.has(mapped.key))
        byKey.set(mapped.key, mapped);
    });
    let pagesFetched = 1;
    const cursors = firstPage.pageCursors?.slice(1) ?? [];
    const maxPages = 30;
    if (!cursors.length && firstPage.nextCursor)
      cursors.push(firstPage.nextCursor);
    for (let i = 0;i < cursors.length && byKey.size < limit && pagesFetched < maxPages; i++) {
      const pageNum = i + 2;
      onProgress(pageNum);
      const page = await fetchSearchPage(cursors[i]);
      pagesFetched = pageNum;
      page.searchResults.forEach((result, idx) => {
        if (byKey.size >= limit)
          return;
        const mapped = mapAggregatedListing(result, pageNum * 1000 + idx);
        if (!mapped)
          return;
        if (!byKey.has(mapped.key))
          byKey.set(mapped.key, mapped);
      });
    }
    const listings = Array.from(byKey.values());
    const lbs = listings.map((d) => d.lb);
    const ranks = avgRanks(lbs);
    const N = listings.length;
    listings.forEach((d, i) => {
      const rel = N <= 1 ? 0.5 : ranks[i] / (N - 1);
      const final = 0.75 * d.lb + 0.25 * rel;
      d.rel = rel;
      d.final = final;
      d.finalStars = 1 + 4 * final;
    });
    const starsRanks = avgRanks(listings.map((d) => d.stars));
    const reviewRanks = avgRanks(listings.map((d) => d.reviewCount));
    listings.forEach((d, i) => {
      d.starsRel = N <= 1 ? 0.5 : starsRanks[i] / (N - 1);
      d.reviewRel = N <= 1 ? 0.5 : reviewRanks[i] / (N - 1);
    });
    const priced = listings.filter((d) => d.nightly !== null && d.nightly > 0);
    if (priced.length > 1) {
      const priceRanks = avgRanks(priced.map((d) => d.nightly));
      priced.forEach((d, i) => {
        d.priceRel = 1 - priceRanks[i] / (priced.length - 1);
      });
    } else {
      priced.forEach((d) => {
        d.priceRel = 0.5;
      });
    }
    const dealPriced = listings.map((d) => ({
      item: d,
      metric: d.nightly === null ? null : computeValueMetric(d.final, d.nightly, "deal")
    })).filter((d) => d.metric !== null);
    if (dealPriced.length > 1) {
      const dealRanks = avgRanks(dealPriced.map((d) => d.metric));
      dealPriced.forEach((d, i) => {
        d.item.dealRel = 1 - dealRanks[i] / (dealPriced.length - 1);
      });
    } else {
      dealPriced.forEach((d) => {
        d.item.dealRel = 0.5;
      });
    }
    applyAggregatedValueModel(listings);
    listings.sort((a, b) => {
      if (b.final !== a.final)
        return b.final - a.final;
      if (b.reviewCount !== a.reviewCount)
        return b.reviewCount - a.reviewCount;
      return b.stars - a.stars;
    });
    return { listings, pagesFetched };
  }
  function applyAggregatedValueModel(listings) {
    listings.forEach((d) => {
      d.valueRel = settings.valueModel === "deal" ? d.dealRel : d.priceRel;
      d.valueScore = computeValueScore(d.final, d.valueRel);
    });
  }

  // src/airbnb.com/airbnb-score-overlay.ts
  var AGG_LIMIT = 200;
  var AGG_OVERLAY_ID = "ab-agg-overlay";
  var aggregatedCache = null;
  var aggregatedCacheKey = "";
  function invalidateAggCache() {
    if (aggregatedCache === null)
      return;
    const newKey = getAggregationKey();
    if (newKey !== aggregatedCacheKey) {
      aggregatedCache = null;
      aggregatedCacheKey = "";
    }
  }
  function closeAggregatedOverlay() {
    const overlay = document.getElementById(AGG_OVERLAY_ID);
    if (overlay)
      overlay.remove();
    document.body.classList.remove("ab-agg-open");
  }
  function getAggSortValue(item, fieldId) {
    switch (fieldId) {
      case "score":
        return item.final;
      case "value":
        return item.valueScore;
      case "rating":
        return item.stars;
      case "count":
        return item.reviewCount;
      default:
        return 0;
    }
  }
  function buildOverlaySortBar(listings, grid) {
    const bar = document.createElement("div");
    bar.className = "ab-agg-sort-bar";
    bar.dataset.sortMode = "score-desc";
    const label = document.createElement("span");
    label.className = "ab-sort-label";
    label.textContent = "Sort:";
    bar.appendChild(label);
    const getSortMode = () => bar.dataset.sortMode || "score-desc";
    const renderGrid = () => {
      applyAggregatedValueModel(listings);
      const parsed = parseSortMode(getSortMode());
      grid.innerHTML = "";
      const sorted = listings.slice().sort((a, b) => {
        if (!parsed)
          return b.final - a.final;
        const av = getAggSortValue(a, parsed.fieldId);
        const bv = getAggSortValue(b, parsed.fieldId);
        return parsed.dir * (bv - av);
      });
      sorted.forEach((item) => grid.appendChild(buildAggTile(item)));
    };
    const updateButtons = () => {
      const parsed = parseSortMode(getSortMode());
      bar.querySelectorAll(".ab-sort-btn").forEach((btn) => {
        const fld = SORT_FIELDS.find((f) => f.id === btn.dataset.sortField);
        if (!fld)
          return;
        const isActive = parsed !== null && parsed.fieldId === btn.dataset.sortField;
        btn.classList.toggle("ab-active", isActive);
        btn.textContent = isActive ? `${fld.label} ${parsed.dirLabel}` : fld.label;
      });
    };
    SORT_FIELDS.forEach((mode) => {
      const btn = document.createElement("button");
      btn.className = "ab-sort-btn";
      btn.dataset.sortField = mode.id;
      btn.addEventListener("click", () => {
        bar.dataset.sortMode = nextSortMode(getSortMode(), mode.id);
        updateButtons();
        renderGrid();
      });
      bar.appendChild(btn);
    });
    updateButtons();
    const valueControl = createValueModelControl("ab-value-model-ctrl", () => {
      renderGrid();
    });
    bar.appendChild(valueControl);
    const COL_OPTIONS = [0, 1, 2, 3, 4, 5, 6];
    let activeCols = 0;
    const colsGroup = document.createElement("div");
    colsGroup.className = "ab-agg-cols-ctrl";
    const colsLabel = document.createElement("span");
    colsLabel.className = "ab-sort-label";
    colsLabel.textContent = "Cols:";
    colsGroup.appendChild(colsLabel);
    const applyColLayout = () => {
      grid.style.gridTemplateColumns = activeCols > 0 ? `repeat(${activeCols}, minmax(0, 1fr))` : "";
    };
    const updateColButtons = () => {
      colsGroup.querySelectorAll("[data-cols]").forEach((btn) => {
        btn.classList.toggle("ab-active", parseInt(btn.dataset.cols ?? "0", 10) === activeCols);
      });
    };
    COL_OPTIONS.forEach((n) => {
      const btn = document.createElement("button");
      btn.className = "ab-sort-btn";
      btn.dataset.cols = String(n);
      btn.textContent = n === 0 ? "auto" : String(n);
      btn.addEventListener("click", () => {
        activeCols = n;
        updateColButtons();
        applyColLayout();
      });
      colsGroup.appendChild(btn);
    });
    updateColButtons();
    const onResize = () => {
      if (!document.getElementById(AGG_OVERLAY_ID)) {
        window.removeEventListener("resize", onResize);
        return;
      }
      activeCols = 0;
      updateColButtons();
      applyColLayout();
    };
    window.addEventListener("resize", onResize);
    bar.appendChild(colsGroup);
    renderGrid();
    return bar;
  }
  function buildAggTile(item) {
    const tile = document.createElement("a");
    tile.className = "ab-agg-tile";
    if (item.url) {
      tile.href = item.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";
    }
    const photo = document.createElement("div");
    photo.className = "ab-agg-photo";
    const strip = document.createElement("div");
    strip.className = "ab-agg-strip";
    item.pictures.forEach((src, i) => {
      const img = document.createElement("img");
      img.className = "ab-agg-img";
      img.src = src;
      img.loading = i === 0 ? "eager" : "lazy";
      img.alt = "";
      strip.appendChild(img);
    });
    photo.appendChild(strip);
    if (item.guestFavorite) {
      const gf = document.createElement("div");
      gf.className = "ab-agg-gf";
      gf.textContent = "Guest favorite";
      photo.appendChild(gf);
    }
    if (item.freeCancellation) {
      const fc = document.createElement("div");
      fc.className = "ab-agg-free-cancel";
      fc.textContent = "Free cancellation";
      photo.appendChild(fc);
    }
    const { pillRow } = buildPillRow(item.rel, item.finalStars);
    upsertValuePill(pillRow, item.valueRel, item.valueScore);
    photo.appendChild(pillRow);
    attachHoverCycle(photo, item.url ? () => fetchListingPhotos(item.url) : undefined);
    tile.appendChild(photo);
    const info = document.createElement("div");
    info.className = "ab-agg-info";
    info.style.opacity = (0.35 + 0.65 * item.rel).toFixed(2);
    const topRow = document.createElement("div");
    topRow.className = "ab-agg-top-row";
    const nameEl = document.createElement("span");
    nameEl.className = "ab-agg-name";
    nameEl.textContent = item.name;
    topRow.appendChild(nameEl);
    if (item.stars > 0) {
      const ratingEl = document.createElement("span");
      ratingEl.className = "ab-agg-rating";
      const starsSpan = document.createElement("span");
      starsSpan.style.color = getTextColorForScore(item.starsRel);
      starsSpan.style.fontWeight = "700";
      starsSpan.textContent = `★ ${item.stars.toFixed(2)}`;
      ratingEl.appendChild(starsSpan);
      if (item.reviewCount > 0) {
        const countSpan = document.createElement("span");
        countSpan.style.color = getTextColorForScore(item.reviewRel);
        countSpan.textContent = ` (${item.reviewCount.toLocaleString()})`;
        ratingEl.appendChild(countSpan);
      }
      topRow.appendChild(ratingEl);
    }
    info.appendChild(topRow);
    const subtitle = [item.typeLabel, item.bedsLabel].filter(Boolean).join(" · ");
    if (subtitle) {
      const subtitleEl = document.createElement("div");
      subtitleEl.className = "ab-agg-subtitle";
      subtitleEl.textContent = subtitle;
      info.appendChild(subtitleEl);
    }
    const priceRow = document.createElement("div");
    priceRow.className = "ab-agg-price-row";
    if (item.nightly) {
      const priceEl = document.createElement("span");
      priceEl.className = "ab-agg-price";
      priceEl.textContent = `$${formatUsd(item.nightly)}`;
      priceRow.appendChild(priceEl);
      const nightEl = document.createElement("span");
      nightEl.className = "ab-agg-nightly";
      nightEl.textContent = " night";
      priceRow.appendChild(nightEl);
    }
    info.appendChild(priceRow);
    tile.appendChild(info);
    return tile;
  }
  function renderAggregatedOverlay(result, onRefresh) {
    closeAggregatedOverlay();
    const overlay = document.createElement("div");
    overlay.id = AGG_OVERLAY_ID;
    overlay.className = "ab-agg-overlay";
    const panel = document.createElement("div");
    panel.className = "ab-agg-panel";
    const header = document.createElement("div");
    header.className = "ab-agg-header";
    const heading = document.createElement("div");
    heading.className = "ab-agg-heading";
    heading.textContent = `Top ${result.listings.length} listings`;
    header.appendChild(heading);
    const sub = document.createElement("div");
    sub.className = "ab-agg-subheading";
    sub.textContent = `${result.pagesFetched} pages · ranked by score`;
    header.appendChild(sub);
    const actions = document.createElement("div");
    actions.className = "ab-agg-actions";
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "ab-agg-refresh";
    refreshBtn.textContent = "Refresh";
    refreshBtn.title = "Clear cache and reload all pages";
    refreshBtn.addEventListener("click", () => {
      aggregatedCache = null;
      aggregatedCacheKey = "";
      closeAggregatedOverlay();
      onRefresh();
    });
    actions.appendChild(refreshBtn);
    const closeBtn = document.createElement("button");
    closeBtn.className = "ab-agg-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", closeAggregatedOverlay);
    actions.appendChild(closeBtn);
    header.appendChild(actions);
    panel.appendChild(header);
    const grid = document.createElement("div");
    grid.className = "ab-agg-grid";
    const sortBar = buildOverlaySortBar(result.listings, grid);
    panel.appendChild(sortBar);
    panel.appendChild(grid);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay)
        closeAggregatedOverlay();
    });
    document.body.appendChild(overlay);
    document.body.classList.add("ab-agg-open");
  }
  async function openAggregatedView(btn) {
    const currentKey = getAggregationKey();
    if (aggregatedCache && aggregatedCacheKey === currentKey) {
      renderAggregatedOverlay(aggregatedCache, () => openAggregatedView(btn));
      return;
    }
    btn.disabled = true;
    btn.textContent = "Loading view…";
    try {
      const result = await fetchAggregatedListings(AGG_LIMIT, (pageNum) => {
        btn.textContent = `Loading view p${pageNum}…`;
      });
      aggregatedCache = result;
      aggregatedCacheKey = currentKey;
      renderAggregatedOverlay(result, () => openAggregatedView(btn));
    } catch (e) {
      console.error("[Airbnb Score] openAggregatedView error:", e);
      btn.textContent = "View failed";
      return;
    } finally {
      btn.disabled = false;
      btn.textContent = `Combined Top ${AGG_LIMIT}`;
    }
  }

  // src/airbnb.com/airbnb-score-grid.ts
  var CARD_SELECTOR = '[data-testid="card-container"]';
  var ITEM_CLASS = "ab-score-item";
  var SORT_BAR_ID = "ab-sort-bar";
  var LOAD_BTN_ID = "ab-load-all-btn";
  var AGG_VIEW_BTN_ID = "ab-agg-view-btn";
  var _observer = null;
  var _container = document.body;
  function initGrid(observer, container) {
    _observer = observer;
    _container = container;
  }
  function applyValueScoring(cards) {
    const scored = cards.map((card) => ({
      card,
      score: parseFloat(card.dataset.abScore ?? ""),
      nightly: parseFloat(card.dataset.abNightly ?? "")
    })).filter((d) => Number.isFinite(d.score));
    if (!scored.length)
      return;
    const modeled = scored.map((d) => ({
      card: d.card,
      valueMetric: computeValueMetric(d.score, d.nightly, settings.valueModel)
    })).filter((d) => d.valueMetric !== null);
    const valueRanks = avgRanks(modeled.map((d) => d.valueMetric));
    const valueRelByCard = new Map;
    modeled.forEach((d, i) => {
      const valueRel = modeled.length <= 1 ? 0.5 : 1 - valueRanks[i] / (modeled.length - 1);
      valueRelByCard.set(d.card, valueRel);
    });
    scored.forEach((d) => {
      const valueRel = valueRelByCard.has(d.card) ? valueRelByCard.get(d.card) : 0.5;
      const valueScore = computeValueScore(d.score, valueRel);
      d.card.dataset.abValue = valueScore.toFixed(6);
      const photoSection = getPhotoSection(d.card);
      const pillRow = photoSection?.querySelector(".ab-pill-row");
      if (pillRow)
        upsertValuePill(pillRow, valueRel, valueScore);
    });
  }
  function getAllCardRows() {
    return Array.from(document.querySelectorAll(CARD_SELECTOR)).map((c) => ({ card: c, row: getCardRow(c), sectionRank: getCardSectionRank(c) })).filter((d) => d.row !== null);
  }
  function getSortValue(card, field) {
    const v = parseFloat(card.dataset[field] ?? "");
    return Number.isFinite(v) ? v : -Infinity;
  }
  function applySort() {
    removeAvailableSimilarDatesSection();
    const mode = parseSortMode(settings.sortMode);
    const rows = getAllCardRows();
    if (!rows.length)
      return;
    if (!mode) {
      rows.forEach(({ row }) => row.style.order = "");
      return;
    }
    const { field, dir } = mode;
    const sorted = rows.slice().sort((a, b) => {
      if (a.sectionRank !== b.sectionRank)
        return a.sectionRank - b.sectionRank;
      return dir * (getSortValue(b.card, field) - getSortValue(a.card, field));
    });
    sorted.forEach(({ row }, i) => {
      row.style.order = String(i);
    });
  }
  function getGridAnchor() {
    const firstCard = document.querySelector(CARD_SELECTOR);
    if (!firstCard)
      return null;
    let el = firstCard;
    for (let i = 0;i < 15; i++) {
      el = el?.parentElement ?? null;
      if (!el)
        break;
      if (el.className && el.className.includes("gsgwcjk"))
        return el;
    }
    return null;
  }
  function updateSortBarActive() {
    const bar = document.getElementById(SORT_BAR_ID);
    if (!bar)
      return;
    const active = parseSortMode(settings.sortMode);
    bar.querySelectorAll(".ab-sort-btn").forEach((btn) => {
      const label = SORT_FIELDS.find((f) => f.id === btn.dataset.sortField)?.label || "Sort";
      const isActive = active && active.fieldId === btn.dataset.sortField;
      btn.classList.toggle("ab-active", Boolean(isActive));
      btn.textContent = isActive ? `${label} ${active.dirLabel}` : label;
    });
  }
  function ensureSortBar() {
    if (document.getElementById(SORT_BAR_ID))
      return;
    const grid = getGridAnchor();
    if (!grid || !grid.parentElement)
      return;
    const bar = document.createElement("div");
    bar.id = SORT_BAR_ID;
    const label = document.createElement("span");
    label.className = "ab-sort-label";
    label.textContent = "Sort:";
    bar.appendChild(label);
    SORT_FIELDS.forEach((mode) => {
      const btn = document.createElement("button");
      btn.className = "ab-sort-btn";
      btn.dataset.sortField = mode.id;
      btn.textContent = mode.label;
      btn.addEventListener("click", () => {
        settings.sortMode = nextSortMode(settings.sortMode, mode.id);
        saveSettings();
        updateSortBarActive();
        applySort();
      });
      bar.appendChild(btn);
    });
    updateSortBarActive();
    const valueControl = createValueModelControl("ab-value-model-ctrl", () => {
      const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
      applyValueScoring(cards);
      applySort();
    });
    bar.appendChild(valueControl);
    const divider = document.createElement("div");
    divider.className = "ab-divider";
    bar.appendChild(divider);
    const loadBtn = document.createElement("button");
    loadBtn.id = LOAD_BTN_ID;
    loadBtn.textContent = "Load All Pages";
    loadBtn.title = "Fetch all search result pages and recompute scores globally";
    loadBtn.addEventListener("click", () => loadAllPages(loadBtn));
    bar.appendChild(loadBtn);
    const viewBtn = document.createElement("button");
    viewBtn.id = AGG_VIEW_BTN_ID;
    viewBtn.textContent = `Combined Top ${AGG_LIMIT}`;
    viewBtn.title = `Open combined ranked view from up to ${AGG_LIMIT} listings`;
    viewBtn.addEventListener("click", () => openAggregatedView(viewBtn));
    bar.appendChild(viewBtn);
    grid.parentElement.insertBefore(bar, grid);
  }
  async function loadAllPages(btn) {
    btn.disabled = true;
    btn.classList.remove("ab-done");
    btn.textContent = "Loading…";
    _observer?.disconnect();
    const allRatings = [];
    let pageNum = 1;
    btn.textContent = "Loading p1…";
    const { ratings: p1Ratings, pageCursors } = await fetchPageRatings(null);
    p1Ratings.forEach((r) => allRatings.push({
      stars: r.stars,
      reviewCount: r.reviewCount,
      lb: wilsonLB(r.stars, r.reviewCount)
    }));
    const remainingCursors = pageCursors ? pageCursors.slice(1) : [];
    for (let i = 0;i < remainingCursors.length; i++) {
      pageNum = i + 2;
      btn.textContent = `Loading p${pageNum}…`;
      const { ratings } = await fetchPageRatings(remainingCursors[i]);
      ratings.forEach((r) => allRatings.push({
        stars: r.stars,
        reviewCount: r.reviewCount,
        lb: wilsonLB(r.stars, r.reviewCount)
      }));
    }
    const N = allRatings.length;
    if (!N) {
      btn.textContent = "No data";
      btn.disabled = false;
      _observer?.observe(_container, { childList: true, subtree: true });
      return;
    }
    const lbs = allRatings.map((d) => d.lb);
    const ranks = avgRanks(lbs);
    const relScores = N <= 1 ? [0.5] : ranks.map((r) => r / (N - 1));
    allRatings.forEach((d, i) => {
      d.rel = relScores[i];
      d.final = 0.75 * d.lb + 0.25 * d.rel;
    });
    const domCards = Array.from(document.querySelectorAll(CARD_SELECTOR)).filter((c) => c.dataset.abProcessed === "true");
    domCards.forEach((card) => {
      const cardLb = parseFloat(card.dataset.abLb ?? "");
      if (!isFinite(cardLb) || cardLb === 0)
        return;
      let countBelow = 0;
      let countSame = 0;
      allRatings.forEach((d) => {
        if (d.lb < cardLb - 0.000000001)
          countBelow++;
        else if (Math.abs(d.lb - cardLb) < 0.000000001)
          countSame++;
      });
      const rank = countSame > 0 ? countBelow + (countSame - 1) / 2 : countBelow;
      const rel = N <= 1 ? 0.5 : rank / (N - 1);
      const finalScore = 0.75 * cardLb + 0.25 * rel;
      const finalStars = 1 + 4 * finalScore;
      const infoSection = getInfoSection(card);
      if (infoSection)
        infoSection.style.opacity = (0.35 + 0.65 * rel).toFixed(2);
      const pill = card.querySelector(".ab-score-pill:not(.ab-value-pill)");
      if (pill) {
        pill.style.background = getColorForScore(rel);
        pill.textContent = finalStars.toFixed(1) + "★";
      }
      card.dataset.abScore = finalScore.toFixed(6);
      upsertNightlyRate(card);
      card.title = `${card.dataset.abStars}★ | ${card.dataset.abCount} reviews | ` + `LB: ${cardLb.toFixed(3)} | Rel(global): ${rel.toFixed(3)} | ` + `Final: ${finalScore.toFixed(3)} (${finalStars.toFixed(1)}★)`;
    });
    applyValueScoring(domCards);
    applySort();
    btn.textContent = `Global (${N})`;
    btn.classList.add("ab-done");
    btn.disabled = false;
    _observer?.observe(_container, { childList: true, subtree: true });
    console.log(`[Airbnb Score] Global scoring: ${N} rated listings across ${pageNum} pages`);
  }
  function processCards() {
    ensureSortBar();
    removeAvailableSimilarDatesSection();
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    if (!cards.length)
      return;
    const unprocessed = cards.filter((c) => c.dataset.abProcessed !== "true");
    if (!unprocessed.length) {
      cards.forEach((card) => upsertNightlyRate(card));
      applyValueScoring(cards);
      applySort();
      return;
    }
    const itemData = [];
    unprocessed.forEach((card) => {
      if (card.offsetParent === null || window.getComputedStyle(card).display === "none")
        return;
      const { stars, reviewCount } = extractRatingData(card);
      const lb = wilsonLB(stars, reviewCount);
      itemData.push({ card, stars, reviewCount, lb });
    });
    if (!itemData.length)
      return;
    const allProcessed = cards.filter((c) => c.dataset.abProcessed === "true" && c.dataset.abLb).map((c) => ({
      card: c,
      lb: parseFloat(c.dataset.abLb),
      stars: parseFloat(c.dataset.abStars ?? ""),
      reviewCount: parseInt(c.dataset.abCount ?? "", 10),
      processed: true
    }));
    const combined = [...allProcessed, ...itemData];
    const N = combined.length;
    const lbValues = combined.map((d) => d.lb);
    const ranks = avgRanks(lbValues);
    const relScores = N === 1 ? [0.5] : ranks.map((r) => r / (N - 1));
    combined.forEach((d, i) => {
      d.rel = relScores[i];
      d.final = 0.75 * d.lb + 0.25 * d.rel;
      d.finalStars = 1 + 4 * d.final;
    });
    const starsRanks = avgRanks(combined.map((d) => d.stars));
    const reviewRanks = avgRanks(combined.map((d) => d.reviewCount));
    combined.forEach((d, i) => {
      d.starsRel = N === 1 ? 0.5 : starsRanks[i] / (N - 1);
      d.reviewRel = N === 1 ? 0.5 : reviewRanks[i] / (N - 1);
    });
    combined.forEach((d) => {
      if (!d.processed)
        return;
      const infoSection = getInfoSection(d.card);
      if (infoSection)
        infoSection.style.opacity = (0.35 + 0.65 * d.rel).toFixed(2);
      const pill = d.card.querySelector(".ab-score-pill:not(.ab-value-pill)");
      if (pill) {
        pill.style.background = getColorForScore(d.rel);
        pill.textContent = d.finalStars.toFixed(1) + "★";
      }
      d.card.dataset.abScore = d.final.toFixed(6);
      colorRatingDisplay(d.card, d.starsRel, d.reviewRel);
      upsertNightlyRate(d.card);
    });
    itemData.forEach((d) => {
      const infoSection = getInfoSection(d.card);
      if (!infoSection)
        return;
      infoSection.classList.add(ITEM_CLASS);
      infoSection.style.opacity = (0.35 + 0.65 * d.rel).toFixed(2);
      const photoSection = getPhotoSection(d.card);
      if (photoSection) {
        photoSection.style.position = "relative";
        const { pillRow } = buildPillRow(d.rel, d.finalStars);
        photoSection.appendChild(pillRow);
        attachHoverCycle(photoSection);
      }
      colorRatingDisplay(d.card, d.starsRel, d.reviewRel);
      upsertNightlyRate(d.card);
      d.card.title = `${d.stars}★ | ${d.reviewCount} reviews | ` + `LB: ${d.lb.toFixed(3)} | Rel: ${d.rel.toFixed(3)} | ` + `Final: ${d.final.toFixed(3)} (${d.finalStars.toFixed(1)}★)`;
      d.card.dataset.abScore = d.final.toFixed(6);
      d.card.dataset.abStars = d.stars.toString();
      d.card.dataset.abCount = d.reviewCount.toString();
      d.card.dataset.abLb = d.lb.toFixed(6);
      d.card.dataset.abProcessed = "true";
    });
    applyValueScoring(combined.map((d) => d.card));
    applySort();
    console.log(`[Airbnb Score] Processed ${itemData.length} new cards, ${N} total`);
  }

  // src/airbnb.com/airbnb-score.user.ts
  var STYLE_ID = "ab-score-style";
  var SORT_BAR_ID2 = "ab-sort-bar";
  injectCSS(STYLE_ID, airbnb_score_default);
  processCards();
  setTimeout(processCards, 1500);
  function onNavigation() {
    const bar = document.getElementById(SORT_BAR_ID2);
    if (bar)
      bar.remove();
    closeAggregatedOverlay();
    invalidateAggCache();
  }
  var container = document.querySelector('[data-testid="browse-list-and-map-container"]') || document.querySelector('[data-testid="homes-search-result"]') || document.body;
  watchLocationChange(onNavigation);
  var observer = observeDomChanges(processCards, {
    root: container,
    debounceMs: 600
  });
  initGrid(observer, container);
  observer.observe(container, { childList: true, subtree: true });
})();
