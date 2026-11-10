// ==UserScript==
// @name                 Kiwi Saved Searches
// @author               AZ
// @description          saves and reloads one-way Kiwi.com flight searches
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/kiwi.com/kiwi-saved-searches.user.js
// @grant                none
// @license              MIT
// @match                https://www.kiwi.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/kiwi.com/kiwi-saved-searches.user.js
// @version              0.4.0
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

  // src/kiwi.com/kiwi-saved-searches.user.ts
  var exports_kiwi_saved_searches_user = {};

  // src/lib/clipboard.ts
  var copyTextWithFallback = async (text, promptTitle) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_e) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok)
        return true;
    } catch (_e) {}
    window.prompt(promptTitle, text);
    return false;
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

  // src/kiwi.com/kiwi-saved-searches.css
  var kiwi_saved_searches_default = `#kiwi-saved-searches-root {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483647;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-size: 13px;
  line-height: 1.35;
  color: #0f172a;
}

#kiwi-saved-searches-root button,
#kiwi-saved-searches-root input {
  font: inherit;
}

#kiwi-saved-searches-root svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

#kiwi-saved-searches-root :focus-visible {
  outline: 2px solid #00a991;
  outline-offset: 2px;
}

.ks-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 999px;
  background: #fff;
  color: #0f172a;
  font-weight: 700;
  box-shadow: 0 6px 20px rgba(9, 30, 66, 0.18);
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.ks-toggle:hover {
  border-color: #00a991;
}

.ks-toggle svg {
  color: #00a991;
}

.ks-count {
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #00a991;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}

.ks-panel {
  position: relative;
  width: min(var(--ks-width, 380px), calc(100vw - 16px));
  height: var(--ks-height, auto);
  max-height: min(var(--ks-max-height, 560px), calc(100vh - 16px));
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 54px rgba(9, 30, 66, 0.24);
  overflow: hidden;
}

.ks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 10px 10px 10px 16px;
  border-bottom: 1px solid #e2e8f0;
  cursor: move;
  touch-action: none;
  user-select: none;
}

.ks-title {
  font-size: 14px;
  font-weight: 800;
}

.ks-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* top-left because the panel is anchored to the bottom-right */
.ks-resize {
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  border-top-left-radius: 16px;
  cursor: nwse-resize;
  touch-action: none;
}

.ks-resize::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 5px;
  width: 6px;
  height: 6px;
  border-top: 2px solid #cbd5e1;
  border-left: 2px solid #cbd5e1;
  border-top-left-radius: 4px;
}

.ks-resize:hover::before {
  border-color: #00a991;
}

.ks-dragging,
.ks-dragging * {
  cursor: grabbing !important;
  user-select: none;
}

.ks-label {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #64748b;
  text-transform: uppercase;
}

.ks-label:first-child {
  margin-top: 0;
}

.ks-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed #94a3b8;
  border-radius: 12px;
  background: #f8fafc;
}

.ks-save {
  display: flex;
  gap: 6px;
}

.ks-name-input {
  min-width: 0;
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
}

.ks-name-input:focus {
  border-color: #00a991;
  outline: none;
}

.ks-row {
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.ks-row:hover,
.ks-row:focus-within {
  border-color: #00a991;
}

.ks-row-active {
  border-color: #00a991;
  background: #f0fdf9;
}

.ks-row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.ks-row-main:hover {
  color: inherit;
  text-decoration: none;
}

.ks-row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-weight: 700;
}

.ks-ellipsis {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ks-row-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #64748b;
}

.ks-row-sub > span + span::before {
  content: '\\00b7';
  margin: 0 5px;
}

.ks-row-past .ks-row-main {
  opacity: 0.6;
}

.ks-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: #00a991;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ks-badge-past {
  background: #e2e8f0;
  color: #475569;
}

/* actions float over the row end so rows keep one height */
.ks-row-actions {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 8px;
  background: inherit;
  box-shadow: -12px 0 10px -2px #fff;
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
}

.ks-row-active .ks-row-actions {
  box-shadow: -12px 0 10px -2px #f0fdf9;
}

.ks-row:hover .ks-row-actions,
.ks-row:focus-within .ks-row-actions {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .ks-row-actions {
    position: static;
    justify-content: flex-end;
    padding: 0 6px 6px;
    box-shadow: none;
    transform: none;
    opacity: 1;
    pointer-events: auto;
  }
}

.ks-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;
}

.ks-icon-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.ks-icon-btn.ks-danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.ks-icon-btn.ks-done {
  color: #00a991;
}

.ks-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #00a991;
  border-radius: 8px;
  background: #00a991;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.ks-btn:hover {
  background: #007f6d;
  border-color: #007f6d;
}

.ks-rename {
  display: flex;
  padding: 6px;
}

.ks-hint {
  color: #64748b;
  font-size: 12px;
}

.ks-undo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
  border-top: 1px solid #e2e8f0;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
}

.ks-link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: #5eead4;
  font-weight: 700;
  cursor: pointer;
}
`;

  // src/lib/text.ts
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/kiwi.com/kiwi-saved-searches.helpers.ts
  var EXCLUDED_QUERY_KEYS = new Set(["origin", "destination", "outboundDate", "inboundDate"]);
  var cleanText = (value) => {
    return normalizeWhitespace((value ?? "").replace(/[\u200e\u200f]/g, ""));
  };
  var titleCase = (value) => {
    return value.split(/[\s-]+/).filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
  };
  var slugToLabel = (slug) => {
    return titleCase(decodeURIComponent(slug).replace(/-\d+km$/i, "").replace(/-/g, " "));
  };
  var splitDestinations = (value) => {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  };
  var getSearchParamMap = (params) => {
    const out = {};
    params.forEach((value, key) => {
      if (EXCLUDED_QUERY_KEYS.has(key))
        return;
      if (!value)
        return;
      out[key] = value;
    });
    return out;
  };
  var getDefaultName = (originLabel, destinationLabels, outboundDate) => {
    const destination = destinationLabels.join(", ") || "Anywhere";
    return `${originLabel || "Origin"} to ${destination} ${outboundDate}`.trim();
  };
  var buildDraft = (opts) => {
    if (!opts.originSlug || !opts.destinationSlugText || !opts.outboundDate)
      return null;
    if (opts.inboundDate !== "no-return")
      return null;
    const destinationSlugs = splitDestinations(opts.destinationSlugText);
    if (!destinationSlugs.length)
      return null;
    const originLabel = cleanText(opts.labels?.originLabel) || slugToLabel(opts.originSlug);
    const destinationLabels = destinationSlugs.map((slug, index) => {
      return cleanText(opts.labels?.destinationLabels?.[index]) || slugToLabel(slug);
    });
    return {
      name: getDefaultName(originLabel, destinationLabels, opts.outboundDate),
      tripType: "one-way",
      searchMode: opts.searchMode,
      originSlug: opts.originSlug,
      originLabel,
      destinationSlugs,
      destinationLabels,
      outboundDate: opts.outboundDate,
      params: getSearchParamMap(opts.params)
    };
  };
  var parsePathSearch = (url, labels) => {
    const parts = url.pathname.split("/").map(decodeURIComponent).filter(Boolean);
    const searchIndex = parts.indexOf("search");
    if (searchIndex < 0)
      return null;
    const mode = parts[searchIndex + 1];
    if (mode !== "results" && mode !== "tiles" && mode !== "map")
      return null;
    return buildDraft({
      searchMode: mode,
      originSlug: parts[searchIndex + 2] ?? "",
      destinationSlugText: parts[searchIndex + 3] ?? "",
      outboundDate: parts[searchIndex + 4] ?? "",
      inboundDate: parts[searchIndex + 5] ?? "",
      params: url.searchParams,
      labels
    });
  };
  var parseQuerySearch = (url, labels) => {
    return buildDraft({
      searchMode: "results",
      originSlug: url.searchParams.get("origin") ?? "",
      destinationSlugText: url.searchParams.get("destination") ?? "",
      outboundDate: url.searchParams.get("outboundDate") ?? "",
      inboundDate: url.searchParams.get("inboundDate") ?? "",
      params: url.searchParams,
      labels
    });
  };
  var parseKiwiSearchFromUrl = (href, labels) => {
    const url = new URL(href);
    return parsePathSearch(url, labels) ?? parseQuerySearch(url, labels);
  };
  var buildKiwiSearchUrl = (search) => {
    const params = new URLSearchParams(search.params);
    const destinationSlugText = search.destinationSlugs.join(",");
    const query = params.toString();
    const searchMode = search.searchMode ?? "results";
    const base = [
      `https://www.kiwi.com/en/search/${searchMode}`,
      encodeURIComponent(search.originSlug),
      encodeURIComponent(destinationSlugText).replace(/%2C/g, ","),
      encodeURIComponent(search.outboundDate),
      "no-return"
    ].join("/");
    return `${base}/${query ? `?${query}` : ""}`;
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var parseIsoDate = (value) => {
    const match = ISO_DATE.exec(value);
    if (!match)
      return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12)
      return null;
    return { year: Number(match[1]), month, day: Number(match[3]) };
  };
  var formatKiwiDate = (value, currentYear) => {
    const flex = /^(.+)_flex(\d+)$/.exec(value);
    if (flex) {
      const day = formatKiwiDate(flex[1] ?? "", currentYear);
      return day === flex[1] ? value : `${day} (flex ${flex[2]} days)`;
    }
    const parts = value.split("_");
    const start = parseIsoDate(parts[0] ?? "");
    const end = parts.length === 2 ? parseIsoDate(parts[1] ?? "") : null;
    if (!start || parts.length > 2 || parts.length === 2 && !end)
      return value;
    const month = (d) => MONTHS[d.month - 1] ?? "";
    const year = (d) => d.year === currentYear ? "" : ` ${d.year}`;
    const full = (d) => `${d.day} ${month(d)}${year(d)}`;
    if (!end || parts[0] === parts[1])
      return full(start);
    if (start.year === end.year && start.month === end.month) {
      return `${start.day}-${end.day} ${month(end)}${year(end)}`;
    }
    if (start.year === end.year)
      return `${start.day} ${month(start)} - ${full(end)}`;
    return `${full(start)} - ${full(end)}`;
  };
  var isPastKiwiDate = (value, today) => {
    const last = value.replace(/_flex\d+$/, "").split("_").at(-1) ?? "";
    return ISO_DATE.test(last) && last < today;
  };
  var describeRoute = (search) => {
    return `${search.originLabel} to ${search.destinationLabels.join(", ")}`;
  };
  var hasCustomName = (search) => {
    const auto = getDefaultName(search.originLabel, search.destinationLabels, search.outboundDate);
    return !!search.name && search.name !== auto;
  };
  var isSameSearch = (a, b) => {
    if (a.originSlug !== b.originSlug)
      return false;
    if (a.outboundDate !== b.outboundDate)
      return false;
    if (a.destinationSlugs.length !== b.destinationSlugs.length)
      return false;
    if (a.destinationSlugs.some((slug, i) => slug !== b.destinationSlugs[i]))
      return false;
    const aKeys = Object.keys(a.params).sort();
    const bKeys = Object.keys(b.params).sort();
    if (aKeys.join(",") !== bKeys.join(","))
      return false;
    return aKeys.every((key) => a.params[key] === b.params[key]);
  };
  var parseSavedSearches = (value) => {
    if (!Array.isArray(value))
      return [];
    return value.filter((item) => {
      return typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.name === "string" && item.tripType === "one-way" && typeof item.originSlug === "string" && typeof item.originLabel === "string" && Array.isArray(item.destinationSlugs) && Array.isArray(item.destinationLabels) && typeof item.outboundDate === "string" && typeof item.params === "object" && item.params !== null;
    });
  };
  var SORT_LABELS = {
    price: "cheapest",
    duration: "fastest",
    quality: "best"
  };
  var describeBags = (value) => {
    const match = /^(\d+)\.(\d+)/.exec(value);
    if (!match)
      return [`bags ${value}`];
    const cabin = Number(match[1]);
    const checked = Number(match[2]);
    const out = [];
    if (cabin)
      out.push(`${cabin} cabin bag${cabin > 1 ? "s" : ""}`);
    if (checked)
      out.push(`${checked} checked bag${checked > 1 ? "s" : ""}`);
    return out;
  };
  var describeStops = (value) => {
    const match = /^\d+/.exec(value);
    if (!match)
      return `stops ${value}`;
    const count = Number(match[0]);
    if (count === 0)
      return "direct";
    return `max ${count} stop${count > 1 ? "s" : ""}`;
  };
  var getOptionSummary = (search) => {
    const parts = [];
    const { bags, sortBy, priceMax } = search.params;
    const stops = search.params.stops ?? search.params.stopNumber ?? search.params.maxStopovers ?? search.params.maxStops;
    if (bags)
      parts.push(...describeBags(bags));
    if (stops)
      parts.push(describeStops(stops));
    if (priceMax)
      parts.push(`max price ${priceMax}`);
    if (sortBy)
      parts.push(SORT_LABELS[sortBy] ?? `sort ${sortBy}`);
    return parts;
  };
  var DEFAULT_PANEL_LAYOUT = {
    right: 18,
    bottom: 18,
    width: 380,
    height: null
  };
  var MIN_PANEL_WIDTH = 280;
  var MIN_PANEL_HEIGHT = 180;
  var VIEWPORT_MARGIN = 16;
  var clamp = (value, min, max) => {
    return Math.round(Math.min(Math.max(value, min), Math.max(min, max)));
  };
  var clampPanelLayout = (layout, viewport, box) => {
    return {
      right: clamp(layout.right, 0, viewport.width - box.width),
      bottom: clamp(layout.bottom, 0, viewport.height - box.height),
      width: clamp(layout.width, MIN_PANEL_WIDTH, viewport.width - VIEWPORT_MARGIN),
      height: layout.height === null ? null : clamp(layout.height, MIN_PANEL_HEIGHT, viewport.height - VIEWPORT_MARGIN)
    };
  };
  var parsePanelLayout = (value) => {
    if (typeof value !== "object" || value === null)
      return DEFAULT_PANEL_LAYOUT;
    const item = value;
    const isNum = (v) => typeof v === "number" && Number.isFinite(v);
    if (!isNum(item.right) || !isNum(item.bottom) || !isNum(item.width))
      return DEFAULT_PANEL_LAYOUT;
    return {
      right: item.right,
      bottom: item.bottom,
      width: item.width,
      height: isNum(item.height) ? item.height : null
    };
  };
  var getLatestSavedSearch = (saved) => {
    return saved.reduce((latest, item) => {
      return !latest || item.updatedAt >= latest.updatedAt ? item : latest;
    }, null);
  };
  var buildLandingDateUrl = (href, outboundDate) => {
    const url = new URL(href);
    if (url.pathname.split("/").filter(Boolean).length > 1)
      return null;
    const inbound = url.searchParams.get("inboundDate");
    if (inbound && inbound !== "no-return")
      return null;
    if (url.searchParams.get("outboundDate") === outboundDate && inbound)
      return null;
    url.searchParams.set("outboundDate", outboundDate);
    url.searchParams.set("inboundDate", "no-return");
    return url.toString();
  };

  // src/kiwi.com/kiwi-saved-searches.user.ts
  var STYLE_ID = "kiwi-saved-searches-style";
  var ROOT_ID = "kiwi-saved-searches-root";
  var STORAGE_KEY = "lb:kiwi:saved-searches:v1";
  var OPEN_KEY = "lb:kiwi:saved-searches:open:v1";
  var LAYOUT_KEY = "lb:kiwi:saved-searches:layout:v1";
  var DATE_REDIRECT_KEY = "lb:kiwi:saved-searches:date-redirect";
  var UNDO_MS = 6000;
  var DRAG_THRESHOLD_PX = 4;
  var DONE_MS = 1200;
  var svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  var ICONS = {
    bookmark: svg('<path d="M6 4h12v16l-6-4-6 4z"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    update: svg('<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>'),
    rename: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'),
    check: svg('<path d="M5 12l5 5 9-10"/>')
  };
  var ui = {
    editingId: null,
    pendingName: "",
    undo: null
  };
  var lastSignature = "";
  var cleanLabel = (value) => {
    return (value ?? "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").replace(/^(From|To)\s+/i, "").trim();
  };
  var getPlaceLabels = (sel) => {
    const root = document.querySelector(sel);
    if (!root)
      return [];
    const labels = Array.from(root.querySelectorAll('[data-test="PlacePickerInputPlace"]')).map((el) => cleanLabel(el.textContent ?? "")).filter(Boolean);
    if (labels.length)
      return labels;
    const fallback = cleanLabel(root.textContent ?? "");
    return fallback ? [fallback] : [];
  };
  var getCurrentPlaceLabels = () => {
    return {
      originLabel: getPlaceLabels('[data-test="PlacePickerInput-origin"]').at(0),
      destinationLabels: getPlaceLabels('[data-test="PlacePickerInput-destination"]')
    };
  };
  var getCurrentDraft = () => {
    return parseKiwiSearchFromUrl(window.location.href, getCurrentPlaceLabels());
  };
  var onStoreError = (error) => {
    console.warn("kiwi saved searches: localStorage failed", error);
  };
  var readSavedSearches = () => {
    return readJsonStore(STORAGE_KEY, [], {
      parse: parseSavedSearches,
      onError: onStoreError
    });
  };
  var writeSavedSearches = (searches) => {
    writeJsonStore(STORAGE_KEY, searches, { onError: onStoreError });
  };
  var isOpen = () => readTextStore(OPEN_KEY, "0") === "1";
  var setOpen = (open) => {
    writeTextStore(OPEN_KEY, open ? "1" : "0");
  };
  var createId = () => {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };
  var toSavedSearch = (draft, existing) => {
    const now = new Date().toISOString();
    return {
      ...draft,
      id: existing?.id ?? createId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
  };
  var getToday = () => {
    const now = new Date;
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };
  var layout = DEFAULT_PANEL_LAYOUT;
  var applyLayout = (root) => {
    const rect = root.getBoundingClientRect();
    layout = clampPanelLayout(layout, { width: window.innerWidth, height: window.innerHeight }, { width: rect.width, height: rect.height });
    root.style.right = `${layout.right}px`;
    root.style.bottom = `${layout.bottom}px`;
    root.style.setProperty("--ks-width", `${layout.width}px`);
    if (layout.height === null) {
      root.style.removeProperty("--ks-height");
      root.style.removeProperty("--ks-max-height");
    } else {
      root.style.setProperty("--ks-height", `${layout.height}px`);
      root.style.setProperty("--ks-max-height", "100vh");
    }
  };
  var saveLayout = () => {
    writeJsonStore(LAYOUT_KEY, layout, { onError: onStoreError });
  };
  var startDrag = (root, event) => {
    if (event.button !== 0 || !(event.target instanceof Element))
      return;
    const target = event.target;
    const grip = target.closest(".ks-resize");
    const handle = grip ?? target.closest(".ks-head, .ks-toggle");
    if (!handle)
      return;
    if (!grip && handle.classList.contains("ks-head") && target.closest("button"))
      return;
    const panel = root.querySelector(".ks-panel");
    const start = { ...layout, x: event.clientX, y: event.clientY };
    const startHeight = panel?.getBoundingClientRect().height ?? 0;
    let moved = false;
    const onMove = (e) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
        return;
      if (!moved) {
        moved = true;
        root.classList.add("ks-dragging");
      }
      layout = grip ? { ...layout, width: start.width - dx, height: startHeight - dy } : { ...layout, right: start.right - dx, bottom: start.bottom - dy };
      applyLayout(root);
    };
    const onEnd = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      if (!moved)
        return;
      root.classList.remove("ks-dragging");
      saveLayout();
      const swallow = (e) => e.stopPropagation();
      root.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => root.removeEventListener("click", swallow, { capture: true }), 0);
    };
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (_e) {}
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
  };
  var resetLayout = (root) => {
    layout = DEFAULT_PANEL_LAYOUT;
    applyLayout(root);
    saveLayout();
  };
  var clearUndo = () => {
    if (ui.undo)
      window.clearTimeout(ui.undo.timer);
    ui.undo = null;
  };
  var saveCurrent = (draft) => {
    const name = ui.pendingName.trim() || draft.name;
    ui.pendingName = "";
    writeSavedSearches([...readSavedSearches(), toSavedSearch({ ...draft, name })]);
    render();
  };
  var updateSavedSearch = (search, draft) => {
    writeSavedSearches(readSavedSearches().map((item) => {
      if (item.id !== search.id)
        return item;
      const name = hasCustomName(item) ? item.name : draft.name;
      return toSavedSearch({ ...draft, name }, item);
    }));
    render();
  };
  var renameSavedSearch = (search, value) => {
    const name = value.trim();
    ui.editingId = null;
    if (name && name !== search.name) {
      writeSavedSearches(readSavedSearches().map((item) => {
        if (item.id !== search.id)
          return item;
        return { ...item, name, updatedAt: new Date().toISOString() };
      }));
    }
    render();
  };
  var deleteSavedSearch = (search) => {
    const searches = readSavedSearches();
    const index = searches.findIndex((item) => item.id === search.id);
    if (index < 0)
      return;
    clearUndo();
    writeSavedSearches(searches.filter((item) => item.id !== search.id));
    ui.undo = {
      search,
      index,
      timer: window.setTimeout(() => {
        ui.undo = null;
        render();
      }, UNDO_MS)
    };
    render();
  };
  var undoDelete = () => {
    const undo = ui.undo;
    if (!undo)
      return;
    clearUndo();
    const searches = readSavedSearches();
    searches.splice(Math.min(undo.index, searches.length), 0, undo.search);
    writeSavedSearches(searches);
    render();
  };
  var makeIconButton = (icon, label, className, onClick) => {
    const btn = createElement("button", {
      className: `ks-icon-btn ${className}`.trim(),
      type: "button",
      title: label,
      ariaLabel: label,
      innerHTML: icon
    });
    btn.addEventListener("click", () => onClick(btn));
    return btn;
  };
  var buildSummary = (search, withRoute) => {
    const parts = [
      ...withRoute ? [describeRoute(search)] : [],
      formatKiwiDate(search.outboundDate, new Date().getFullYear()),
      ...getOptionSummary(search)
    ];
    return createElement("span", { className: "ks-row-sub" }, parts.map((part) => createElement("span", {}, [part])));
  };
  var buildCurrentCard = (draft) => {
    const input = createElement("input", {
      className: "ks-name-input",
      type: "text",
      placeholder: "Name (optional)",
      ariaLabel: "Name for this search",
      value: ui.pendingName,
      maxLength: 80
    });
    input.addEventListener("input", () => {
      ui.pendingName = input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter")
        saveCurrent(draft);
    });
    const saveBtn = createElement("button", { className: "ks-btn", type: "button" }, ["Save"]);
    saveBtn.addEventListener("click", () => saveCurrent(draft));
    return createElement("div", { className: "ks-card" }, [
      createElement("div", {}, [
        createElement("div", { className: "ks-row-title" }, [
          createElement("span", { className: "ks-ellipsis" }, [describeRoute(draft)])
        ]),
        buildSummary(draft, false)
      ]),
      createElement("div", { className: "ks-save" }, [input, saveBtn])
    ]);
  };
  var buildRenameRow = (search) => {
    const input = createElement("input", {
      className: "ks-name-input",
      type: "text",
      ariaLabel: "Rename saved search",
      value: hasCustomName(search) ? search.name : "",
      placeholder: describeRoute(search),
      maxLength: 80
    });
    let done = false;
    const finish = (value) => {
      if (done)
        return;
      done = true;
      renameSavedSearch(search, value);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter")
        finish(input.value);
      if (event.key === "Escape") {
        event.stopPropagation();
        finish("");
      }
    });
    input.addEventListener("blur", () => finish(input.value));
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return createElement("div", { className: "ks-row" }, [
      createElement("div", { className: "ks-rename" }, [input])
    ]);
  };
  var buildSavedRow = (search, draft, today) => {
    if (ui.editingId === search.id)
      return buildRenameRow(search);
    const isActive = !!draft && isSameSearch(search, draft);
    const isPast = isPastKiwiDate(search.outboundDate, today);
    const named = hasCustomName(search);
    const url = buildKiwiSearchUrl(search);
    const title = createElement("span", { className: "ks-row-title" }, [
      createElement("span", { className: "ks-ellipsis" }, [
        named ? search.name : describeRoute(search)
      ])
    ]);
    if (isActive)
      title.appendChild(createElement("span", { className: "ks-badge" }, ["Current"]));
    if (isPast) {
      title.appendChild(createElement("span", { className: "ks-badge ks-badge-past" }, ["Past"]));
    }
    const main = createElement("a", { className: "ks-row-main", href: url, title: "Open search" }, [
      title,
      buildSummary(search, named)
    ]);
    const actions = createElement("div", { className: "ks-row-actions" });
    if (draft && !isActive) {
      actions.appendChild(makeIconButton(ICONS.update, "Replace with the current search", "", () => updateSavedSearch(search, draft)));
    }
    actions.appendChild(makeIconButton(ICONS.rename, "Rename", "", () => {
      ui.editingId = search.id;
      render();
    }));
    actions.appendChild(makeIconButton(ICONS.link, "Copy link", "", (btn) => {
      copyTextWithFallback(url, "Copy this search link").then((ok) => {
        if (!ok)
          return;
        btn.innerHTML = ICONS.check;
        btn.classList.add("ks-done");
        window.setTimeout(() => {
          btn.innerHTML = ICONS.link;
          btn.classList.remove("ks-done");
        }, DONE_MS);
      }).catch((error) => console.warn("kiwi saved searches: copy failed", error));
    }));
    actions.appendChild(makeIconButton(ICONS.trash, "Delete", "ks-danger", () => deleteSavedSearch(search)));
    const classes = ["ks-row", isActive ? "ks-row-active" : "", isPast ? "ks-row-past" : ""];
    return createElement("div", { className: classes.filter(Boolean).join(" ") }, [main, actions]);
  };
  var closePanel = () => {
    ui.editingId = null;
    setOpen(false);
    render();
    document.querySelector(`#${ROOT_ID} .ks-toggle`)?.focus();
  };
  var buildPanel = (saved, draft) => {
    const body = createElement("div", { className: "ks-body" });
    const isSaved = !!draft && saved.some((item) => isSameSearch(item, draft));
    if (draft && !isSaved) {
      body.appendChild(createElement("div", { className: "ks-label" }, ["Current search"]));
      body.appendChild(buildCurrentCard(draft));
    } else if (!draft) {
      body.appendChild(createElement("div", { className: "ks-hint" }, [
        "Open a one-way flight search to save it here."
      ]));
    }
    if (saved.length) {
      const today = getToday();
      body.appendChild(createElement("div", { className: "ks-label" }, [`Saved (${saved.length})`]));
      saved.forEach((search) => body.appendChild(buildSavedRow(search, draft, today)));
    } else {
      body.appendChild(createElement("div", { className: "ks-hint" }, [
        "Nothing saved yet. Searches are stored in this browser only."
      ]));
    }
    const panel = createElement("div", { className: "ks-panel" }, [
      createElement("div", { className: "ks-head" }, [
        createElement("div", { className: "ks-title" }, ["Saved searches"]),
        makeIconButton(ICONS.close, "Close", "", closePanel)
      ]),
      body
    ]);
    const grip = createElement("div", { className: "ks-resize", title: "Drag to resize" });
    panel.appendChild(grip);
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Saved searches");
    const undo = ui.undo;
    if (undo) {
      const label = hasCustomName(undo.search) ? undo.search.name : describeRoute(undo.search);
      const undoBtn = createElement("button", { className: "ks-link-btn", type: "button" }, ["Undo"]);
      undoBtn.addEventListener("click", undoDelete);
      const bar = createElement("div", { className: "ks-undo" }, [
        createElement("span", { className: "ks-ellipsis" }, [`Deleted ${label}`]),
        undoBtn
      ]);
      bar.setAttribute("role", "status");
      panel.appendChild(bar);
    }
    return panel;
  };
  var buildToggle = (count) => {
    const toggle = createElement("button", {
      className: "ks-toggle",
      type: "button",
      innerHTML: ICONS.bookmark
    });
    toggle.setAttribute("aria-expanded", "false");
    toggle.appendChild(createElement("span", {}, ["Saved searches"]));
    if (count)
      toggle.appendChild(createElement("span", { className: "ks-count" }, [String(count)]));
    toggle.addEventListener("click", () => {
      setOpen(true);
      render();
    });
    return toggle;
  };
  var ensureRoot = () => {
    const existing = document.getElementById(ROOT_ID);
    if (existing)
      return existing;
    const root = createElement("div", { id: ROOT_ID });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen())
        closePanel();
    });
    root.addEventListener("pointerdown", (event) => startDrag(root, event));
    root.addEventListener("dblclick", (event) => {
      if (event.target instanceof Element && event.target.closest(".ks-resize"))
        resetLayout(root);
    });
    layout = readJsonStore(LAYOUT_KEY, DEFAULT_PANEL_LAYOUT, {
      parse: parsePanelLayout,
      onError: onStoreError
    });
    document.body.appendChild(root);
    lastSignature = "";
    return root;
  };
  function render() {
    injectCSS(STYLE_ID, kiwi_saved_searches_default);
    const root = ensureRoot();
    const open = isOpen();
    const saved = readSavedSearches();
    const draft = open ? getCurrentDraft() : null;
    const signature = JSON.stringify([
      open,
      open ? saved : saved.length,
      draft,
      ui.editingId,
      ui.undo?.search.id,
      getToday()
    ]);
    if (signature === lastSignature)
      return;
    lastSignature = signature;
    root.replaceChildren(open ? buildPanel(saved, draft) : buildToggle(saved.length));
    applyLayout(root);
  }
  var main = () => {
    const renderSoon = () => {
      render();
      window.setTimeout(render, 800);
    };
    renderSoon();
    watchLocationChange(renderSoon, { debounceMs: 120 });
    window.addEventListener("resize", () => {
      const root = document.getElementById(ROOT_ID);
      if (root)
        applyLayout(root);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === OPEN_KEY)
        render();
    });
  };
  var applySavedDates = () => {
    try {
      if (window.sessionStorage.getItem(DATE_REDIRECT_KEY)) {
        window.sessionStorage.removeItem(DATE_REDIRECT_KEY);
        return false;
      }
      const latest = getLatestSavedSearch(readSavedSearches());
      if (!latest || isPastKiwiDate(latest.outboundDate, getToday()))
        return false;
      const url = buildLandingDateUrl(window.location.href, latest.outboundDate);
      if (!url)
        return false;
      window.sessionStorage.setItem(DATE_REDIRECT_KEY, "1");
      window.location.replace(url);
      return true;
    } catch (error) {
      console.warn("kiwi saved searches: could not apply saved dates", error);
      return false;
    }
  };
  if (!applySavedDates())
    runWhenReady(main);
})();
