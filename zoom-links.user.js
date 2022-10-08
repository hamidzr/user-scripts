// ==UserScript==
// @name         Zoom link upgrader
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @updateURL
// @description  Swap http Zoom meeting links to zoommtg:// links
// @author       Hamid Zare @hamidzr
// @match        https://calendar.google.com/*
// @run-at document-idle
// ==/UserScript==

'use strict';

// https://www.google.com/url?q=https://zoom.us/j/97004757505&sa=D&ust=1591838079140000&usg=AOvVaw11Q_StishuRddQCQrJcLt1

const selectors = {
  zoomLinks: 'a[href*="zoom.us/j/"]',
};

const buildZoomHref = (meetingNumber) =>
  `zoommtg://zoom.us/join?action=join&confno=${meetingNumber}`;

const meetingNumberRe = new RegExp('(?<=zoom.us/j/)d+', 'i');

const main = () => {
  const zooms = Array.from(document.querySelectorAll(selectors.zoomLinks));
  console.log('found zooms', zooms);
  zooms.forEach((zoomA) => {
    const meetingNumber = zoomA.href.match(meetingNumberRe);
    if (meetingNumber) zoomA.href = buildZoomHref(meetingNumber);
  });
};

main();
