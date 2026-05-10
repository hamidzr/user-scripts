// ==UserScript==
// @name                 Linear: open in desktop app
// @author               Zare
// @description          redirect linear.app workspace URLs to the linear:// desktop scheme. opt out with ?web=1 or #web.
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/linear.app/open-in-app.user.js
// @grant                none
// @match                https://linear.app/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/linear.app/open-in-app.user.js
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

  // src/linear.app/open-in-app.user.ts
  var exports_open_in_app_user = {};
  var SKIP_FIRST_SEG = new Set([
    "homepage",
    "method",
    "about",
    "blog",
    "changelog",
    "customers",
    "integrations",
    "pricing",
    "security",
    "contact",
    "careers",
    "now",
    "docs",
    "login",
    "signup",
    "logout",
    "oauth",
    "onboarding",
    "sign-in",
    "sign-up",
    "auth",
    "invite",
    "join",
    "install",
    "download",
    "desktop"
  ]);
  var SESSION_KEY = "linear-open-in-app:redirected";
  var shouldRedirect = (url) => {
    if (url.searchParams.get("web") === "1")
      return false;
    if (url.hash === "#web")
      return false;
    const segs = url.pathname.split("/").filter(Boolean);
    if (segs.length < 2)
      return false;
    if (SKIP_FIRST_SEG.has(segs[0].toLowerCase()))
      return false;
    return true;
  };
  var toAppUrl = (url) => `linear://${url.host}${url.pathname}${url.search}${url.hash}`;
  var url = new URL(window.location.href);
  if (shouldRedirect(url)) {
    const last = sessionStorage.getItem(SESSION_KEY);
    if (last !== url.href) {
      sessionStorage.setItem(SESSION_KEY, url.href);
      const target = toAppUrl(url);
      console.log("[linear-open-in-app] →", target);
      window.location.replace(target);
    }
  }
})();
