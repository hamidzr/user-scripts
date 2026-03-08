// ==UserScript==
// @name                 Zoom link upgrader
// @author               AZ
// @description          swap http Zoom meeting links to zoommtg:// links
// @grant                none
// @match                https://calendar.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
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

  // src/calendar.google.com/zoom-links.user.ts
  var exports_zoom_links_user = {};
  var sels = {
    zoomLinks: 'a[href*="zoom.us/j/"]'
  };
  var buildZoomHref = (meetingNumber) => `zoommtg://zoom.us/join?action=join&confno=${meetingNumber}`;
  var meetingNumberRe = /(?<=zoom.us\/j\/)\d+/i;
  var main = () => {
    const zooms = Array.from(document.querySelectorAll(sels.zoomLinks));
    console.log("found zooms", zooms);
    zooms.forEach((zoomA) => {
      const meetingNumber = zoomA.href.match(meetingNumberRe);
      if (meetingNumber)
        zoomA.href = buildZoomHref(meetingNumber[0]);
    });
  };
  main();
})();
