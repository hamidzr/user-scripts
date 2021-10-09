// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    http://hamidza.re
// @version      0.5.4
// @description  Take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @exclude      https://docs.google.com/*
// @grant        none
// ==/UserScript==

'use strict';

const hmd = {};
// attach it to the window
window.hmd = hmd;
hmd._state = {};

// download text
hmd.download = (filename, text) => {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

// alias for download
hmd.dl = hmd.download;

hmd.findAll = query => {
  return Array.from(document.querySelectorAll(query));
};

// querySelectorAll that returns text
hmd.textSelector = (advSelector, parentEl=document) => {
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
hmd.extract = (descriptor, finder) => {
  const _parser = (parentEl, description) => {
    let res;
    if (typeof description === 'string') {
      res = hmd.textSelector(description, parentEl);
    } else {
      res = {};
      for (let attr in description) {
        res[attr] = hmd.textSelector(description[attr], parentEl);
      };
    }

    return res;
  };

  if (!finder) { // parsing a single item
    return _parser(document, descriptor);
  }

  return hmd.findAll(finder)
    .map(el => _parser(el, descriptor));
};

hmd._matchesRegex = (el, regex) => {
  return regex.test(el.innerText);
};

// hides items based on regex
hmd.hideItems = (selector, regex) => {
  let els = hmd.findAll(selector);

  // if not one, make it into a regex
  if (typeof regex === 'string') {
    let hasCapitalR = /[A-Z]/;
    let opts = 'i';
    if (hasCapitalR.test(regex)) {
      opts = '';
    }
    regex = RegExp(regex, opts);
  }

  let matchingEls = els.filter(el => hmd._matchesRegex(el, regex));
  matchingEls.forEach(el => {
    // TODO delete the element
    el.style.display = 'none';
  });

  return matchingEls;
};

hmd.sleep = ms => new Promise((resolve) => {
  setTimeout(resolve, ms);
});


hmd._watchRef = null;
// to help with developing code in the dev console.
// eg use ur editor, copy the code, then tab in the browser to test it out
// suggestion use `main = () => {};`
hmd.watchClipboard = (interval = 500) => {
  hmd.clearWatch();
  let lastClipboard = '';
  const ref = setInterval(async () => {
    if (! document.hasFocus()) return;
    const src = await navigator.clipboard.readText();
    if (src === '') return;
    if (lastClipboard === src) return;
    console.log(src);
    try {
      eval(src);
    } catch (e) {
      console.error(e);
    }
    lastClipboard = src;
  }, interval);
  hmd._watchRef = ref;
  return ref;
}

hmd.clearWatch = () => {
  if (hmd._watchRef === null) return;
  clearInterval(hmd._watchRef);
  hmd._watchRef = null;
}

