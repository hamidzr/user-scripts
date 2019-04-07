// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    https://man.hamidzare.xyz
// @version      0.2.1
// @description  try to take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/hamidzr/user-scripts/raw/master/browserMods.user.js
// @downloadURL  https://github.com/hamidzr/user-scripts/raw/master/browserMods.user.js
// ==/UserScript==

'use strict';

const h = {};

// download text
h.download = (filename, text) => {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

// alias for download
h.dl = h.download;

h.findAll = query => {
  return Array.from(document.querySelectorAll(query));
};

h.extract = query => {
  return h.findAll(query).map(el => el.innerText);
};


// attach it to the window
window.h = h;
