// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    https://man.hamidzare.xyz
// @version      0.3.0
// @description  try to take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @exclude      https://docs.google.com/*
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

// querySelectorAll that returns text
h.textSelector = (advSelector, parentEl=document) => {
  const parseDescriptor = str => {
    return str.split('@');
  };

  const [selector, htmlAttr] = parseDescriptor(advSelector);

  let rv = parentEl.querySelectorAll(selector);
  let res = Array.from(rv)
    .map(el => {
      if (htmlAttr) {
        return el[htmlAttr];
      }
      return el.innerText;

    });

  // reduce single arrays to first item
  if (res.length === 1) res = res[0].trim();
  if (res.length === 0) res = null;
  return res;
};

// scrape for text
// descriptor: a string or an object describing desired info
// finder: limits scope of the descriptor to each matched element
h.extract = (descriptor, finder) => {
  const _parser = (parentEl, description) => {
    let res;
    if (typeof description === 'string') {
      res = h.textSelector(description, parentEl);
    } else {
      res = {};
      for (let attr in description) {
        res[attr] = h.textSelector(description[attr], parentEl);
      };
    }

    return res;
  };

  if (!finder) { // parsing a single item
    return _parser(document, descriptor);
  }

  return h.findAll(finder)
    .map(el => _parser(el, descriptor));
};


// attach it to the window
window.h = h;
