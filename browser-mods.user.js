// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    http://hamidza.re
// @version      0.11.0
// @description  Take over the world!
// @author       Hamid Zare
// @match        *://*/*
// @exclude      https://docs.google.com/*
// @exclude      https://jamboard.google.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

'use strict';

const hmd = {
  cc: {},
};
// attach it to the window
window.hmd = hmd;
hmd._state = {};
// cache parsed hmd._data
hmd._parseData = {};

hmd._stringify = (any) => {
  if (typeof any === 'string') return any;
  if (Array.isArray(any)) {
    return any.map(hmd._stringify).join('\n');
  }
  if (any instanceof Element) {
    return any.innerText;
  }
  return JSON.stringify(any);
};

// download text
hmd.download = (filename, text) => {
  if (text === undefined) {
    // overload the function to support download(text);
    return hmd.download('hbrowsermods.txt', filename);
  }
  text = hmd._stringify(text);
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

// alias for download
hmd.dl = hmd.download;

hmd.findAll = (query) => {
  return Array.from(document.querySelectorAll(query));
};
/** search for a list of selector and collect the results. ignore misses */
hmd.findList = (sels) => {
  const results = [];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (el) results.push(el);
  }
  return results;
};
hmd.find = async (selector, opts) => {
  opts = {
    timeout: 2000,
    ...opts,
  };
  if (opts.timeout) {
    await hmd.sleepUntil(() => document.querySelector(selector), opts.timeout);
  }
  return document.querySelector(selector);
};

hmd.elIncludes = (el, query) => {
  query = {
    text: undefined,
    ...query,
  };
  if (query.text) {
    return el.innerText.includes(query.text);
  }
};

/** find siblings given an anchor el and a predicate */
hmd.findSiblingJs = (anchor, predicate) => {
  // starting from the element to to next and previous siblings
  // and run predicate on them. return as soon as one is found
  let cur = anchor.nextElementSibling;
  while (cur) {
    if (predicate(cur)) return cur;
    cur = cur.nextElementSibling;
  }
  cur = anchor.previousElementSibling;
  while (cur) {
    if (predicate(cur)) return cur;
    cur = cur.previousElementSibling;
  }
};

/** get the first sibling of an initial target query string */
hmd.findSibling = (target, sibling) => {
  const anchor = document.querySelector(target);
  if (!anchor) return null;
  return anchor.parentElement.querySelector(sibling);
};

// querySelectorAll that returns text
hmd.textSelector = (advSelector, parentEl = document) => {
  const parseDescriptor = (str) => {
    return str.split('@');
  };

  const [selector, htmlAttr] = parseDescriptor(advSelector);

  let rv = parentEl.querySelectorAll(selector);
  let res = Array.from(rv).map((el) => {
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
      }
    }

    return res;
  };

  if (!finder) {
    // parsing a single item
    return _parser(document, descriptor);
  }

  return hmd.findAll(finder).map((el) => _parser(el, descriptor));
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

  let matchingEls = els.filter((el) => hmd._matchesRegex(el, regex));
  matchingEls.forEach((el) => {
    // TODO delete the element
    el.style.display = 'none';
  });

  return matchingEls;
};

hmd.sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

hmd.readClipboard = async () => {
  await hmd.sleepUntil(document.hasFocus.bind(document), 10000);
  // if (! document.hasFocus()) return;
  const clipboard = await navigator.clipboard.readText();
  return clipboard;
};

hmd.writeClipboard = async (text) => {
  // wait until the document is focused
  console.log('waiting for the document to be focused');
  await hmd.sleepUntil(document.hasFocus.bind(document), 10000);
  await navigator.clipboard.writeText(text);
  console.log('copied text to clipboard');
};

hmd._watchRef = null;
// to help with developing code in the dev console.
// eg use ur editor, copy the code, then tab in the browser to test it out
// suggestion use `main = () => {};`
hmd.watchClipboard = (interval = 100) => {
  hmd.clearWatch();
  let lastClipboard = '';
  const ref = setInterval(async () => {
    if (!document.hasFocus()) return;
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
};

hmd.clearWatch = () => {
  if (hmd._watchRef === null) return;
  clearInterval(hmd._watchRef);
  hmd._watchRef = null;
};

// TODO upgrade to an implementation supporting async conditions
hmd.sleepUntil = async (f, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    let timeWas = new Date();
    let wait = setInterval(function () {
      const out = f();
      if (out) {
        // console.log("resolved after", new Date() - timeWas, "ms");
        clearInterval(wait);
        resolve(out);
      } else if (new Date() - timeWas > timeoutMs) {
        // Timeout
        // console.log("rejected after", new Date() - timeWas, "ms");
        clearInterval(wait);
        reject('timeout');
      }
    }, 20);
  });
};

hmd._logWrapper = (level, ...msgs) => {
  const KEY = 'hebug';
  if (window.localStorage.getItem(KEY) != 'true') return;
  console[level](...msgs);
};

hmd.logger = {
  log: (...msgs) => hmd._logWrapper('log', ...msgs),
  warn: (...msgs) => hmd._logWrapper('warn', ...msgs),
  error: (...msgs) => hmd._logWrapper('error', ...msgs),
  info: (...msgs) => hmd._logWrapper('info', ...msgs),
};

/**
predicate: (key, value) => boolean
**/
hmd.searchObjTree = (obj, maxDepth = 2, predicate = undefined) => {
  const visited = new Set();
  const skipKeys = new Set();

  const find = (obj, depth = 0, path = '') => {
    if (depth > maxDepth) return;
    if (visited.has(path)) {
      return;
    } else {
      visited.add(path); // FIXME: isn't enough
    }

    for (let key in obj) {
      if (skipKeys.has(key)) continue;
      let val = obj[key];
      if (predicate && predicate(key, val)) {
        return { path, key, val };
      }
      if (typeof val === 'object') {
        const rv = find(val, depth + 1, path + '.' + key);
        if (rv !== undefined) return rv;
      }
    }
  };
  return find(obj);
};

hmd.cc.runMain = async (main, ...args) => {
  setTimeout(async () => {
    try {
      console.log('running main');
      await main(...args);
    } catch (e) {
      console.error(e);
    }
  }, 1000);
};

hmd.beep = () => {
  const snd = new Audio(hmd._data.beep);
  snd.play();
};

hmd.click = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return;
  el.click();
};

/** list of added global objects */
hmd.addedGlobals = () => {
  const baseKeys = hmd._data.windowObjBaseline
    .split(',')
    // convert to a hashset
    .reduce((acc, cur) => {
      acc[cur] = true;
      return acc;
    }, {});

  const addedGlobals = {};
  for (let key in window) {
    if (!baseKeys[key]) {
      addedGlobals[key] = window[key];
    }
  }

  return addedGlobals;
};

hmd._data = {
  beep: 'data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=',
  windowObjBaseline:
    '0,UserHeatTag,__REACT_DEVTOOLS_APPEND_COMPONENT_STACK__,__REACT_DEVTOOLS_BREAK_ON_CONSOLE_ERRORS__,__REACT_DEVTOOLS_BROWSER_THEME__,__REACT_DEVTOOLS_COMPONENT_FILTERS__,__REACT_DEVTOOLS_HIDE_CONSOLE_LOGS_IN_STRICT_MODE__,__REACT_DEVTOOLS_SHOW_INLINE_WARNINGS_AND_ERRORS__,_uhtracker,alert,atob,blur,btoa,caches,cancelAnimationFrame,cancelIdleCallback,captureEvents,chrome,clearInterval,clearTimeout,clientInformation,close,closed,confirm,cookieStore,createImageBitmap,crossOriginIsolated,crowdClients,crypto,customElements,dataLayer,defaultStatus,defaultstatus,devicePixelRatio,document,external,fetch,find,focus,frameElement,frames,getComputedStyle,getScreenDetails,getSelection,gtag,history,hmd,indexedDB,innerHeight,innerWidth,isSecureContext,launchQueue,length,localStorage,location,locationbar,matchMedia,menubar,moveBy,moveTo,name,navigation,navigator,onabort,onafterprint,onanimationend,onanimationiteration,onanimationstart,onappinstalled,onauxclick,onbeforeinput,onbeforeinstallprompt,onbeforematch,onbeforeprint,onbeforeunload,onbeforexrselect,onblur,oncancel,oncanplay,oncanplaythrough,onchange,onclick,onclose,oncontextlost,oncontextmenu,oncontextrestored,oncuechange,ondblclick,ondevicemotion,ondeviceorientation,ondeviceorientationabsolute,ondrag,ondragend,ondragenter,ondragleave,ondragover,ondragstart,ondrop,ondurationchange,onemptied,onended,onerror,onfocus,onformdata,ongotpointercapture,onhashchange,oninput,oninvalid,onkeydown,onkeypress,onkeyup,onlanguagechange,onload,onloadeddata,onloadedmetadata,onloadstart,onlostpointercapture,onmessage,onmessageerror,onmousedown,onmouseenter,onmouseleave,onmousemove,onmouseout,onmouseover,onmouseup,onmousewheel,onoffline,ononline,onpagehide,onpageshow,onpause,onplay,onplaying,onpointercancel,onpointerdown,onpointerenter,onpointerleave,onpointermove,onpointerout,onpointerover,onpointerrawupdate,onpointerup,onpopstate,onprogress,onratechange,onrejectionhandled,onreset,onresize,onscroll,onsearch,onsecuritypolicyviolation,onseeked,onseeking,onselect,onselectionchange,onselectstart,onslotchange,onstalled,onstorage,onsubmit,onsuspend,ontimeupdate,ontoggle,ontransitioncancel,ontransitionend,ontransitionrun,ontransitionstart,onunhandledrejection,onunload,onvolumechange,onwaiting,onwebkitanimationend,onwebkitanimationiteration,onwebkitanimationstart,onwebkittransitionend,onwheel,open,openDatabase,opener,origin,originAgentCluster,outerHeight,outerWidth,pageXOffset,pageYOffset,parent,performance,personalbar,postMessage,print,prompt,queryLocalFonts,queueMicrotask,releaseEvents,reportError,requestAnimationFrame,requestIdleCallback,resizeBy,resizeTo,scheduler,screen,screenLeft,screenTop,screenX,screenY,scroll,scrollBy,scrollTo,scrollX,scrollY,scrollbars,self,sessionStorage,setInterval,setTimeout,showDirectoryPicker,showOpenFilePicker,showSaveFilePicker,spaceOut,speechSynthesis,status,statusbar,stop,structuredClone,styleMedia,toolbar,top,trustedTypes,visualViewport,webkitCancelAnimationFrame,webkitRequestAnimationFrame,webkitRequestFileSystem,webkitResolveLocalFileSystemURL,webkitStorageInfo,window',
};
