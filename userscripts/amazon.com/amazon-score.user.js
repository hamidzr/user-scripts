// ==UserScript==
// @name                 Amazon Review Score Color Borders
// @author               Zare
// @description          Wilson lower-bound + page-relative scoring with color-coded borders
// @grant                none
// @match                https://www.amazon.com/s*
// @match                https://www.amazon.com/*/s*
// @match                https://www.amazon.com/*/b/*
// @match                https://www.amazon.com/b/*
// @match                https://www.amazon.com/gp/bestsellers/*
// @namespace            hamidza.re
// @run-at               document-idle
// @version              2.9.0
// ==/UserScript==

'use strict';
(() => {

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

  // src/amazon.com/amazon-score.css
  var amazon_score_default = `.vm-score-item {
  transition: opacity 120ms ease;
}
.vm-score-item:hover {
  opacity: 1 !important;
}
#vm-score-menu {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  margin: 8px 0 12px;
  border: 1px solid #d5d9d9;
  border-radius: 8px;
  background: #fff;
  color: #111;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
  font-size: 13px;
  line-height: 1.4;
}
#vm-score-menu .vm-menu-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
}
#vm-score-menu label {
  display: flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
`;

  // src/amazon.com/amazon-score.user.ts
  var ITEM_CLASS = "vm-score-item";
  var STYLE_ID = "vm-score-style";
  var MENU_ID = "vm-score-menu";
  var SETTINGS_KEY = "vm-score-settings-v1";
  var SEARCH_RESULT_SELECTOR = '[data-component-type="s-search-result"]';
  var BESTSELLER_RESULT_SELECTOR = '[id="gridItemRoot"], div[class*="_cDEzb_grid-cell_"]';
  var RESULT_ITEM_SELECTOR = `${SEARCH_RESULT_SELECTOR}, ${BESTSELLER_RESULT_SELECTOR}`;
  var nextOrigIndex = 0;
  var settings = loadSettings();
  var getResultItems = () => {
    const items = Array.from(document.querySelectorAll(RESULT_ITEM_SELECTOR));
    return items.filter((item) => !item.querySelector(RESULT_ITEM_SELECTOR));
  };
  var extractRatingData = (item) => {
    let stars = 0;
    let reviewCount = 0;
    const ratingNode = item.querySelector('[aria-label*="out of 5 stars"]');
    const ariaLabel = ratingNode ? ratingNode.getAttribute("aria-label") ?? "" : "";
    if (ariaLabel) {
      const starsMatch = ariaLabel.match(/(\d(?:\.\d+)?)\s+out of 5 stars/i);
      if (starsMatch)
        stars = parseFloat(starsMatch[1]);
      const ratingsMatch = ariaLabel.match(/([0-9,.]+[KMk]?)\s+(?:ratings|rating|reviews?|review)\b/i);
      if (ratingsMatch)
        reviewCount = parseReviewCount(ratingsMatch[1]);
    }
    if (!stars || !reviewCount) {
      const itemText = item.textContent ?? "";
      if (!stars) {
        const ratingMatch = itemText.match(/(\d(?:\.\d+)?)\s+out of 5 stars/i);
        if (ratingMatch)
          stars = parseFloat(ratingMatch[1]);
      }
      if (!reviewCount) {
        const reviewMatch = itemText.match(/([0-9,.]+[KMk]?)\s+(?:ratings|rating|reviews?|review)\b/i) || itemText.match(/\(([0-9,.]+[KMk]?)\)/);
        if (reviewMatch)
          reviewCount = parseReviewCount(reviewMatch[1]);
      }
    }
    return { stars, reviewCount };
  };
  var getResultsContainer = () => {
    const searchResultsContainer = document.querySelector('[data-component-type="s-search-results"]');
    if (searchResultsContainer)
      return searchResultsContainer;
    const firstItem = getResultItems()[0];
    if (!firstItem)
      return null;
    return firstItem.closest("#zg") || firstItem.closest("main") || firstItem.parentElement;
  };
  var ensureStyles = () => {
    injectCSS(STYLE_ID, amazon_score_default);
  };
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw)
        return { sortByScore: false };
      const parsed = JSON.parse(raw);
      return { sortByScore: Boolean(parsed.sortByScore) };
    } catch (_e) {
      return { sortByScore: false };
    }
  }
  var saveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_e) {}
  };
  var ensureMenu = () => {
    const firstItem = getResultItems()[0];
    if (!firstItem?.parentElement)
      return;
    const parent = firstItem.parentElement;
    const existing = document.getElementById(MENU_ID);
    if (existing) {
      if (existing.parentElement !== parent)
        parent.insertBefore(existing, firstItem);
      return;
    }
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.innerHTML = '<div class="vm-menu-title">VM score options</div>' + '<label><input type="checkbox" id="vm-sort-toggle"> sort by VM score</label>';
    parent.insertBefore(menu, firstItem);
    const sortToggle = menu.querySelector("#vm-sort-toggle");
    sortToggle.checked = settings.sortByScore;
    sortToggle.addEventListener("change", () => {
      settings.sortByScore = sortToggle.checked;
      saveSettings();
      applySortMode();
    });
  };
  var ensureOrigIndexes = (items) => {
    items.forEach((item) => {
      if (!item.dataset.vmOrigIndex) {
        item.dataset.vmOrigIndex = String(nextOrigIndex++);
      }
    });
  };
  var getSortScore = (item) => {
    const val = Number(item.dataset.vmFinal);
    return Number.isFinite(val) ? val : -1;
  };
  var getItemGroups = (items) => {
    const groups = new Map;
    items.forEach((item) => {
      const parent = item.parentElement;
      if (!parent)
        return;
      const arr = groups.get(parent) || [];
      arr.push(item);
      groups.set(parent, arr);
    });
    return groups;
  };
  var applySortMode = () => {
    const items = getResultItems();
    if (!items.length)
      return;
    ensureOrigIndexes(items);
    getItemGroups(items).forEach((groupItems, parent) => {
      const sorted = groupItems.slice().sort((a, b) => {
        if (settings.sortByScore) {
          const scoreDelta = getSortScore(b) - getSortScore(a);
          if (scoreDelta)
            return scoreDelta;
        }
        return Number(a.dataset.vmOrigIndex) - Number(b.dataset.vmOrigIndex);
      });
      let changed = false;
      for (let i = 0;i < groupItems.length; i++) {
        if (groupItems[i] !== sorted[i]) {
          changed = true;
          break;
        }
      }
      if (!changed)
        return;
      const anchor = document.createComment("vm-sort-anchor");
      parent.insertBefore(anchor, groupItems[0]);
      sorted.forEach((item) => parent.insertBefore(item, anchor));
      anchor.remove();
    });
  };
  var processResults = () => {
    ensureStyles();
    ensureMenu();
    const items = getResultItems();
    if (items.length === 0)
      return;
    ensureOrigIndexes(items);
    const itemData = [];
    items.forEach((item) => {
      if (item.dataset.vmProcessed === "true")
        return;
      if (item.offsetParent === null || window.getComputedStyle(item).display === "none" || window.getComputedStyle(item).visibility === "hidden") {
        return;
      }
      const { stars, reviewCount } = extractRatingData(item);
      const lb = wilsonLB(stars, reviewCount);
      itemData.push({ item, stars, reviewCount, lb });
    });
    if (itemData.length === 0) {
      applySortMode();
      return;
    }
    const N = itemData.length;
    const lbValues = itemData.map((d) => d.lb);
    const ranks = avgRanks(lbValues);
    const relScores = N === 1 ? [0.5] : ranks.map((r) => r / (N - 1));
    itemData.forEach((d, i) => {
      d.rel = relScores[i];
      d.final = 0.75 * d.lb + 0.25 * d.rel;
      d.finalStars = 1 + 4 * d.final;
    });
    itemData.forEach((d) => {
      const opacity = 0.3 + 0.7 * d.rel;
      d.item.style.opacity = opacity.toFixed(2);
      d.item.style.position = "relative";
      d.item.classList.add(ITEM_CLASS);
      const color = getColorForScore(d.rel);
      const pill = document.createElement("div");
      pill.className = "vm-score-pill";
      pill.textContent = d.finalStars.toFixed(1) + "★";
      pill.style.cssText = "position:absolute;top:4px;right:4px;z-index:1000;" + "padding:3px 8px;border-radius:12px;font-size:12px;font-weight:bold;" + "color:#000;opacity:1;box-shadow:0 1px 3px rgba(0,0,0,0.25);" + "background:" + color;
      d.item.appendChild(pill);
      d.item.title = `${d.stars}★ | ${d.reviewCount} reviews | ` + `LB: ${d.lb.toFixed(3)} | Rel: ${d.rel.toFixed(3)} | ` + `Final: ${d.final.toFixed(3)} (${d.finalStars.toFixed(1)}★)`;
      d.item.dataset.vmFinal = d.final.toFixed(6);
      d.item.dataset.vmProcessed = "true";
    });
    applySortMode();
    console.log(`[Amazon Review Colors] Processed ${N} items ` + `(LB range: ${Math.min(...lbValues).toFixed(3)} - ${Math.max(...lbValues).toFixed(3)})`);
  };
  processResults();
  var debounceTimer;
  var amzObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processResults();
    }, 500);
  });
  var resultsContainer = getResultsContainer();
  if (resultsContainer) {
    amzObserver.observe(resultsContainer, { childList: true, subtree: true });
  }
})();
