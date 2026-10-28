// ==UserScript==
// @name                 Monarch Bulk Select
// @author               AZ
// @description          shift-click transaction checkboxes in Monarch and export selected transactions
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-bulk-select.user.js
// @grant                none
// @match                https://app.monarch.com/*
// @match                https://app.monarchmoney.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-bulk-select.user.js
// @version              1.1.1
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

  // src/lib/poll.ts
  var sleep = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  // src/app.monarch.com/monarch-bulk-select.user.ts
  var ROW_SEL = 'div[class*="TransactionsList__TransactionRowContainer"]';
  var LIST_SEL = '[data-testid="virtuoso-item-list"], [data-test-id="virtuoso-item-list"]';
  var HEADER_SEL = 'div[class*="TransactionListHeader__ListHeader"]';
  var HEADER_ACTIONS_SEL = 'div[class*="TransactionListHeader__HeaderActions"]';
  var SECTION_HEADER_SEL = 'div[class*="TransactionsList__StyledSectionHeader"], div[class*="SectionHeader"]';
  var CSV_BUTTON_ID = "monarch-bulk-select-csv-button";
  var STYLE_ID = "monarch-bulk-select-styles";
  var SCAN_DELAY_MS = 120;
  var MAX_SCAN_STEPS = 500;
  var SELECTED_COUNT_RE = /(\d[\d,]*)\s+transactions?\s+selected/i;
  var DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i;
  var CSV_HEADERS = ["date", "merchant", "category", "account", "amount", "list_index"];
  var CSV_STYLE = `
  #${CSV_BUTTON_ID} {
    border: 1px solid rgb(209 213 219);
    border-radius: 8px;
    background: white;
    color: rgb(17 24 39);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    min-height: 36px;
    padding: 7px 12px;
    white-space: nowrap;
  }

  #${CSV_BUTTON_ID}:hover {
    background: rgb(249 250 251);
  }

  #${CSV_BUTTON_ID}:disabled {
    cursor: wait;
    opacity: 0.65;
  }
`;
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
  var findScrollRoot = (el) => {
    let cur = el?.parentElement ?? null;
    while (cur) {
      if (cur.scrollHeight > cur.clientHeight + 10 && getComputedStyle(cur).overflowY === "auto") {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  };
  var getScrollRoot = (checkbox) => findScrollRoot(getListRoot(checkbox) ?? checkbox);
  var getMountedRangeCheckboxes = (listRoot, lo, hi) => Array.from(listRoot.querySelectorAll(`${ROW_SEL} input[type="checkbox"]`)).map((checkbox) => ({ absIndex: getAbsIndex(checkbox), checkbox })).filter((item) => item.absIndex >= lo && item.absIndex <= hi);
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
        await sleep(80);
      }
    } finally {
      rangeInProgress = false;
    }
  };
  var cleanText = (el) => {
    if (!el)
      return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll('[role="img"], svg, .monarch-icon, .__react_component_tooltip, .contents').forEach((node) => node.remove());
    return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  };
  var getFirstText = (root, selectors) => {
    for (const selector of selectors) {
      const text = cleanText(root.querySelector(selector));
      if (text)
        return text;
    }
    return "";
  };
  var parseDateHeader = (header) => {
    const text = cleanText(header);
    return text.match(DATE_RE)?.[0] ?? text;
  };
  var parseSelectedCount = () => {
    const headers = Array.from(document.querySelectorAll(HEADER_SEL));
    for (const header of headers) {
      const match = header.innerText.match(SELECTED_COUNT_RE);
      if (match?.[1])
        return Number(match[1].replace(/,/g, ""));
    }
    return null;
  };
  var getBulkHeader = () => {
    const headers = Array.from(document.querySelectorAll(HEADER_SEL));
    return headers.find((header) => SELECTED_COUNT_RE.test(header.innerText)) ?? null;
  };
  var getBulkHeaderActions = () => {
    const header = getBulkHeader();
    return header?.querySelector(HEADER_ACTIONS_SEL) ?? null;
  };
  var parseExportRow = (item, row, date) => ({
    listIndex: Number(item.getAttribute("data-index") ?? -1),
    date,
    merchant: getFirstText(row, [
      '[class*="TransactionOverview__Name"] [class*="TransactionMerchantSelect__MerchantValue"]',
      '[class*="TransactionOverview__Name"] [class*="FullScreenSelect__SelectValue"]'
    ]),
    category: getFirstText(row, [
      '[class*="TransactionOverview__Category"] [class*="FullScreenSelect__SelectValue"]'
    ]),
    account: getFirstText(row, [
      '[class*="TransactionOverview__AccountColumn"] [class*="TransactionAccount__Name"]',
      '[class*="TransactionOverview__AccountColumn"] a'
    ]),
    amount: getFirstText(row, ['[class*="TransactionOverview__Amount"]'])
  });
  var getMountedSelectedRows = (listRoot) => {
    const items = Array.from(listRoot.querySelectorAll("[data-index]")).sort((a, b) => Number(a.getAttribute("data-index") ?? 0) - Number(b.getAttribute("data-index") ?? 0));
    const rows = [];
    let currentDate = "";
    for (const item of items) {
      const header = item.querySelector(SECTION_HEADER_SEL);
      if (header) {
        currentDate = parseDateHeader(header);
        continue;
      }
      const row = item.querySelector(ROW_SEL);
      const checkbox = row?.querySelector('input[type="checkbox"]');
      if (!row || !checkbox?.checked)
        continue;
      rows.push(parseExportRow(item, row, currentDate));
    }
    return rows;
  };
  var collectSelectedRows = async () => {
    const listRoot = document.querySelector(LIST_SEL);
    const scrollRoot = findScrollRoot(listRoot);
    const expectedCount = parseSelectedCount();
    if (!listRoot || !scrollRoot) {
      throw new Error("could not find Monarch transaction list");
    }
    const rowsByIndex = new Map;
    const originalTop = scrollRoot.scrollTop;
    const scrollStep = Math.max(200, Math.floor(scrollRoot.clientHeight * 0.75));
    try {
      scrollRoot.scrollTop = 0;
      await sleep(SCAN_DELAY_MS * 2);
      for (let attempt = 0;attempt < MAX_SCAN_STEPS; attempt += 1) {
        for (const row of getMountedSelectedRows(listRoot)) {
          rowsByIndex.set(row.listIndex, row);
        }
        if (expectedCount !== null && rowsByIndex.size >= expectedCount)
          break;
        const maxTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
        if (scrollRoot.scrollTop >= maxTop - 2)
          break;
        const nextTop = Math.min(maxTop, scrollRoot.scrollTop + scrollStep);
        if (Math.abs(nextTop - scrollRoot.scrollTop) < 2)
          break;
        scrollRoot.scrollTop = nextTop;
        await sleep(SCAN_DELAY_MS);
      }
    } finally {
      scrollRoot.scrollTop = originalTop;
    }
    return Array.from(rowsByIndex.values()).sort((a, b) => a.listIndex - b.listIndex);
  };
  var exportRowsCsv = (rows) => {
    const csv = toCsv(CSV_HEADERS, rows.map((row) => [
      row.date,
      row.merchant,
      row.category,
      row.account,
      row.amount,
      row.listIndex
    ]));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`monarch-selected-transactions-${stamp}.csv`, csv);
  };
  var handleCsvClick = async (button) => {
    const originalText = button.textContent ?? "Download CSV";
    const expectedCount = parseSelectedCount();
    button.disabled = true;
    button.textContent = "Preparing CSV...";
    try {
      const rows = await collectSelectedRows();
      if (rows.length === 0) {
        window.alert("No selected transactions found.");
        return;
      }
      exportRowsCsv(rows);
      if (expectedCount !== null && rows.length < expectedCount) {
        window.alert(`Downloaded ${rows.length} of ${expectedCount} selected transactions.`);
      }
    } catch (error) {
      console.error("[Monarch Bulk Select] CSV export failed", error);
      window.alert("Could not export selected transactions. See console for details.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      syncCsvButton();
    }
  };
  var createCsvButton = () => {
    const button = document.createElement("button");
    button.id = CSV_BUTTON_ID;
    button.type = "button";
    button.textContent = "Download CSV";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleCsvClick(button);
    });
    return button;
  };
  var syncCsvButton = () => {
    const actions = getBulkHeaderActions();
    const selectedCount = parseSelectedCount();
    const existing = document.getElementById(CSV_BUTTON_ID);
    if (!actions || selectedCount === null || selectedCount <= 0) {
      existing?.remove();
      return;
    }
    const button = existing instanceof HTMLButtonElement ? existing : createCsvButton();
    if (!button.isConnected || button.parentElement !== actions) {
      actions.prepend(button);
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
  var main = () => {
    injectCSS(STYLE_ID, CSV_STYLE);
    syncCsvButton();
    const observer = new MutationObserver(syncCsvButton);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", syncCsvButton, true);
    document.addEventListener("click", () => window.setTimeout(syncCsvButton, 0), true);
  };
  main();
})();
