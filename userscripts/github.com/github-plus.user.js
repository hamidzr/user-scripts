// ==UserScript==
// @name                 GitHub PullRequests Plus
// @author               AZ
// @description          display diff stats next to each pull request in the list view
// @grant                none
// @match                https://github.com/*/*/pulls
// @match                https://github.com/*/*/pulls/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @version              0.4.0
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

  // src/github.com/github-plus.user.ts
  var STYLE_ID = "gh-plus-styles";
  var CSS = `
  .gh-plus-diffstat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 6px;
    font-size: 12px;
    font-weight: 600;
    vertical-align: middle;
  }
  .gh-plus-additions { color: var(--fgColor-success, #1a7f37); }
  .gh-plus-deletions { color: var(--fgColor-danger, #d1242f); }
`;
  var MARKER = "data-gh-plus-diffstat";
  var sels = {
    prLinks: 'div.js-issue-row a[href*="/pull/"].js-navigation-open'
  };
  var fetchDiffStats = async (prUrl) => {
    const resp = await fetch(`${prUrl}/files`, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
    });
    if (!resp.ok)
      throw new Error(`failed to fetch ${prUrl}/files: ${resp.status}`);
    const json = await resp.json();
    const summaries = json.payload.pullRequestsChangesRoute.diffSummaries;
    let additions = 0;
    let deletions = 0;
    for (const f of summaries) {
      additions += f.linesAdded;
      deletions += f.linesDeleted;
    }
    return { additions, deletions };
  };
  var formatNum = (n) => n.toLocaleString();
  var createBadge = (additions, deletions) => {
    const badge = document.createElement("span");
    badge.className = "gh-plus-diffstat";
    badge.innerHTML = `<span class="gh-plus-additions">+${formatNum(additions)}</span>` + `<span class="gh-plus-deletions">-${formatNum(deletions)}</span>`;
    return badge;
  };
  var setupPrPage = () => {
    document.querySelectorAll(sels.prLinks).forEach((a) => {
      if (a.hasAttribute(MARKER))
        return;
      a.setAttribute(MARKER, "");
      fetchDiffStats(a.href).then(({ additions, deletions }) => {
        a.append(createBadge(additions, deletions));
      }).catch(console.error);
    });
  };
  var main = async () => {
    injectCSS(STYLE_ID, CSS);
    await waitForEl(sels.prLinks, 6000).catch(() => null);
    setupPrPage();
  };
  main();
})();
