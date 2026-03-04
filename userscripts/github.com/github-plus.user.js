// ==UserScript==
// @name                 GitHub PullRequests Plus
// @author               Zare
// @description          display diff stats next to each pull request in the list view
// @grant                none
// @match                https://github.com/*/*/pulls/*
// @namespace            hamidza.re
// @run-at               document-idle
// @version              0.3.2
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var waitForEl = (selector, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el)
        return resolve(el);
      const endTime = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        const el2 = document.querySelector(selector);
        if (el2) {
          observer.disconnect();
          resolve(el2);
        } else if (Date.now() > endTime) {
          observer.disconnect();
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el2 = document.querySelector(selector);
        if (el2)
          resolve(el2);
        else
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };

  // src/github.com/github-plus.user.ts
  var parser = new DOMParser;
  var ghPlusSels = {
    prATags: 'div.js-issue-row a[href*="/pull/"].js-navigation-open'
  };
  var setupPrPage = () => {
    document.querySelectorAll(ghPlusSels.prATags).forEach((a) => {
      fetch(a.href).then((resp) => resp.text()).then((html) => {
        const pullDoc = parser.parseFromString(html, "text/html");
        const diffStat = pullDoc.getElementById("diffstat");
        if (diffStat)
          a.append(diffStat);
      }).catch(console.error);
    });
  };
  waitForEl(ghPlusSels.prATags, 6000).then(setupPrPage).catch(() => {});
})();
