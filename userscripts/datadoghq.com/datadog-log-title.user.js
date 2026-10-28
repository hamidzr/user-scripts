// ==UserScript==
// @name                 Datadog Log Title
// @author               Zare
// @description          extend Datadog Log Explorer tab titles with key query facets so many open tabs stay distinguishable
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/datadoghq.com/datadog-log-title.user.js
// @grant                none
// @match                https://app.datadoghq.com/logs*
// @match                https://app.datadoghq.eu/logs*
// @match                https://app.us3.datadoghq.com/logs*
// @match                https://app.us5.datadoghq.com/logs*
// @match                https://app.ap1.datadoghq.com/logs*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/datadoghq.com/datadog-log-title.user.js
// @version              0.2.0
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

  // src/datadoghq.com/datadog-log-title.user.ts
  var exports_datadog_log_title_user = {};

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

  // src/datadoghq.com/datadog-log-title.user.ts
  var FACET_ORDER = [
    {
      key: "service",
      format: (v) => v.replace(/\.app$/, "").replace(/-(api|service|worker|consumer|producer)$/, "")
    },
    { key: "env" },
    { key: "status" },
    { key: "host" },
    { key: "source" },
    { key: "index" }
  ];
  var KEYWORD_MAX_LEN = 30;
  var SENTINEL = "​";
  var SEP = " · ";
  var SAVED_VIEW_PARAM = "saved-view-id";
  var SAVED_VIEW_TITLE_SEL = ".druids_saved-views_saved-views-title__title";
  var SAVED_VIEW_POLL_MS = 250;
  var SAVED_VIEW_MAX_POLLS = 20;
  var getSavedViewName = () => {
    const root = document.querySelector(SAVED_VIEW_TITLE_SEL);
    if (!root)
      return "";
    const original = root.querySelector(".druids_layout_overflower__original");
    const text = (original?.textContent ?? root.textContent ?? "").trim();
    if (original)
      return text;
    const half = text.length / 2;
    return Number.isInteger(half) && text.slice(0, half) === text.slice(half) ? text.slice(0, half) : text;
  };
  var parseQuery = (raw) => {
    const facets = new Map;
    const keywords = [];
    const re = /(-?)("[^"]*"|\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m[1] === "-")
        continue;
      let tok = m[2];
      if (!tok.startsWith('"')) {
        tok = tok.replace(/^\(+/, "").replace(/\)+$/, "");
        if (!tok)
          continue;
        const upper = tok.toUpperCase();
        if (upper === "OR" || upper === "AND" || upper === "NOT")
          continue;
      }
      const colon = !tok.startsWith('"') ? tok.indexOf(":") : -1;
      if (colon > 0) {
        const key = tok.slice(0, colon).toLowerCase();
        const val = tok.slice(colon + 1).replace(/^"|"$/g, "");
        const arr = facets.get(key) ?? [];
        arr.push(val);
        facets.set(key, arr);
      } else {
        keywords.push(tok.replace(/^"|"$/g, ""));
      }
    }
    return { facets, keywords };
  };
  var buildPrefix = (url) => {
    const parsed = parseQuery(url.searchParams.get("query") ?? "");
    const parts = [];
    const pathSuffix = url.pathname.replace(/^\/logs\/?/, "").replace(/\/$/, "");
    if (pathSuffix)
      parts.push(pathSuffix);
    for (const rule of FACET_ORDER) {
      const vals = parsed.facets.get(rule.key);
      if (!vals || vals.length === 0)
        continue;
      const display = vals.map((v) => rule.format ? rule.format(v) : v).filter((v) => v.length > 0).join(",");
      if (display)
        parts.push(display);
    }
    const kw = parsed.keywords.find((k) => k.length > 0 && k.length <= KEYWORD_MAX_LEN);
    if (kw)
      parts.push(`"${kw}"`);
    return parts.join(" ");
  };
  var stripOurs = (title) => {
    if (!title.startsWith(SENTINEL))
      return title;
    const idx = title.indexOf(SEP);
    return idx > 0 ? title.slice(idx + SEP.length) : title.slice(SENTINEL.length);
  };
  var savedViewPollTimer;
  var savedViewPolls = 0;
  var applyTitle = () => {
    const url = new URL(window.location.href);
    const savedViewActive = url.searchParams.has(SAVED_VIEW_PARAM);
    const savedViewName = savedViewActive ? getSavedViewName() : "";
    const prefix = savedViewName || buildPrefix(url);
    const current = document.title;
    const base = stripOurs(current);
    const next = prefix ? `${SENTINEL}${prefix}${SEP}${base}` : base;
    if (next !== current)
      document.title = next;
    if (savedViewPollTimer !== undefined) {
      clearTimeout(savedViewPollTimer);
      savedViewPollTimer = undefined;
    }
    if (savedViewActive && !savedViewName && savedViewPolls < SAVED_VIEW_MAX_POLLS) {
      savedViewPolls += 1;
      savedViewPollTimer = window.setTimeout(applyTitle, SAVED_VIEW_POLL_MS);
    }
  };
  new MutationObserver(applyTitle).observe(document.head, {
    childList: true,
    characterData: true,
    subtree: true
  });
  watchLocationChange(() => {
    savedViewPolls = 0;
    applyTitle();
  }, { debounceMs: 150 });
  applyTitle();
})();
