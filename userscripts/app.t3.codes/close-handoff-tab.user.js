// ==UserScript==
// @name                 T3 Code: close tab after opening desktop app
// @author               Zare
// @description          close the leftover app.t3.codes tab once a thread or prompt link has opened in the T3 Code desktop app
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.t3.codes/close-handoff-tab.user.js
// @grant                window.close
// @license              MIT
// @match                https://app.t3.codes/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/app.t3.codes/close-handoff-tab.user.js
// @version              0.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/app-handoff.ts
  var DEFAULT_HANDOFF_ARM_MS = 8000;
  var createHandoffCloser = (opts = {}) => {
    const armMs = opts.armMs ?? DEFAULT_HANDOFF_ARM_MS;
    const now = opts.now ?? Date.now;
    const close = opts.close ?? (() => window.close());
    let armedAt = null;
    return {
      arm: () => {
        armedAt = now();
      },
      onBlur: () => {
        if (armedAt === null || now() - armedAt > armMs)
          return false;
        armedAt = null;
        close();
        return true;
      }
    };
  };
  var isSchemeHref = (href, schemes) => {
    if (!href)
      return false;
    const colon = href.indexOf(":");
    if (colon <= 0)
      return false;
    return schemes.includes(href.slice(0, colon).toLowerCase());
  };

  // src/app.t3.codes/close-handoff-tab.helpers.ts
  var OPENER_CHOICE_KEY = "t3code:prompt-link-opener";
  var T3_SCHEMES = ["t3code", "t3code-dev"];
  var parseOpenerChoice = (raw) => {
    if (raw === null)
      return null;
    let value = raw;
    try {
      value = JSON.parse(raw);
    } catch (_e) {}
    return value === "app" || value === "browser" ? value : null;
  };

  // src/app.t3.codes/close-handoff-tab.user.ts
  var WATCH_MS = 20000;
  var isHandoffLink = (el) => el instanceof HTMLAnchorElement && isSchemeHref(el.getAttribute("href"), T3_SCHEMES);
  var readOpenerChoice = () => {
    try {
      return parseOpenerChoice(localStorage.getItem(OPENER_CHOICE_KEY));
    } catch (_e) {
      return null;
    }
  };
  var findHandoffLink = () => {
    for (const scheme of T3_SCHEMES) {
      const el = document.querySelector(`a[href^="${scheme}:"]`);
      if (isHandoffLink(el))
        return el;
    }
    return null;
  };
  var armWhenAutoLaunching = (arm) => {
    if (readOpenerChoice() !== "app")
      return;
    if (findHandoffLink())
      return arm();
    const observer = new MutationObserver(() => {
      if (!findHandoffLink())
        return;
      observer.disconnect();
      arm();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), WATCH_MS);
  };
  var main = () => {
    const closer = createHandoffCloser();
    window.addEventListener("blur", () => closer.onBlur());
    document.addEventListener("click", (e) => {
      const link = e.target instanceof Element ? e.target.closest("a") : null;
      if (isHandoffLink(link))
        closer.arm();
    }, true);
    armWhenAutoLaunching(closer.arm);
  };
  main();
})();
