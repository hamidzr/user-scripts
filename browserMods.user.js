// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    https://man.hamidzare.xyz
// @version      0.1
// @description  try to take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @grant        none
// @updateURL
// @downloadURL
// ==/UserScript==

'use strict';

(() => {

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

})();
