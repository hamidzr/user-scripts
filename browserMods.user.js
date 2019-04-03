// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    https://man.hamidzare.xyz
// @version      0.2.0
// @description  try to take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/hamidzr/user-scripts/raw/master/browserMods.user.js
// @downloadURL  https://github.com/hamidzr/user-scripts/raw/master/browserMods.user.js
// ==/UserScript==

'use strict';

window.h = {};

// download text
window.h.download = (filename, text) => {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

// alias for download
window.h.dl = window.h.download;

window.h.findAll = query => {
  return Array.from(document.querySelectorAll(query));
};

window.h.extract = query => {
  return window.h.findAll(query).map(el => el.innerText);
};
