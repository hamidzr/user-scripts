// ==UserScript==
// @name         Amazon Review Score Color Borders
// @namespace    com.amazon.review-colors
// @version      2.9
// @description  Wilson lower-bound + page-relative scoring with color-coded borders
// @author       You
// @match        https://www.amazon.com/s*
// @match        https://www.amazon.com/*/s*
// @match        https://www.amazon.com/*/b/*
// @match        https://www.amazon.com/b/*
// @match        https://www.amazon.com/gp/bestsellers/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // beta prior constants
  const A = 20;
  const B = 5;
  // 80% one-sided confidence z-score
  const Z = 1.28;
  const ITEM_CLASS = "vm-score-item";
  const STYLE_ID = "vm-score-style";
  const MENU_ID = "vm-score-menu";
  const SETTINGS_KEY = "vm-score-settings-v1";
  const SEARCH_RESULT_SELECTOR = '[data-component-type="s-search-result"]';
  const BESTSELLER_RESULT_SELECTOR =
    '[id="gridItemRoot"], div[class*="_cDEzb_grid-cell_"]';
  const RESULT_ITEM_SELECTOR = `${SEARCH_RESULT_SELECTOR}, ${BESTSELLER_RESULT_SELECTOR}`;
  let nextOrigIndex = 0;
  const settings = loadSettings();

  function clip(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  // step 1: stars to positive-rate proxy
  function starsToP(stars) {
    return clip((stars - 3) / 2, 0, 1);
  }

  // steps 2+3: wilson lower bound with beta prior smoothing
  function wilsonLB(stars, reviewCount) {
    if (!stars || !reviewCount) return 0;

    const p = starsToP(stars);
    const v = reviewCount;

    // beta prior smoothing
    const n = v + A + B;
    const pHat = (p * v + A) / n;

    // wilson lower bound
    const z2 = Z * Z;
    const numerator =
      pHat +
      z2 / (2 * n) -
      Z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * n)) / n);
    const denominator = 1 + z2 / n;

    return numerator / denominator;
  }

  // step 4: average rank for ties, returns values in [0, N-1]
  function avgRanks(values) {
    const N = values.length;
    if (N <= 1) return [0];

    // create index array sorted by value
    const indexed = values.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);

    const ranks = new Array(N);
    let pos = 0;
    while (pos < N) {
      // find run of ties
      let end = pos + 1;
      while (end < N && indexed[end].v === indexed[pos].v) end++;

      // average rank for this tie group
      const avg = (pos + end - 1) / 2;
      for (let k = pos; k < end; k++) {
        ranks[indexed[k].i] = avg;
      }
      pos = end;
    }

    return ranks;
  }

  function getColorForScore(score) {
    // score is final blended score in [0, 1]
    // red (low) to yellow (mid) to green (high)
    let r, g;
    if (score < 0.5) {
      r = 255;
      g = Math.round(score * 2 * 255);
    } else {
      r = Math.round((1 - (score - 0.5) * 2) * 255);
      g = 255;
    }
    return `rgb(${r}, ${g}, 0)`;
  }

  function parseReviewCount(countStr) {
    if (!countStr) return 0;
    countStr = countStr.trim();
    const multiplier = countStr.match(/k/i) ? 1000 : 1;
    const numStr = countStr.replace(/[,kK]/g, "");
    return Math.round(parseFloat(numStr) * multiplier);
  }

  function getResultItems() {
    const items = Array.from(document.querySelectorAll(RESULT_ITEM_SELECTOR));
    return items.filter((item) => !item.querySelector(RESULT_ITEM_SELECTOR));
  }

  function extractRatingData(item) {
    let stars = 0;
    let reviewCount = 0;

    const ratingNode = item.querySelector('[aria-label*="out of 5 stars"]');
    const ariaLabel = ratingNode
      ? ratingNode.getAttribute("aria-label") || ""
      : "";
    if (ariaLabel) {
      const starsMatch = ariaLabel.match(/(\d(?:\.\d+)?)\s+out of 5 stars/i);
      if (starsMatch) {
        stars = parseFloat(starsMatch[1]);
      }

      const ratingsMatch = ariaLabel.match(
        /([0-9,.]+[KMk]?)\s+(?:ratings|rating|reviews?|review)\b/i,
      );
      if (ratingsMatch) {
        reviewCount = parseReviewCount(ratingsMatch[1]);
      }
    }

    if (!stars || !reviewCount) {
      const itemText = item.textContent;
      if (!stars) {
        const ratingMatch = itemText.match(/(\d(?:\.\d+)?)\s+out of 5 stars/i);
        if (ratingMatch) {
          stars = parseFloat(ratingMatch[1]);
        }
      }

      if (!reviewCount) {
        const reviewMatch =
          itemText.match(
            /([0-9,.]+[KMk]?)\s+(?:ratings|rating|reviews?|review)\b/i,
          ) || itemText.match(/\(([0-9,.]+[KMk]?)\)/);
        if (reviewMatch) {
          reviewCount = parseReviewCount(reviewMatch[1]);
        }
      }
    }

    return { stars, reviewCount };
  }

  function getResultsContainer() {
    const searchResultsContainer = document.querySelector(
      '[data-component-type="s-search-results"]',
    );
    if (searchResultsContainer) return searchResultsContainer;

    const firstItem = getResultItems()[0];
    if (!firstItem) return null;

    return (
      firstItem.closest("#zg") ||
      firstItem.closest("main") ||
      firstItem.parentElement
    );
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${ITEM_CLASS} { transition: opacity 120ms ease; }
      .${ITEM_CLASS}:hover { opacity: 1 !important; }
      #${MENU_ID} {
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
      #${MENU_ID} .vm-menu-title {
        margin: 0 0 6px;
        font-size: 12px;
        font-weight: 700;
      }
      #${MENU_ID} label {
        display: flex;
        gap: 6px;
        align-items: center;
        cursor: pointer;
        user-select: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { sortByScore: false };
      const parsed = JSON.parse(raw);
      return { sortByScore: Boolean(parsed.sortByScore) };
    } catch (e) {
      return { sortByScore: false };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore storage errors
    }
  }

  function ensureMenu() {
    const firstItem = getResultItems()[0];
    if (!firstItem || !firstItem.parentElement) return;
    const parent = firstItem.parentElement;
    const existing = document.getElementById(MENU_ID);
    if (existing) {
      if (existing.parentElement !== parent) {
        parent.insertBefore(existing, firstItem);
      }
      return;
    }
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.innerHTML =
      '<div class="vm-menu-title">VM score options</div>' +
      '<label><input type="checkbox" id="vm-sort-toggle"> sort by VM score</label>';
    parent.insertBefore(menu, firstItem);
    const sortToggle = menu.querySelector("#vm-sort-toggle");
    sortToggle.checked = settings.sortByScore;
    sortToggle.addEventListener("change", () => {
      settings.sortByScore = sortToggle.checked;
      saveSettings();
      applySortMode();
    });
  }

  function ensureOrigIndexes(items) {
    items.forEach((item) => {
      if (!item.dataset.vmOrigIndex) {
        item.dataset.vmOrigIndex = String(nextOrigIndex++);
      }
    });
  }

  function getSortScore(item) {
    const val = Number(item.dataset.vmFinal);
    return Number.isFinite(val) ? val : -1;
  }

  function getItemGroups(items) {
    /** @type {Map<Element, Element[]>} */
    const groups = new Map();
    items.forEach((item) => {
      const parent = item.parentElement;
      if (!parent) return;
      const arr = groups.get(parent) || [];
      arr.push(item);
      groups.set(parent, arr);
    });
    return groups;
  }

  function applySortMode() {
    const items = getResultItems();
    if (!items.length) return;
    ensureOrigIndexes(items);

    getItemGroups(items).forEach((groupItems, parent) => {
      const sorted = groupItems.slice().sort((a, b) => {
        if (settings.sortByScore) {
          const scoreDelta = getSortScore(b) - getSortScore(a);
          if (scoreDelta) return scoreDelta;
        }
        return Number(a.dataset.vmOrigIndex) - Number(b.dataset.vmOrigIndex);
      });

      let changed = false;
      for (let i = 0; i < groupItems.length; i++) {
        if (groupItems[i] !== sorted[i]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;

      const anchor = document.createComment("vm-sort-anchor");
      parent.insertBefore(anchor, groupItems[0]);
      sorted.forEach((item) => parent.insertBefore(item, anchor));
      anchor.remove();
    });
  }

  function processResults() {
    ensureStyles();
    ensureMenu();
    const items = getResultItems();

    if (items.length === 0) return;
    ensureOrigIndexes(items);

    const itemData = [];

    items.forEach((item) => {
      if (item.dataset.vmProcessed === "true") return;

      if (
        item.offsetParent === null ||
        window.getComputedStyle(item).display === "none" ||
        window.getComputedStyle(item).visibility === "hidden"
      ) {
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

    // step 4: relative score (percentile via average rank)
    const ranks = avgRanks(lbValues);
    const relScores = N === 1 ? [0.5] : ranks.map((r) => r / (N - 1));

    // step 5: final blended score
    itemData.forEach((d, i) => {
      d.rel = relScores[i];
      d.final = 0.75 * d.lb + 0.25 * d.rel;
      d.finalStars = 1 + 4 * d.final;
    });

    // apply opacity dimming + score pill
    itemData.forEach((d) => {
      // opacity: lowest = faded, highest = fully opaque
      const opacity = 0.3 + 0.7 * d.rel;
      d.item.style.opacity = opacity.toFixed(2);
      d.item.style.position = "relative";
      d.item.classList.add(ITEM_CLASS);

      // score pill
      const color = getColorForScore(d.rel);
      const pill = document.createElement("div");
      pill.className = "vm-score-pill";
      pill.textContent = d.finalStars.toFixed(1) + "★";
      pill.style.cssText =
        "position:absolute;top:4px;right:4px;z-index:1000;" +
        "padding:3px 8px;border-radius:12px;font-size:12px;font-weight:bold;" +
        "color:#000;opacity:1;box-shadow:0 1px 3px rgba(0,0,0,0.25);" +
        "background:" +
        color;
      d.item.appendChild(pill);

      d.item.title =
        `${d.stars}★ | ${d.reviewCount} reviews | ` +
        `LB: ${d.lb.toFixed(3)} | Rel: ${d.rel.toFixed(3)} | ` +
        `Final: ${d.final.toFixed(3)} (${d.finalStars.toFixed(1)}★)`;

      d.item.dataset.vmFinal = d.final.toFixed(6);
      d.item.dataset.vmProcessed = "true";
    });

    applySortMode();

    console.log(
      `[Amazon Review Colors] Processed ${N} items ` +
        `(LB range: ${Math.min(...lbValues).toFixed(3)} - ${Math.max(
          ...lbValues,
        ).toFixed(3)})`,
    );
  }

  processResults();

  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processResults();
    }, 500);
  });

  const resultsContainer = getResultsContainer();
  if (resultsContainer) {
    observer.observe(resultsContainer, {
      childList: true,
      subtree: true,
    });
  }
})();
