// ==UserScript==
// @name         Google Feeling Lucky Redirect
// @namespace    http://hamidza.re
// @version      0.1.0
// @description  Automatically redirects to the first result of a Google search when a "Feeling Lucky" search link is opened.
// @author       Hamid Zare
// @match        *://*.google.com/search?q=*
// @match        *://*.google.com/url?q=*
// @grant        none
// ==/UserScript==

'use strict';

/*
Google sometimes doesn't automatically redirect you when you click a link that was set up to
mimick the "feeling luckly" button click. This script does that for you.
*/

const redirectToUrl = (url) => {
  console.log(`Redirecting to ${url}`);
  window.location.href = url;
}

const url = new URL(window.location.href);
const isAluckyQuery = url.href.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase().includes('feelinglucky');

if (isAluckyQuery) {
  // get the first google search result and redirect to it
  const firstResult = document.querySelector('div.g > div > div > div > a');
  if (firstResult) {
    redirectToUrl(firstResult.href);
  }
}

// https://www.google.com/url?q=https://www.crunchbase.com/organization/nuro-2
// get the part after the q query parameter
if (url.pathname === '/url') {
  const urlParam = url.searchParams.get('q');
  if (urlParam) {
    redirectToUrl(urlParam);
  }
}

