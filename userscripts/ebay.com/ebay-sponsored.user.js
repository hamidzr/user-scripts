// ==UserScript==
// @name                 eBay Sponsored Listings Highlighter
// @author               AZ
// @description          colors eBay's native Sponsored labels red
// @grant                none
// @match                https://www.ebay.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @version              1.9.0
// ==/UserScript==

'use strict';
(() => {

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

  // src/ebay.com/ebay-sponsored.css
  var ebay_sponsored_default = `.srp-results .s-card__footer--row [role='heading'][aria-level='6'] [translate='no'],
.srp-river-results .s-card__footer--row [role='heading'][aria-level='6'] [translate='no'] {
  color: #d93025 !important;
  font-weight: 700 !important;
  font-size: 13px !important;
}
`;

  // src/ebay.com/ebay-sponsored.user.ts
  var STYLE_ID = "ebay-sponsored-style";
  injectCSS(STYLE_ID, ebay_sponsored_default);
})();
