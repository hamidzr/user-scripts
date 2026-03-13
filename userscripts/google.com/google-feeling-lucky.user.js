// ==UserScript==
// @name                 Google Feeling Lucky Redirect
// @author               AZ
// @description          automatically redirects to the first result when a "Feeling Lucky" search link is opened
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-feeling-lucky.user.js
// @grant                none
// @match                https://*.google.com/search?q=*
// @match                https://*.google.com/url?q=*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-feeling-lucky.user.js
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

  // src/google.com/google-feeling-lucky.user.ts
  var exports_google_feeling_lucky_user = {};
  var redirectToUrl = (url) => {
    console.log(`Redirecting to ${url}`);
    window.location.href = url;
  };
  var url = new URL(window.location.href);
  var isAluckyQuery = url.href.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().includes("feelinglucky");
  if (isAluckyQuery) {
    const firstResult = document.querySelector("div.g > div > div > div > a");
    if (firstResult) {
      redirectToUrl(firstResult.href);
    }
  }
  if (url.pathname === "/url") {
    const urlParam = url.searchParams.get("q");
    if (urlParam) {
      redirectToUrl(urlParam);
    }
  }
})();
