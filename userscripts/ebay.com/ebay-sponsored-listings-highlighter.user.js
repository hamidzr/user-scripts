// ==UserScript==
// @name         eBay Sponsored Listings Highlighter
// @namespace    https://github.com/yourusername
// @version      1.9
// @description  Colors eBay's native Sponsored labels red
// @author       You
// @match        https://www.ebay.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
        .srp-results .s-card__footer--row [role="heading"][aria-level="6"] [translate="no"],
        .srp-river-results .s-card__footer--row [role="heading"][aria-level="6"] [translate="no"] {
            color: #d93025 !important;
            font-weight: 700 !important;
            font-size: 13px !important;
        }
    `;
  document.head.appendChild(style);
})();
