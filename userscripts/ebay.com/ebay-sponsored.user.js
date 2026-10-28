// ==UserScript==
// @name                 eBay Sponsored Listings Highlighter
// @author               AZ
// @description          colors eBay's native Sponsored labels red
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-sponsored.user.js
// @grant                none
// @match                https://www.ebay.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-sponsored.user.js
// @version              1.10.0
// ==/UserScript==

'use strict';
(() => {

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

  // src/ebay.com/ebay-sponsored.css
  var ebay_sponsored_default = `/* current markup: the real label is an svg background-image on the heading (marked by the script) */
.s-card__footer--row [role='heading'][aria-level='6'][data-ebay-sponsored] {
  background-image: none !important;
}

.s-card__footer--row [role='heading'][aria-level='6'][data-ebay-sponsored] > span {
  display: none !important;
}

.s-card__footer--row [role='heading'][aria-level='6'][data-ebay-sponsored]::before {
  content: 'Sponsored';
  color: #d93025;
  font-weight: 700;
  font-size: 13px;
}

/* older markup: text node wrapped in [translate=no] */
.srp-results .s-card__footer--row [role='heading'][aria-level='6'] [translate='no'],
.srp-river-results .s-card__footer--row [role='heading'][aria-level='6'] [translate='no'] {
  color: #d93025 !important;
  font-weight: 700 !important;
  font-size: 13px !important;
}
`;

  // src/ebay.com/ebay-sponsored.user.ts
  var STYLE_ID = "ebay-sponsored-style";
  var MARK_ATTR = "data-ebay-sponsored";
  var sels = {
    label: ".s-card__footer--row [role='heading'][aria-level='6'][style*='background-image']"
  };
  var SVG_W = 300;
  var SVG_H = 150;
  var checked = new WeakMap;
  var getLabelUrl = (el) => /url\(["']?([^"')]+)/.exec(el.style.backgroundImage)?.[1] ?? null;
  var paintsInBox = async (url, box) => {
    const img = new Image;
    img.src = url;
    try {
      await img.decode();
    } catch (_e) {
      return false;
    }
    const canvas = document.createElement("canvas");
    canvas.width = SVG_W;
    canvas.height = SVG_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx)
      return false;
    ctx.drawImage(img, 0, 0, SVG_W, SVG_H);
    const w = Math.min(SVG_W, Math.ceil(box.width));
    const h = Math.min(SVG_H, Math.ceil(box.height));
    let data;
    try {
      ({ data } = ctx.getImageData(0, 0, w, h));
    } catch (_e) {
      return false;
    }
    for (let i = 3;i < data.length; i += 4) {
      if (data[i] > 20)
        return true;
    }
    return false;
  };
  var markSponsored = async (el) => {
    const url = getLabelUrl(el);
    const box = el.getBoundingClientRect();
    if (!url || checked.get(el) === url || box.width === 0)
      return;
    checked.set(el, url);
    if (await paintsInBox(url, box))
      el.setAttribute(MARK_ATTR, "");
  };
  var scan = () => {
    document.querySelectorAll(sels.label).forEach((el) => void markSponsored(el));
  };
  injectCSS(STYLE_ID, ebay_sponsored_default);
  observeDomChanges(scan, { debounceMs: 200, runImmediately: true }).observe(document.body);
})();
