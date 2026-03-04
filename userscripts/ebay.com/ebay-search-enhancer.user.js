// ==UserScript==
// @name         eBay Search Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Preserve filters on search, add reset button, highlight keywords (including negative keywords in red)
// @author       You
// @match        https://www.ebay.com/*
// @match        https://www.ebay.com.au/*
// @match        https://www.ebay.co.uk/*
// @match        https://www.ebay.ca/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  console.log("eBay Search Enhancer: Script loaded v1.3");

  let hasInitialized = false;
  let highlightingApplied = false;

  // wait for page to be ready
  function init() {
    if (hasInitialized) return;
    hasInitialized = true;

    console.log("eBay Search Enhancer: Initializing");
    interceptSearchForm();
    addResetSearchButton();
    highlightKeywords();

    // watch for dynamically loaded content
    watchForDynamicContent();
  }

  // watch for dynamic content changes
  function watchForDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      // check if new search results were loaded
      if (
        !highlightingApplied ||
        document.querySelector(
          ".s-card__title .su-styled-text:not([data-highlighted])",
        )
      ) {
        highlightKeywords();
      }
    });

    const resultsContainer = document.querySelector(".srp-results");
    if (resultsContainer) {
      observer.observe(resultsContainer, {
        childList: true,
        subtree: true,
      });
    }
  }

  // intercept the search form submission
  function interceptSearchForm() {
    const searchForm = document.querySelector("#gh-f");
    const searchInput = document.querySelector("#gh-ac");

    if (!searchForm || !searchInput) {
      console.log("eBay Search Enhancer: Could not find search form or input");
      return;
    }

    console.log("eBay Search Enhancer: Found search form");

    // intercept form submission
    searchForm.addEventListener(
      "submit",
      function (e) {
        e.preventDefault();
        e.stopPropagation();

        const searchQuery = searchInput.value;
        const currentUrl = new URL(window.location.href);
        const params = new URLSearchParams(currentUrl.search);

        // update only the search query parameter
        params.set("_nkw", searchQuery);

        // navigate to the new URL with preserved filters
        window.location.href = currentUrl.pathname + "?" + params.toString();
      },
      true,
    );

    console.log("eBay Search Enhancer: Form interception set up");
  }

  // add a "Reset & Search" button next to the search button
  function addResetSearchButton() {
    const searchButton = document.querySelector("#gh-search-btn");
    const searchInput = document.querySelector("#gh-ac");

    if (!searchButton || !searchInput) {
      console.log(
        "eBay Search Enhancer: Could not find search button or input for reset button",
      );
      return;
    }

    // check if button already exists
    if (document.querySelector("#reset-search-btn")) {
      console.log("eBay Search Enhancer: Reset button already exists");
      return;
    }

    // create reset button
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

    resetButton.addEventListener("click", function (e) {
      e.preventDefault();
      const searchQuery = searchInput.value;
      const domain = window.location.hostname;
      // navigate to clean search URL
      window.location.href = `https://${domain}/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`;
    });

    // insert after search button
    searchButton.parentNode.insertBefore(resetButton, searchButton.nextSibling);
    console.log("eBay Search Enhancer: Reset button added");
  }

  // highlight keywords in search results
  function highlightKeywords() {
    // get search query from URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("_nkw");

    if (!searchQuery) {
      console.log("eBay Search Enhancer: No search query in URL");
      return;
    }

    console.log(
      "eBay Search Enhancer: Highlighting keywords for:",
      searchQuery,
    );

    // parse positive and negative keywords
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

    console.log("eBay Search Enhancer: Positive keywords:", positiveKeywords);
    console.log("eBay Search Enhancer: Negative keywords:", negativeKeywords);

    // find all item titles - updated selector for new eBay design
    const titleSpans = document.querySelectorAll(
      ".s-card__title .su-styled-text",
    );

    console.log("eBay Search Enhancer: Found", titleSpans.length, "titles");

    let highlightedCount = 0;

    titleSpans.forEach((titleSpan) => {
      if (
        !titleSpan.textContent ||
        titleSpan.classList.contains("clipped") ||
        titleSpan.hasAttribute("data-highlighted")
      ) {
        return;
      }

      let text = titleSpan.textContent;
      let workingText = text;

      // first, mark negative keywords
      negativeKeywords.forEach((keyword) => {
        if (!keyword) return;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
        workingText = workingText.replace(regex, "##NEG_START##$1##NEG_END##");
      });

      // then, mark positive keywords (but not inside negative markers)
      positiveKeywords.forEach((keyword) => {
        if (!keyword) return;
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
        workingText = workingText.replace(regex, function (match, p1, offset) {
          // check if we're inside a negative marker
          const beforeText = workingText.substring(0, offset);
          const negStartCount = (beforeText.match(/##NEG_START##/g) || [])
            .length;
          const negEndCount = (beforeText.match(/##NEG_END##/g) || []).length;

          if (negStartCount > negEndCount) {
            // we're inside a negative marker, don't replace
            return match;
          }
          return "##POS_START##" + match + "##POS_END##";
        });
      });

      // replace markers with styled spans
      const html = workingText
        .replace(
          /##NEG_START##/g,
          '<span style="background-color: #ff6b6b; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;">',
        )
        .replace(/##NEG_END##/g, "</span>")
        .replace(
          /##POS_START##/g,
          '<span style="background-color: #ffeb3b; color: #000; padding: 2px 4px; border-radius: 2px;">',
        )
        .replace(/##POS_END##/g, "</span>");

      if (html !== text) {
        titleSpan.innerHTML = html;
        titleSpan.setAttribute("data-highlighted", "true");
        highlightedCount++;
      }
    });

    if (highlightedCount > 0) {
      highlightingApplied = true;
    }

    console.log(
      "eBay Search Enhancer: Highlighting complete, highlighted",
      highlightedCount,
      "titles",
    );
  }

  // escape special regex characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // run on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // also run after delays to catch dynamic content
  setTimeout(init, 500);
  setTimeout(init, 1500);
  setTimeout(() => {
    addResetSearchButton();
    highlightKeywords();
  }, 3000);
})();
