// ==UserScript==
// @name                 Monarch Bulk Select
// @author               AZ
// @description          shift-click transaction checkboxes in Monarch to select a range
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-bulk-select.user.js
// @grant                none
// @match                https://app.monarch.com/*
// @match                https://app.monarchmoney.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-bulk-select.user.js
// @version              1.0.0
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

  // src/app.monarch.com/monarch-bulk-select.user.ts
  var exports_monarch_bulk_select_user = {};
  var ROW_SEL = 'div[class*="TransactionsList__TransactionRowContainer"]';
  var LIST_SEL = '[data-testid="virtuoso-item-list"], [data-test-id="virtuoso-item-list"]';
  var rangeInProgress = false;
  var anchor = null;
  var pendingShiftAnchor = null;
  var DEBUG_ATTR = "data-monarch-bulk-select-logs";
  var log = (...args) => {
    const root = document.documentElement;
    const existing = root.getAttribute(DEBUG_ATTR);
    const logs = existing ? JSON.parse(existing) : [];
    logs.push(args);
    root.setAttribute(DEBUG_ATTR, JSON.stringify(logs));
    console.log("[Monarch Bulk Select]", ...args);
  };
  var isCheckbox = (el) => el instanceof HTMLInputElement && el.type === "checkbox";
  var resolveCheckboxFromTarget = (target) => {
    if (!(target instanceof Element))
      return null;
    if (isCheckbox(target))
      return target;
    const label = target.closest("label");
    const labelCheckbox = label?.querySelector('input[type="checkbox"]') ?? null;
    if (isCheckbox(labelCheckbox))
      return labelCheckbox;
    const nestedCheckbox = target.querySelector('input[type="checkbox"]');
    return isCheckbox(nestedCheckbox) ? nestedCheckbox : null;
  };
  var getRow = (checkbox) => checkbox.closest(ROW_SEL);
  var getItem = (checkbox) => checkbox.closest("[data-index]");
  var getListRoot = (checkbox) => checkbox.closest(LIST_SEL) ?? getRow(checkbox)?.parentElement ?? null;
  var getAbsIndex = (checkbox) => {
    const value = getItem(checkbox)?.getAttribute("data-index");
    return value === null || value === undefined ? -1 : Number(value);
  };
  var getScrollRoot = (checkbox) => {
    let cur = getListRoot(checkbox)?.parentElement ?? checkbox.parentElement;
    while (cur) {
      if (cur.scrollHeight > cur.clientHeight + 10 && getComputedStyle(cur).overflowY === "auto") {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  };
  var getMountedRangeCheckboxes = (listRoot, lo, hi) => Array.from(listRoot.querySelectorAll(`${ROW_SEL} input[type="checkbox"]`)).map((checkbox) => ({ absIndex: getAbsIndex(checkbox), checkbox })).filter((item) => item.absIndex >= lo && item.absIndex <= hi);
  var wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  var syncRange = async (anchorState, to) => {
    const listRoot = getListRoot(to);
    const scrollRoot = getScrollRoot(to);
    const startIdx = anchorState.absIndex;
    const endIdx = getAbsIndex(to);
    if (!listRoot || !scrollRoot || startIdx === -1 || endIdx === -1) {
      log("abort syncRange", {
        startIdx,
        endIdx,
        hasListRoot: Boolean(listRoot),
        hasScrollRoot: Boolean(scrollRoot)
      });
      return;
    }
    const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const targetState = to.checked;
    const scrollStep = Math.max(200, Math.floor(scrollRoot.clientHeight * 0.7));
    const scrollDir = startIdx < endIdx ? -1 : 1;
    const visited = new Set;
    log("syncRange", {
      startIdx,
      endIdx,
      lo,
      hi,
      targetState,
      scrollStep,
      scrollDir
    });
    rangeInProgress = true;
    try {
      for (let attempt = 0;attempt < 80; attempt += 1) {
        const mounted = getMountedRangeCheckboxes(listRoot, lo, hi);
        const mountedAbs = mounted.map((item) => item.absIndex);
        for (const { absIndex, checkbox } of mounted) {
          visited.add(absIndex);
          if (checkbox === to)
            continue;
          if (checkbox.checked === targetState)
            continue;
          log("toggle checkbox", { idx: absIndex, from: checkbox.checked, to: targetState });
          checkbox.click();
        }
        const minMounted = mountedAbs.length > 0 ? Math.min(...mountedAbs) : Infinity;
        const maxMounted = mountedAbs.length > 0 ? Math.max(...mountedAbs) : -Infinity;
        const reachedAnchor = scrollDir < 0 ? minMounted <= lo || scrollRoot.scrollTop <= 0 : maxMounted >= hi;
        log("range progress", {
          attempt,
          mountedAbs,
          visitedCount: visited.size,
          scrollTop: scrollRoot.scrollTop,
          reachedAnchor
        });
        if (reachedAnchor)
          break;
        scrollRoot.scrollTop = Math.max(0, scrollRoot.scrollTop + scrollDir * scrollStep);
        await wait(80);
      }
    } finally {
      rangeInProgress = false;
    }
  };
  document.addEventListener("click", (event) => {
    const checkbox = resolveCheckboxFromTarget(event.target);
    if (!checkbox)
      return;
    if (!getRow(checkbox) || rangeInProgress)
      return;
    const absIndex = getAbsIndex(checkbox);
    if (absIndex === -1)
      return;
    log("click", {
      absIndex,
      shiftKey: event.shiftKey,
      checked: checkbox.checked,
      anchor
    });
    pendingShiftAnchor = event.shiftKey ? anchor : null;
    if (pendingShiftAnchor) {
      log("set pending shift anchor", pendingShiftAnchor);
    }
  }, true);
  document.addEventListener("change", (event) => {
    const checkbox = resolveCheckboxFromTarget(event.target);
    if (!checkbox)
      return;
    const row = getRow(checkbox);
    if (!row)
      return;
    const absIndex = getAbsIndex(checkbox);
    if (absIndex === -1)
      return;
    const previousAnchor = pendingShiftAnchor;
    pendingShiftAnchor = null;
    if (rangeInProgress) {
      log("change during range", { absIndex, checked: checkbox.checked });
      return;
    }
    log("change", {
      absIndex,
      checked: checkbox.checked,
      previousAnchor
    });
    if (previousAnchor && previousAnchor.absIndex !== absIndex) {
      syncRange(previousAnchor, checkbox);
    }
    anchor = { absIndex };
    log("set anchor", anchor);
  }, true);
})();
