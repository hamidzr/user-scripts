// ==UserScript==
// @name                 Monarch Holdings Export
// @author               AZ
// @description          export holdings data from Monarch holdings page to csv
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-holdings-export.user.js
// @grant                GM_registerMenuCommand
// @match                https://app.monarch.com/investments/holdings/market*
// @match                https://app.monarchmoney.com/investments/holdings/market*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.monarch.com/monarch-holdings-export.user.js
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

  // src/app.monarch.com/monarch-holdings-export.user.ts
  var exports_monarch_holdings_export_user = {};

  // src/lib/download.ts
  var stringify = (val) => {
    if (typeof val === "string")
      return val;
    if (Array.isArray(val))
      return val.map(stringify).join(`
`);
    if (val instanceof HTMLElement)
      return val.innerText;
    return JSON.stringify(val);
  };
  var download = (filename, text) => {
    const content = stringify(text);
    const el = document.createElement("a");
    el.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    el.setAttribute("download", filename);
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  // src/app.monarch.com/monarch-holdings-export.user.ts
  var HOLDINGS_PATH = "/investments/holdings/market";
  var MENU_LABEL = "Monarch: Export holdings CSV";
  var CSV_HEADER = ["Symbol", "Balance", "Price", "Quantity", "Value", "Weight"];
  var HEADER_MATCHES = {
    symbol: ["symbol", "sec ticker", "ticker", "security"],
    balance: ["balance", "market value", "value", "position", "amount"],
    price: ["price", "share price", "last"],
    quantity: ["quantity", "qty", "shares"],
    value: ["value", "market value", "position"],
    weight: ["weight", "allocation", "percent", "allocation %"]
  };
  var cleanText = (value) => value.replace(/\s+/g, " ").trim();
  var isSymbolToken = (value) => {
    const trimmed = value.trim();
    const normalized = trimmed.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9.-]+$/, "");
    return /^[A-Za-z]{1,6}[A-Za-z0-9]{0,4}(?:[.-][A-Za-z0-9]{1,4})?$/.test(normalized);
  };
  var pickSymbol = (value) => {
    const cleanSource = value.replace(/\r/g, "");
    const lines = cleanSource.split(`
`).map((line) => cleanText(line)).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      for (const part of parts) {
        if (isSymbolToken(part)) {
          return part;
        }
      }
      const maybeInline2 = line.match(/^([A-Za-z]{1,6}[A-Za-z0-9.-]{0,4})/);
      if (maybeInline2 && isSymbolToken(maybeInline2[1])) {
        return maybeInline2[1];
      }
    }
    const maybeInline = cleanText(value).match(/^([^\s-]+)[\s\-]/);
    if (maybeInline && isSymbolToken(maybeInline[1])) {
      return maybeInline[1];
    }
    return cleanText(value).split(/\s+/)[0] ?? "";
  };
  var escapeCsv = (value) => {
    if (value.includes(",") || value.includes('"') || value.includes(`
`) || value.includes("\r")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  var isHoldingsPage = () => {
    const pathname = window.location.pathname;
    return pathname === HOLDINGS_PATH || pathname.startsWith(`${HOLDINGS_PATH}/`);
  };
  var normalizeHeader = (value) => cleanText(value).toLowerCase();
  var findColumn = (headers, key) => {
    const keys = HEADER_MATCHES[key];
    for (let idx = 0;idx < headers.length; idx += 1) {
      const header = normalizeHeader(headers[idx] ?? "");
      if (keys.some((match) => header.includes(match))) {
        return idx;
      }
    }
    return null;
  };
  var buildColumnMap = (headers) => ({
    symbol: findColumn(headers, "symbol"),
    balance: findColumn(headers, "balance"),
    price: findColumn(headers, "price"),
    quantity: findColumn(headers, "quantity"),
    value: findColumn(headers, "value"),
    weight: findColumn(headers, "weight")
  });
  var rowToFields = (cells, map) => {
    const rawSymbol = (map.symbol !== null ? cleanText(cells[map.symbol] ?? "") : "").trim();
    const symbol = pickSymbol(rawSymbol).trim();
    if (!symbol)
      return null;
    const get = (idx) => (idx === null ? "" : cleanText(cells[idx] ?? "")).trim();
    const balance = get(map.balance);
    const value = get(map.value) || balance;
    const row = {
      symbol,
      balance,
      price: get(map.price),
      quantity: get(map.quantity),
      value,
      weight: get(map.weight)
    };
    return row;
  };
  var cellsFromElement = (row) => {
    const direct = Array.from(row.children).map((el) => cleanText(el.innerText ?? el.textContent ?? ""));
    if (direct.length > 1)
      return direct;
    const fallback = Array.from(row.querySelectorAll('td, th, [role="gridcell"], [role="rowheader"]')).map((el) => cleanText(el.innerText ?? el.textContent ?? ""));
    return fallback.length > 0 ? fallback : direct;
  };
  var gatherFromTable = () => {
    const tables = Array.from(document.querySelectorAll("table"));
    const out = [];
    for (const table of tables) {
      const headerCells = table.querySelectorAll("th");
      const headers = Array.from(headerCells).map((el) => cleanText(el.textContent ?? ""));
      if (!headers.length)
        continue;
      const map = buildColumnMap(headers);
      if (!Object.values(map).some((idx) => idx !== null))
        continue;
      const bodyRows = table.tBodies.length > 0 ? Array.from(table.tBodies[0].querySelectorAll("tr")) : Array.from(table.querySelectorAll("tr")).filter((row) => row.parentElement?.tagName !== "THEAD");
      bodyRows.forEach((row) => {
        const cellValues = cellsFromElement(row);
        if (cellValues.length < 3)
          return;
        const holding = rowToFields(cellValues, map);
        if (!holding)
          return;
        out.push(holding);
      });
    }
    return out;
  };
  var gatherFromRoleGrid = () => {
    const grids = Array.from(document.querySelectorAll('[role="grid"], [role="table"]'));
    const out = [];
    for (const grid of grids) {
      const rows = Array.from(grid.querySelectorAll('[role="row"]'));
      if (rows.length < 2)
        continue;
      const headerRow = rows.find((row) => row.querySelector('[role="columnheader"], th') !== null);
      if (!headerRow)
        continue;
      const headers = cellsFromElement(headerRow);
      const map = buildColumnMap(headers);
      if (!Object.values(map).some((idx) => idx !== null))
        continue;
      rows.filter((row) => row !== headerRow).forEach((row) => {
        const cellValues = cellsFromElement(row);
        if (!cellValues.length)
          return;
        const holding = rowToFields(cellValues, map);
        if (holding)
          out.push(holding);
      });
    }
    return out;
  };
  var isPotentialFallbackRow = (cells) => cells.length >= 3;
  var parseFallbackRows = () => {
    const rows = Array.from(document.querySelectorAll("[data-index], [data-rowindex], .row"));
    const out = [];
    for (const row of rows) {
      const cells = cellsFromElement(row);
      if (!isPotentialFallbackRow(cells))
        continue;
      const symbol = pickSymbol(cells[0] ?? "");
      if (!symbol)
        continue;
      out.push({
        symbol,
        balance: cells[1] ?? "",
        price: cells[2] ?? "",
        quantity: cells[3] ?? "",
        value: cells[4] ?? "",
        weight: cells[5] ?? ""
      });
    }
    return out;
  };
  var uniqueRows = (rows) => {
    const seen = new Set;
    const out = [];
    rows.forEach((row) => {
      const key = `${row.symbol}|${row.balance}|${row.price}|${row.quantity}|${row.value}|${row.weight}`;
      if (seen.has(key))
        return;
      seen.add(key);
      out.push(row);
    });
    return out;
  };
  var collectRows = () => {
    const rows = [...gatherFromTable(), ...gatherFromRoleGrid(), ...parseFallbackRows()];
    return uniqueRows(rows);
  };
  var buildCsv = (rows) => {
    const lines = [
      CSV_HEADER.map((field) => `${field}`).map(escapeCsv).join(",")
    ];
    rows.forEach((row) => {
      lines.push([row.symbol, row.balance, row.price, row.quantity, row.value, row.weight].map(escapeCsv).join(","));
    });
    return `${lines.join(`
`)}
`;
  };
  var filename = () => {
    const now = new Date;
    const date = now.toISOString().slice(0, 10);
    return `monarch-holdings-${date}.csv`;
  };
  var exportHoldingsCsv = () => {
    const rows = collectRows();
    if (!rows.length) {
      window.alert("No holdings rows found. Make sure you are on the Holdings page and data is loaded.");
      return;
    }
    const csv = buildCsv(rows);
    download(filename(), csv);
  };
  var registerMenu = () => {
    if (!isHoldingsPage())
      return;
    if (typeof GM_registerMenuCommand !== "function")
      return;
    GM_registerMenuCommand(MENU_LABEL, () => {
      exportHoldingsCsv();
    });
  };
  registerMenu();
})();
