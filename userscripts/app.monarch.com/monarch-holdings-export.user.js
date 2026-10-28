// ==UserScript==
// @name                 Monarch Holdings Export
// @author               AZ
// @description          add an Export CSV button to the Monarch investment holdings page
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-holdings-export.user.js
// @grant                none
// @match                https://app.monarch.com/*
// @match                https://app.monarchmoney.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-holdings-export.user.js
// @version              1.1.0
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

  // src/app.monarch.com/monarch-holdings-export.user.ts
  var exports_monarch_holdings_export_user = {};

  // src/lib/csv.ts
  var escapeCsv = (value) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  var toCsv = (header, rows) => [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join(`
`) + `
`;
  var downloadCsv = (filename, csv) => {
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // src/lib/dom.ts
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

  // src/lib/text.ts
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/app.monarch.com/monarch-holdings-export.helpers.ts
  var MONEY_RE = /^(-?)\$?(-?)([\d,]+(?:\.\d+)?)$/;
  var plainNumber = (text) => {
    const match = MONEY_RE.exec(text.trim());
    if (!match)
      return text.trim();
    const [, sign, innerSign, digits] = match;
    return `${sign || innerSign}${digits.replace(/,/g, "")}`;
  };

  // src/app.monarch.com/monarch-holdings-export.user.ts
  var HOLDINGS_PATH = "/investments/holdings";
  var BUTTON_ID = "monarch-holdings-export-button";
  var sels = {
    addHolding: 'a[href$="/add-holding"]',
    text: '[data-sc-tw="Text__Text"]'
  };
  var cellText = (el) => normalizeWhitespace((el?.innerText ?? "").replace(/[\uE000-\uF8FF]/g, ""));
  var findHoldingsTable = () => Array.from(document.querySelectorAll("table")).find((table) => cellText(table.tHead?.rows[0]?.cells[0]) === "Security") ?? null;
  var readHoldings = (table) => {
    const labels = Array.from(table.tHead?.rows[0]?.cells ?? []).map(cellText);
    const valueCols = labels.map((label, idx) => idx > 0 && label ? idx : -1).filter((i) => i > 0);
    const header = ["Group", "Symbol", "Name", ...valueCols.map((idx) => labels[idx])];
    const rows = [];
    let group = "";
    for (const row of Array.from(table.tBodies[0]?.rows ?? [])) {
      const values = valueCols.map((idx) => cellText(row.cells[idx]));
      if (values.every((value) => !value)) {
        group = cellText(row.cells[0]);
        continue;
      }
      const [first = "", second = ""] = Array.from(row.cells[0]?.querySelectorAll(sels.text) ?? []).map(cellText);
      const [symbol, name] = second ? [first, second] : ["", first || cellText(row.cells[0])];
      rows.push([group, symbol, name, ...values.map(plainNumber)]);
    }
    return { header, rows };
  };
  var exportHoldings = () => {
    const table = findHoldingsTable();
    const holdings = table ? readHoldings(table) : null;
    if (!holdings?.rows.length) {
      window.alert("No holdings found. Wait for the holdings table to load and try again.");
      return;
    }
    const date = new Date().toLocaleDateString("en-CA");
    downloadCsv(`monarch-holdings-${date}.csv`, toCsv(holdings.header, holdings.rows));
  };
  var syncButton = () => {
    const toolbar = document.querySelector(sels.addHolding)?.parentElement;
    if (!toolbar || document.getElementById(BUTTON_ID))
      return;
    const button = createElement("button", { id: BUTTON_ID, type: "button", className: toolbar.querySelector("button")?.className ?? "" }, ["Export CSV"]);
    button.addEventListener("click", exportHoldings);
    toolbar.prepend(button);
  };
  var isHoldingsPage = () => window.location.pathname.startsWith(HOLDINGS_PATH);
  var observer = observeDomChanges(syncButton, { debounceMs: 250 });
  var onRoute = () => {
    if (!isHoldingsPage()) {
      observer.disconnect();
      return;
    }
    observer.observe(document.body);
    syncButton();
  };
  watchLocationChange(onRoute);
  onRoute();
})();
