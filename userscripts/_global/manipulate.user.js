// ==UserScript==
// @name         Page Mainuplation Mods
// @namespace    http://hamidza.re
// @version      0.10.0
// @description  ""
// @author       Zare
// @match        *://*/*
// @grant        none
// ==/UserScript==

'use strict';

hmd.mp = {};

const highlightColor = 'rgba(255, 255, 0, 0.5)';

/** highlight the element with a border */
const highlightEl = (el) => {
  // give it a border with the highlight color
  el.style.border = `4px solid ${highlightColor}`;
};

const hideEl = (el) => {
  el.style.display = 'none';
};

/** if the elements inner text matches the regex, highlight it */
hmd.mp.focusAll = (wrapperSel, re, itemSel = '') => {
  const containers = hmd.findAll(wrapperSel);
  containers.forEach(async (wrapper) => {
    const el = (itemSel && wrapper.querySelector(itemSel)) || wrapper;
    if (el.innerText.match(re)) {
      // highlightEl(el)
    } else {
      hideEl(el);
    }
  });
};
