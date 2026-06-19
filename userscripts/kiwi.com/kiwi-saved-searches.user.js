// ==UserScript==
// @name                 Kiwi Saved Searches
// @author               AZ
// @description          saves and reloads one-way Kiwi.com flight searches
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/kiwi.com/kiwi-saved-searches.user.js
// @grant                none
// @match                https://www.kiwi.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/kiwi.com/kiwi-saved-searches.user.js
// @version              0.1.0
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

  // src/kiwi.com/kiwi-saved-searches.helpers.ts
  var EXCLUDED_QUERY_KEYS = new Set(["origin", "destination", "outboundDate", "inboundDate"]);
  var cleanText = (value) => {
    return (value ?? "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
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
  var getOptionSummary = (search) => {
    const parts = [`type: ${search.tripType}`];
    const bags = search.params.bags;
    const stops = search.params.stops ?? search.params.stopNumber ?? search.params.maxStopovers ?? search.params.maxStops;
    if (bags)
      parts.push(`bags: ${bags}`);
    if (stops)
      parts.push(`stops: ${stops}`);
    if (search.params.sortBy)
      parts.push(`sort: ${search.params.sortBy}`);
    return parts;
  };

  // src/kiwi.com/kiwi-saved-searches.user.ts
  var STYLE_ID = "kiwi-saved-searches-style";
  var ROOT_ID = "kiwi-saved-searches-root";
  var STORAGE_KEY = "lb:kiwi:saved-searches:v1";
  var OPEN_KEY = "lb:kiwi:saved-searches:open:v1";
  var CSS = `
  #${ROOT_ID} {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #172b4d;
  }

  #${ROOT_ID} button,
  #${ROOT_ID} input {
    font: inherit;
  }

  .ks-toggle {
    min-height: 42px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: #00a991;
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }

  .ks-panel {
    width: min(420px, calc(100vw - 36px));
    max-height: min(680px, calc(100vh - 36px));
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid rgba(23, 43, 77, 0.12);
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 18px 54px rgba(9, 30, 66, 0.24);
    overflow: auto;
  }

  .ks-head,
  .ks-actions,
  .ks-row-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ks-head {
    justify-content: space-between;
  }

  .ks-title {
    font-size: 14px;
    font-weight: 900;
  }

  .ks-close {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    cursor: pointer;
  }

  .ks-card,
  .ks-row {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
  }

  .ks-row {
    background: #fff;
  }

  .ks-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #64748b;
    text-transform: uppercase;
  }

  .ks-row-header {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  .ks-row-name {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #00a991;
  }

  .ks-route {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.3;
    color: #0f172a;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ks-row-footer {
    display: none;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ks-row:hover .ks-row-footer {
    display: flex;
  }

  /* always show footer in the current-search card */
  .ks-card:hover .ks-row-footer {
    display: flex;
  }

  .ks-meta {
    display: contents;
  }

  .ks-pill {
    padding: 2px 5px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #475569;
    font-size: 10px;
  }

  .ks-divider {
    width: 1px;
    height: 12px;
    background: #cbd5e1;
    flex-shrink: 0;
  }

  .ks-empty,
  .ks-hint {
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
  }

  .ks-name-input {
    min-width: 0;
    flex: 1;
    height: 34px;
    padding: 0 10px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
    color: #0f172a;
  }

  .ks-btn {
    min-height: 22px;
    padding: 0 7px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
    color: #0f172a;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .ks-btn:hover {
    border-color: #00a991;
    color: #007f6d;
  }

  .ks-btn:active {
    transform: scale(0.91);
    opacity: 0.65;
  }

  .ks-btn-done {
    border-color: #00a991 !important;
    color: #00a991 !important;
    background: #f0fdf9 !important;
    pointer-events: none;
  }

  .ks-btn-lg {
    min-height: 30px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 800;
    border-radius: 8px;
  }

  .ks-primary {
    border-color: #00a991;
    background: #00a991;
    color: #fff;
  }

  .ks-primary:hover {
    color: #fff;
  }

  .ks-row-active {
    border-color: #00a991;
    background: #f0fdf9;
  }

  .ks-danger:hover {
    border-color: #dc2626;
    color: #dc2626;
  }

  .ks-row-active {
    border-color: #00a991;
    background: #f0fdf9;
  }

  .ks-badge-current {
    flex-shrink: 0;
    padding: 1px 5px;
    border-radius: 999px;
    background: #00a991;
    color: #fff;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
`;
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
  var readSavedSearches = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed))
        return [];
      return parsed.filter((item) => {
        return typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.name === "string" && item.tripType === "one-way" && typeof item.originSlug === "string" && Array.isArray(item.destinationSlugs) && typeof item.outboundDate === "string";
      });
    } catch (error) {
      console.warn("kiwi saved searches: failed to read localStorage", error);
      return [];
    }
  };
  var writeSavedSearches = (searches) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
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
  var getCurrentDraft = () => {
    return parseKiwiSearchFromUrl(window.location.href, getCurrentPlaceLabels());
  };
  var setOpen = (open) => {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  };
  var isOpen = () => {
    return window.localStorage.getItem(OPEN_KEY) === "1";
  };
  var describeRoute = (search) => {
    return `${search.originLabel} -> ${search.destinationLabels.join(", ")} on ${search.outboundDate}`;
  };
  var appendMeta = (parent, search) => {
    const meta = createElement("div", { className: "ks-meta" });
    getOptionSummary(search).filter((part) => !part.startsWith("type:")).forEach((part) => {
      meta.appendChild(createElement("span", { className: "ks-pill" }, [part]));
    });
    parent.appendChild(meta);
  };
  var makeButton = (label, className, onClick) => {
    const button = createElement("button", { className, type: "button" }, [label]);
    button.addEventListener("click", onClick);
    return button;
  };
  var flashDone = (btn, original, done = "✓", ms = 1100) => {
    btn.textContent = done;
    btn.classList.add("ks-btn-done");
    btn.disabled = true;
    window.setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("ks-btn-done");
      btn.disabled = false;
    }, ms);
  };
  var saveCurrent = (draft) => {
    const name = window.prompt("Name this Kiwi search", draft.name)?.trim();
    if (!name)
      return;
    const searches = readSavedSearches();
    writeSavedSearches([...searches, toSavedSearch({ ...draft, name })]);
    render();
  };
  var applyUpdateSavedSearch = (search) => {
    const draft = getCurrentDraft();
    if (!draft) {
      window.alert("Open a one-way Kiwi search first.");
      return false;
    }
    const searches = readSavedSearches();
    writeSavedSearches(searches.map((item) => {
      if (item.id !== search.id)
        return item;
      return toSavedSearch({ ...draft, name: item.name }, item);
    }));
    return true;
  };
  var renameSavedSearch = (search) => {
    const name = window.prompt("Rename Kiwi search", search.name)?.trim();
    if (!name)
      return;
    const searches = readSavedSearches();
    writeSavedSearches(searches.map((item) => {
      if (item.id !== search.id)
        return item;
      return { ...item, name, updatedAt: new Date().toISOString() };
    }));
    render();
  };
  var deleteSavedSearch = (search) => {
    if (!window.confirm(`Delete "${search.name}"?`))
      return;
    writeSavedSearches(readSavedSearches().filter((item) => item.id !== search.id));
    render();
  };
  var copySavedUrl = async (search) => {
    await navigator.clipboard.writeText(buildKiwiSearchUrl(search));
  };
  var loadSavedSearch = (search) => {
    window.location.assign(buildKiwiSearchUrl(search));
  };
  var renderCurrentCard = (panel, saved) => {
    const draft = getCurrentDraft();
    if (draft && saved.some((s) => isSameSearch(s, draft)))
      return;
    const card = createElement("div", { className: "ks-card" });
    card.appendChild(createElement("div", { className: "ks-label" }, ["Current one-way search"]));
    if (!draft) {
      card.appendChild(createElement("div", { className: "ks-empty" }, [
        "Open or build a one-way Kiwi flight search, then save it here."
      ]));
      panel.appendChild(card);
      return;
    }
    const cardHeader = createElement("div", { className: "ks-row-header" });
    cardHeader.appendChild(createElement("span", { className: "ks-route" }, [describeRoute(draft)]));
    card.appendChild(cardHeader);
    const cardFooter = createElement("div", { className: "ks-row-footer" });
    appendMeta(cardFooter, draft);
    cardFooter.appendChild(createElement("span", { className: "ks-divider" }));
    cardFooter.appendChild(makeButton("Save", "ks-btn ks-primary", () => saveCurrent(draft)));
    card.appendChild(cardFooter);
    panel.appendChild(card);
  };
  var renderSavedRow = (search, isActive = false) => {
    const row = createElement("div", { className: isActive ? "ks-row ks-row-active" : "ks-row" });
    const header = createElement("div", { className: "ks-row-header" });
    header.appendChild(createElement("span", { className: "ks-row-name" }, [search.name]));
    header.appendChild(createElement("span", { className: "ks-route" }, [describeRoute(search)]));
    row.appendChild(header);
    const footer = createElement("div", { className: "ks-row-footer" });
    appendMeta(footer, search);
    footer.appendChild(createElement("span", { className: "ks-divider" }));
    footer.appendChild(makeButton("Load", "ks-btn ks-primary", () => loadSavedSearch(search)));
    const updBtn = makeButton("Upd", "ks-btn", () => {
      const ok = applyUpdateSavedSearch(search);
      if (!ok)
        return;
      flashDone(updBtn, "Upd", "✓ Done");
      window.setTimeout(render, 1200);
    });
    footer.appendChild(updBtn);
    footer.appendChild(makeButton("Ren", "ks-btn", () => renameSavedSearch(search)));
    const urlBtn = makeButton("URL", "ks-btn", () => {
      copySavedUrl(search).then(() => flashDone(urlBtn, "URL", "Copied!")).catch((error) => console.warn("kiwi saved searches: copy failed", error));
    });
    footer.appendChild(urlBtn);
    footer.appendChild(makeButton("Del", "ks-btn ks-danger", () => deleteSavedSearch(search)));
    row.appendChild(footer);
    return row;
  };
  var renderPanel = (root) => {
    const panel = createElement("div", { className: "ks-panel" });
    panel.appendChild(createElement("div", { className: "ks-head" }, [
      createElement("div", { className: "ks-title" }, ["Kiwi saved searches"]),
      makeButton("x", "ks-close", () => {
        setOpen(false);
        render();
      })
    ]));
    const saved = readSavedSearches();
    renderCurrentCard(panel, saved);
    panel.appendChild(createElement("div", { className: "ks-label" }, [`Saved (${saved.length})`]));
    if (!saved.length) {
      panel.appendChild(createElement("div", { className: "ks-hint" }, [
        "Saved searches live in Kiwi localStorage for this browser profile."
      ]));
    } else {
      const currentDraft = getCurrentDraft();
      saved.forEach((search) => panel.appendChild(renderSavedRow(search, !!currentDraft && isSameSearch(search, currentDraft))));
    }
    root.appendChild(panel);
  };
  function render() {
    injectCSS(STYLE_ID, CSS);
    const existing = document.getElementById(ROOT_ID);
    existing?.remove();
    const root = createElement("div", { id: ROOT_ID });
    if (isOpen()) {
      renderPanel(root);
    } else {
      root.appendChild(makeButton("Kiwi searches", "ks-toggle", () => {
        setOpen(true);
        render();
      }));
    }
    document.body.appendChild(root);
  }
  var main = () => {
    render();
    window.setTimeout(render, 800);
    watchLocationChange(() => {
      render();
      window.setTimeout(render, 800);
    }, { debounceMs: 120 });
  };
  runWhenReady(main);
})();
