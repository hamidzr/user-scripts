// ==UserScript==
// @name         Craigslist Enhancements
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @updateURL
// @description  TODO
// @author       Hamid Zare @hamidzr
// @match        https://*.craigslist.org/**/*.html
// @run-at document-idle
// ==/UserScript==

'use strict';

const matchRe = new RegExp(/https:\/\/.*.craigslist.org\/\w{3}\/\w{1,3}\/.*\/\d+.html/);

const PAGECHECKDELAY = 500;

//check to see if we recently arrived on pullrequests page. (due to ajax loading)
setTimeout(() => {
  if (document.URL.match(matchRe)) main();
}, PAGECHECKDELAY);

function main() {
  addStyle(`
    .gallery {
      /* grid-gap: 3rem; */
      /* grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr)); */
      /* display: grid; */
      /* grid-template-columns: repeat(8, 1fr); */
      /* grid-template-rows: repeat(8, 5vw); */
      /* grid-gap: 15px; */
    }
    .gallery img {
      width: unset !important;
      height: unset !important;
      display: inline !important;
      border: 2px solid white;
    }
  `);

  addStyle(`
    section.body {
      max-width: 100vw;
    }

    section#postingbody {
      width: unset !important;
    }
  `)

  const els = Array.from(document.querySelectorAll('a.thumb')).map(a => a.href)
  const gallery = document.createElement('div')
  els.forEach(src => {
    const el = document.createElement('img')
    el.src = src
    /* setMaxImgSize(src); */
    gallery.appendChild(el)
  })
  gallery.className = 'gallery'
  document.querySelector('figure.iw').remove()
  document.querySelector('section.userbody').appendChild(gallery)
};

/**
 * Utility function to add CSS in multiple passes.
 * @param {string} styleString
 */
function addStyle(styleString) {
  const style = document.createElement('style');
  style.textContent = styleString;
  document.head.append(style);
}

// max = {width: 0, height: 0};

// function setMaxImgSize(imgSrc) {
//     var newImg = new Image();

//     newImg.onload = function() {
//       var height = newImg.height;
//       var width = newImg.width;
//       if (height > max.height) max.height = height;
//       if (width > max.width) max.width = width;
//     }

//     newImg.src = imgSrc; // this must be done AFTER setting onload

// }



/* setTimeout(() => { */
/*     addStyle(` */
/*       .gallery { */
/*         grid-template-columns: repeat(auto-fill, minmax(${max.width}px, 1fr)); */
/*       } */
/*     `) */
/* }, 2000) */


function toggleVisibility(element) {
  if (element.style.display === 'none') {
    element.style.display = 'block';
  } else {
    element.style.display = 'none';
  }
}

// nodesObj to array
function toArray(obj) {
  var array = [];
  // iterate backwards ensuring that length is an UInt32
  for (var i = obj.length >>> 0; i--;) {
    array[i] = obj[i];
  }
  return array;
}
