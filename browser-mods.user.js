// ==UserScript==
// @name         Hamid's Browser Mods
// @namespace    http://hamidza.re
// @version      0.7.0
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

hmd._stringify = (any) => {
  switch (typeof any) {
    case 'string':
      return any;
    case 'array':
      return any.map(stringify).join('\n');
    default:
      if (any instanceof Element) {
        return any.innerText;
      }
      return JSON.stringify(any);
  }
}

// download text
hmd.download = (filename, text) => {
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


hmd.readClipboard = async () => {
  await hmd.sleepUntil(document.hasFocus.bind(document), 10000)
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
}

hmd._watchRef = null;
// to help with developing code in the dev console.
// eg use ur editor, copy the code, then tab in the browser to test it out
// suggestion use `main = () => {};`
hmd.watchClipboard = (interval = 100) => {
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

// TODO upgrade to an implementation supporting async conditions
hmd.sleepUntil = async (f, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    let timeWas = new Date();
    let wait = setInterval(function() {
      if (f()) {
        // console.log("resolved after", new Date() - timeWas, "ms");
        clearInterval(wait);
        resolve();
      } else if (new Date() - timeWas > timeoutMs) { // Timeout
        // console.log("rejected after", new Date() - timeWas, "ms");
        clearInterval(wait);
        reject();
      }
    }, 20);
  });
};


hmd.beep = () => {
    const snd = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");  
    snd.play();
};
