// ==UserScript==
// @name                 Backblaze B2 Multiselect
// @author               Zare
// @description          Range selection, modifier-click toggles, and local size sorting in the B2 explorer
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/backblaze.com/b2-multiselect.user.js
// @grant                none
// @match                https://*.backblaze.com/b2_browse_files2.htm*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/backblaze.com/b2-multiselect.user.js
// @version              1.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/backblaze.com/b2-multiselect.helpers.ts
  var getSelectionRange = (items, anchor, target) => {
    const end = items.indexOf(target);
    if (end < 0)
      return [];
    const start = anchor === null ? -1 : items.indexOf(anchor);
    if (start < 0)
      return [target];
    return items.slice(Math.min(start, end), Math.max(start, end) + 1);
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

  // src/backblaze.com/b2-size-sort.helpers.ts
  var parseSize = (text) => {
    const match = text.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*(bytes?|[kmgtpe]?i?b)$/i);
    if (!match)
      return null;
    const unit = match[2].toLowerCase();
    const exponent = Math.max(0, "bkmgtpe".indexOf(unit[0]));
    const size = Number(match[1]) * (unit.includes("i") ? 1024 : 1000) ** exponent;
    return Number.isFinite(size) ? size : null;
  };
  var sortSizeRows = (items, descending) => {
    const parents = new Set(items.flatMap((item) => item.group === null ? [] : [item.group]));
    const roots = items.filter((item) => item.parent === null || !parents.has(item.parent));
    const children = new Map;
    for (const item of items) {
      if (item.parent === null || !parents.has(item.parent))
        continue;
      const siblings = children.get(item.parent) ?? [];
      siblings.push(item.row);
      children.set(item.parent, siblings);
    }
    roots.sort((a, b) => {
      if (a.size === null)
        return b.size === null ? 0 : 1;
      if (b.size === null)
        return -1;
      return descending ? b.size - a.size : a.size - b.size;
    });
    return roots.flatMap((item) => [item.row, ...children.get(item.group ?? "") ?? []]);
  };

  // src/backblaze.com/b2-size-sort.ts
  var sels = {
    container: ".b2-browse-container",
    scroll: ".b2-browse-scroll",
    row: ":scope > .b2-row",
    header: ".b2-row-header .b2-browse-size",
    checkbox: ".b2-browse-checkbox img",
    size: ".b2-browse-size"
  };
  var getSize = (row, checkbox) => {
    const raw = checkbox?.getAttribute("data-toggle-selected-item-size");
    if (raw?.trim()) {
      const size = Number(raw);
      if (Number.isFinite(size) && size >= 0)
        return size;
    }
    return parseSize(row.querySelector(sels.size)?.textContent ?? "");
  };
  var mountSizeSort = () => {
    document.querySelectorAll(sels.header).forEach((header) => {
      if (header.querySelector("[data-b2-size-sort]"))
        return;
      const container = header.closest(sels.container);
      if (!container)
        return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.b2SizeSort = "";
      button.textContent = "Size (sort)";
      button.title = "Sort loaded files and folders by size, largest first";
      button.style.cssText = "background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-decoration:underline";
      let descending = false;
      button.addEventListener("click", () => {
        const scroll = container.querySelector(sels.scroll);
        if (!scroll)
          return;
        descending = !descending;
        const rows = Array.from(scroll.querySelectorAll(sels.row));
        const sorted = sortSizeRows(rows.map((row) => {
          const checkbox = row.querySelector(sels.checkbox);
          return {
            row,
            group: checkbox?.getAttribute("version-name") ?? null,
            parent: checkbox?.getAttribute("file-name") ?? null,
            size: getSize(row, checkbox)
          };
        }), descending);
        const slots = rows.map((row) => {
          const slot = document.createComment("size-sort");
          row.replaceWith(slot);
          return slot;
        });
        sorted.forEach((row, index) => slots[index].replaceWith(row));
        button.textContent = descending ? "Size (largest)" : "Size (smallest)";
        button.title = `Loaded items sorted ${descending ? "largest" : "smallest"} first. Click to reverse.`;
      });
      header.replaceChildren(button);
    });
  };
  var installSizeSort = () => {
    runWhenReady(() => {
      const observer = observeDomChanges(mountSizeSort, { debounceMs: 100, runImmediately: true });
      observer.observe();
    });
  };

  // src/backblaze.com/b2-multiselect.user.ts
  installSizeSort();
  var sels2 = {
    row: ".b2-browse-scroll > .b2-row",
    checkbox: ".b2-browse-checkbox img[data-toggle-selected-item], " + ".b2-browse-checkbox img[data-toggle-select-all-versions]",
    otherControl: '.b2-browse-detail, button, input, select, textarea, [contenteditable="true"]'
  };
  var anchor = null;
  var applyingSelection = false;
  var getCheckbox = (row) => row.querySelector(sels2.checkbox);
  var isChecked = (checkbox) => checkbox.getAttribute("src")?.endsWith("/checkmark_check.png") ?? false;
  var isPartial = (checkbox) => checkbox.getAttribute("src")?.endsWith("/checkmark_half.png") ?? false;
  var getRow = (event) => {
    if (!(event.target instanceof Element) || event.target.closest(sels2.otherControl))
      return null;
    return event.target.closest(sels2.row);
  };
  document.addEventListener("mousedown", (event) => {
    if (event.button === 0 && event.shiftKey && getRow(event))
      event.preventDefault();
  }, true);
  document.addEventListener("click", (event) => {
    if (applyingSelection || event.button !== 0)
      return;
    const row = getRow(event);
    const checkbox = row && getCheckbox(row);
    if (!row || !checkbox)
      return;
    if (!event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      if (event.isTrusted && event.target === checkbox)
        anchor = row;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const rows = Array.from(row.parentElement?.querySelectorAll(sels2.row) ?? []).filter((el) => el.getClientRects().length > 0 && getCheckbox(el));
    const validAnchor = anchor && rows.includes(anchor) ? anchor : null;
    const anchorCheckbox = validAnchor && getCheckbox(validAnchor);
    const selected = event.shiftKey && anchorCheckbox ? isChecked(anchorCheckbox) || isPartial(anchorCheckbox) : !isChecked(checkbox) && !isPartial(checkbox);
    const range = event.shiftKey ? getSelectionRange(rows, validAnchor, row) : [row];
    applyingSelection = true;
    try {
      for (const item of range) {
        const control = getCheckbox(item);
        if (!control)
          continue;
        const partial = isPartial(control);
        if (partial || isChecked(control) !== selected)
          control.click();
        if (partial && selected && !isChecked(control) && !isPartial(control))
          control.click();
      }
    } finally {
      applyingSelection = false;
    }
    if (!event.shiftKey || !validAnchor)
      anchor = row;
  }, true);
})();
