// ==UserScript==
// @name                 eBay Search Enhancer
// @author               AZ
// @description          preserve filters on search, add reset button, highlight keywords including negative keywords in red
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-search.user.js
// @grant                none
// @match                https://www.ebay.com/*
// @match                https://www.ebay.com.au/*
// @match                https://www.ebay.co.uk/*
// @match                https://www.ebay.ca/*
// @namespace            https://latentbyte.com/products
// @run-at               document-end
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/ebay.com/ebay-search.user.js
// @version              1.3.0
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

  // src/ebay.com/ebay-search.user.ts
  var hasInitialized = false;
  var highlightingApplied = false;
  var escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };
  var init = () => {
    if (hasInitialized)
      return;
    hasInitialized = true;
    console.log("eBay Search Enhancer: Initializing");
    interceptSearchForm();
    addResetSearchButton();
    highlightKeywords();
    watchForDynamicContent();
  };
  var watchForDynamicContent = () => {
    const observer = new MutationObserver(() => {
      if (!highlightingApplied || document.querySelector(".s-card__title .su-styled-text:not([data-highlighted])")) {
        highlightKeywords();
      }
    });
    const resultsContainer = document.querySelector(".srp-results");
    if (resultsContainer) {
      observer.observe(resultsContainer, { childList: true, subtree: true });
    }
  };
  var interceptSearchForm = () => {
    const searchForm = document.querySelector("#gh-f");
    const searchInput = document.querySelector("#gh-ac");
    if (!searchForm || !searchInput) {
      console.log("eBay Search Enhancer: Could not find search form or input");
      return;
    }
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const searchQuery = searchInput.value;
      const currentUrl = new URL(window.location.href);
      const params = new URLSearchParams(currentUrl.search);
      params.set("_nkw", searchQuery);
      window.location.href = currentUrl.pathname + "?" + params.toString();
    }, true);
  };
  var addResetSearchButton = () => {
    const searchButton = document.querySelector("#gh-search-btn");
    const searchInput = document.querySelector("#gh-ac");
    if (!searchButton || !searchInput)
      return;
    if (document.querySelector("#reset-search-btn"))
      return;
    const resetButton = document.createElement("button");
    resetButton.id = "reset-search-btn";
    resetButton.type = "button";
    resetButton.textContent = "Reset & Search";
    resetButton.style.cssText = `
    margin-left: 5px;
    padding: 8px 14px;
    background-color: #e74c3c;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  `;
    resetButton.addEventListener("click", (e) => {
      e.preventDefault();
      const searchQuery = searchInput.value;
      const domain = window.location.hostname;
      window.location.href = `https://${domain}/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`;
    });
    searchButton.parentNode?.insertBefore(resetButton, searchButton.nextSibling);
  };
  var highlightKeywords = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("_nkw");
    if (!searchQuery)
      return;
    const words = searchQuery.split(/\s+/);
    const positiveKeywords = [];
    const negativeKeywords = [];
    words.forEach((word) => {
      if (word.startsWith("-") && word.length > 1) {
        negativeKeywords.push(word.substring(1));
      } else if (word.length > 0) {
        positiveKeywords.push(word);
      }
    });
    const titleSpans = document.querySelectorAll(".s-card__title .su-styled-text");
    let highlightedCount = 0;
    titleSpans.forEach((titleSpan) => {
      if (!titleSpan.textContent || titleSpan.classList.contains("clipped") || titleSpan.hasAttribute("data-highlighted")) {
        return;
      }
      const text = titleSpan.textContent;
      let workingText = text;
      negativeKeywords.forEach((keyword) => {
        if (!keyword)
          return;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
        workingText = workingText.replace(regex, "##NEG_START##$1##NEG_END##");
      });
      positiveKeywords.forEach((keyword) => {
        if (!keyword)
          return;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
        workingText = workingText.replace(regex, (_match, p1, offset) => {
          const beforeText = workingText.substring(0, offset);
          const negStartCount = (beforeText.match(/##NEG_START##/g) ?? []).length;
          const negEndCount = (beforeText.match(/##NEG_END##/g) ?? []).length;
          if (negStartCount > negEndCount)
            return p1;
          return "##POS_START##" + p1 + "##POS_END##";
        });
      });
      const html = workingText.replace(/##NEG_START##/g, '<span style="background-color: #ff6b6b; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;">').replace(/##NEG_END##/g, "</span>").replace(/##POS_START##/g, '<span style="background-color: #ffeb3b; color: #000; padding: 2px 4px; border-radius: 2px;">').replace(/##POS_END##/g, "</span>");
      if (html !== text) {
        titleSpan.innerHTML = html;
        titleSpan.setAttribute("data-highlighted", "true");
        highlightedCount++;
      }
    });
    if (highlightedCount > 0) {
      highlightingApplied = true;
    }
  };
  waitForEl(".srp-results, .s-card__title", 5000).then(init).catch(() => {
    init();
  });
})();
