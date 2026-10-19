// ==UserScript==
// @name                 Booking Listing Score
// @author               AZ
// @description          Wilson lower-bound page-relative scoring for Booking.com list cards and map pins
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-score.user.js
// @grant                none
// @match                https://www.booking.com/searchresults.html*
// @namespace            https://latentbyte.com/products
// @run-at               document-body
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-score.user.js
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

  // src/booking.com/booking-score.user.ts
  var exports_booking_score_user = {};

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
  var scoreToStars = (score) => 1 + 4 * score;
  var computeReviewFinalScore = (lb, rel) => 0.75 * lb + 0.25 * rel;
  var scoreLowerBoundEntries = (entries) => {
    if (!entries.length)
      return [];
    const ranks = avgRanks(entries.map((entry) => entry.lb));
    const total = entries.length;
    return entries.map((entry, index) => {
      const rel = total <= 1 ? 0.5 : ranks[index] / (total - 1);
      const final = computeReviewFinalScore(entry.lb, rel);
      return {
        ...entry,
        rel,
        final,
        finalStars: scoreToStars(final)
      };
    });
  };
  var scoreReviewEntries = (entries) => {
    return scoreLowerBoundEntries(entries.map((entry) => ({
      ...entry,
      lb: wilsonLB(entry.stars, entry.reviewCount)
    })));
  };
  var getColorForScore = (score, maxChannel = 255) => {
    const max = Math.max(0, maxChannel);
    let r, g;
    if (score < 0.5) {
      r = max;
      g = Math.round(score * 2 * max);
    } else {
      r = Math.round((1 - (score - 0.5) * 2) * max);
      g = max;
    }
    return `rgb(${r}, ${g}, 0)`;
  };
  var parseReviewCount = (str) => {
    if (!str)
      return 0;
    const trimmed = str.trim();
    const multiplier = /m/i.test(trimmed) ? 1e6 : /k/i.test(trimmed) ? 1000 : 1;
    return Math.round(parseFloat(trimmed.replace(/[,kKmM]/g, "")) * multiplier);
  };

  // src/booking.com/booking-score.user.ts
  var STYLE_ID = "booking-score-style";
  var LIST_CARD_SELECTOR = '[data-testid="property-card"]';
  var MAP_CARD_SELECTOR = '[data-testid="property-list-map-card"]';
  var CARD_SELECTOR = `${LIST_CARD_SELECTOR}, ${MAP_CARD_SELECTOR}`;
  var MARKER_SELECTOR = '[data-testid="custom-price-marker"]';
  var CSS = `
  .bk-score-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: max-content;
    min-height: 22px;
    margin: 4px 0 2px;
    padding: 2px 8px;
    border-radius: 999px;
    color: #000;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
    white-space: nowrap;
  }

  [data-testid='header-title'] + .bk-score-pill {
    margin-top: 6px;
  }

  .bk-score-marker {
    position: relative !important;
    overflow: visible !important;
  }

  .bk-score-pin-pill {
    position: absolute;
    top: -18px;
    left: 50%;
    z-index: 2;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 16px;
    padding: 0 5px;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 999px;
    color: #000;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    pointer-events: none;
    white-space: nowrap;
  }
`;
  var normalizeText = (value) => {
    return (value ?? "").replace(/\s+/g, " ").trim();
  };
  var parseMoney = (value) => {
    const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  var getCardTitle = (card) => {
    const titleEl = card.querySelector('[data-testid="title"], [data-testid="header-title"]');
    return normalizeText(titleEl?.textContent).replace(/\s*Opens in new window\s*/gi, "").trim();
  };
  var getCardKey = (card, title, priceTotal) => {
    const href = card.querySelector('a[href*="/hotel/"]')?.href;
    if (href) {
      try {
        const url = new URL(href);
        return url.pathname.replace(/\.[a-z]+$/i, "").toLowerCase();
      } catch (_e) {}
    }
    return `${title.toLowerCase()}|${priceTotal ?? ""}`;
  };
  var extractRatingData = (card) => {
    const reviewText = normalizeText(card.querySelector('[data-testid="review-score"]')?.textContent);
    const text = normalizeText(`${reviewText} ${card.innerText}`);
    const scoredMatch = text.match(/Scored\s+(\d+(?:\.\d+)?).*?(\d[\d,]*)\s+reviews?/i);
    const reviewMatch = scoredMatch ?? text.match(/(\d+(?:\.\d+)?)\s+(?:Wonderful|Very Good|Good|Excellent|Pleasant|Review score).*?(\d[\d,]*)\s+reviews?/i);
    if (!reviewMatch)
      return { rating: 0, reviewCount: 0 };
    return {
      rating: Number.parseFloat(reviewMatch[1]),
      reviewCount: parseReviewCount(reviewMatch[2])
    };
  };
  var parseNights = (card) => {
    const nightsText = normalizeText(card.querySelector('[data-testid="price-for-x-nights"]')?.textContent);
    const match = nightsText.match(/(\d+)\s+nights?/i) ?? card.innerText.match(/(\d+)\s+nights?/i);
    if (!match)
      return null;
    const nights = Number.parseInt(match[1], 10);
    return Number.isFinite(nights) && nights > 0 ? nights : null;
  };
  var parsePriceTotal = (card) => {
    const priceArea = card.querySelector('[data-testid="availability-rate-wrapper"]') ?? card.querySelector('[data-testid="availability-container"]') ?? card;
    const text = normalizeText(priceArea.innerText || priceArea.textContent);
    const explicitMatch = text.match(/Current price\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i) ?? text.match(/\bPrice\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (explicitMatch)
      return parseMoney(explicitMatch[1]);
    const perNightText = normalizeText(card.querySelector('[data-testid="price-and-discounted-price"]')?.textContent);
    const perNightMatch = perNightText.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    const nights = parseNights(card);
    if (perNightMatch && nights) {
      const perNight = parseMoney(perNightMatch[1]);
      if (perNight !== null)
        return Math.round(perNight * nights);
    }
    const beforeNights = text.split(/\d+\s+nights?/i)[0] ?? text;
    const amounts = Array.from(beforeNights.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g), (match) => parseMoney(match[1])).filter((value) => value !== null);
    return amounts.length ? amounts[amounts.length - 1] : null;
  };
  var parseCard = (card) => {
    const title = getCardTitle(card);
    const { rating, reviewCount } = extractRatingData(card);
    if (!title || !rating || !reviewCount)
      return null;
    const priceTotal = parsePriceTotal(card);
    return {
      card,
      key: getCardKey(card, title, priceTotal),
      title,
      rating,
      reviewCount,
      priceTotal
    };
  };
  var scoreEntries = (entries) => {
    const deduped = new Map;
    entries.forEach((entry) => {
      if (!deduped.has(entry.key))
        deduped.set(entry.key, entry);
    });
    return scoreReviewEntries(Array.from(deduped.values()).map((entry) => ({
      ...entry,
      stars: entry.rating / 2
    })));
  };
  var getBadgeAnchor = (card) => {
    return card.querySelector('[data-testid="title"], [data-testid="header-title"]');
  };
  var upsertCardScore = (card, score) => {
    const anchor = getBadgeAnchor(card);
    if (!anchor)
      return;
    let pill = card.querySelector(".bk-score-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "bk-score-pill";
      anchor.insertAdjacentElement("afterend", pill);
    }
    pill.style.background = getColorForScore(score.rel);
    pill.textContent = `Score ${score.finalStars.toFixed(1)}★`;
    pill.title = `${score.rating.toFixed(1)} Booking rating | ${score.reviewCount.toLocaleString()} reviews | ` + `LB: ${score.lb.toFixed(3)} | Rel: ${score.rel.toFixed(3)} | ` + `Final: ${score.final.toFixed(3)} (${score.finalStars.toFixed(1)}★)`;
    card.dataset.bkScore = score.final.toFixed(6);
    card.dataset.bkScoreRel = score.rel.toFixed(6);
  };
  var getMarkerPrice = (marker) => {
    const raw = normalizeText(marker.querySelector("span")?.textContent ?? marker.textContent);
    const match = raw.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    return match ? parseMoney(match[1]) : null;
  };
  var buildPinScoreMap = (scores) => {
    const pinScores = new Map;
    scores.forEach((score) => {
      if (score.priceTotal === null)
        return;
      const priceKey = Math.round(score.priceTotal);
      const existing = pinScores.get(priceKey);
      if (!existing) {
        pinScores.set(priceKey, { final: score.final, rel: score.rel, count: 1 });
        return;
      }
      const nextCount = existing.count + 1;
      existing.final = (existing.final * existing.count + score.final) / nextCount;
      existing.rel = (existing.rel * existing.count + score.rel) / nextCount;
      existing.count = nextCount;
    });
    return pinScores;
  };
  var upsertPinScores = (pinScores) => {
    document.querySelectorAll(MARKER_SELECTOR).forEach((marker) => {
      const price = getMarkerPrice(marker);
      const score = price === null ? null : pinScores.get(Math.round(price));
      const existing = marker.querySelector(".bk-score-pin-pill");
      if (!score) {
        existing?.remove();
        marker.classList.remove("bk-score-marker");
        return;
      }
      marker.classList.add("bk-score-marker");
      const pill = existing ?? document.createElement("span");
      pill.className = "bk-score-pin-pill";
      pill.style.background = getColorForScore(score.rel);
      pill.textContent = `${scoreToStars(score.final).toFixed(1)}★`;
      pill.title = `Booking score ${pill.textContent}`;
      if (!existing)
        marker.appendChild(pill);
    });
  };
  var processCards = () => {
    injectCSS(STYLE_ID, CSS);
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    const parsedCards = cards.map(parseCard).filter((entry) => entry !== null);
    const scores = scoreEntries(parsedCards);
    const scoresByKey = new Map(scores.map((score) => [score.key, score]));
    parsedCards.forEach((entry) => {
      const score = scoresByKey.get(entry.key);
      if (score)
        upsertCardScore(entry.card, score);
    });
    upsertPinScores(buildPinScoreMap(scores));
  };
  var observer = observeDomChanges(processCards, {
    root: document.body,
    debounceMs: 250
  });
  var main = () => {
    processCards();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  runWhenReady(main);
  watchLocationChange(() => {
    window.setTimeout(processCards, 250);
  }, { debounceMs: 250 });
})();
