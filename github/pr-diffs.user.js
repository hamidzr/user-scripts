// ==UserScript==
// @name         GitHub PR Diffs
// @namespace    https://hamidza.re
// @version      0.1.0
// @description  Show pull request diff stats next to each PR in PR list view.
// @author       Hamid Zare @hamidzr
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.min.js
// @match        https://github.com/*/*/pulls*
// @run-at document-idle
// ==/UserScript==

'use strict';

const parser = new DOMParser();

const selectors = {
  prATags: 'div.js-issue-row a[href*="/pull/"].js-navigation-open',
  diffStats: '#diffstat',
};

const main = async () => {
  const prsQ = Array.from(document.querySelectorAll(selectors.prATags));
  while (prsQ.length !== 0) {
    const prAnchor = prsQ.shift(); // pr anchor tag
    const response = await axios.get(prAnchor.href);
    const prDoc = parser.parseFromString(response.data, 'text/html');
    const diffStats = prDoc.querySelector(selectors.diffStats);
    if (diffStats === null) {
      prsQ.push(prAnchor);
    } else {
      prAnchor.append(diffStats);
    }
  }
};

main();
