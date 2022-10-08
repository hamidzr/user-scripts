// ==UserScript==
// @name         Airbnb Final Per Night
// @namespace    https://hamidza.re
// @version      0.1.0
// @description  Show pull request diff stats next to each PR in PR list view.
// @author       Hamid Zare @hamidzr
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.min.js
// @match        https://www.airbnb.com/s/*
// @run-at document-idle
// ==/UserScript==

'use strict';

const parser = new DOMParser();

const selectors = {
  roomBox: 'a[aria-labelledby^="title"][href^="/room"]',
  mapDiv: 'div.gm-style',
  detailTotal: '._1qh0b5n',
};

const getRoomBox = () => {
  const roomBox = document.querySelector(selectors.mapDiv + ' ' + selectors.roomBox);
  return roomBox;
};

// check if a room box is visible
const isRoomBoxVisible = () => {
  const roomBox = getRoomBox();
  return roomBox && roomBox.offsetParent !== null;
};

// asnyc functino to sleep for n miliseconds
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// utility function to check for a condition in a loop with custom wait
const waitFor = async (condition, wait, timeout) => {
  const start = Date.now();
  while (!condition()) {
    await sleep(wait);
    if (Date.now() - start > timeout) {
      return false;
      // throw new Error('Timeout');
    }
  }
  return true;
};

const main = async () => {
  // const prsQ = Array.from(document.querySelectorAll(selectors.prATags));
  while (true) {
    const visible = await waitFor(isRoomBoxVisible, 500, 30000);
    if (visible) {
      window.alert('Room box visible');
      const room = getRoomBox();
      console.log(room, room.href);
      const response = await axios.get(room.href);
      console.log('resp', response);
      const doc = parser.parseFromString(response.data, 'text/html');
      const total = doc.querySelector(selectors.detailTotal);
      console.log('total', total && total.innerText);
      window.alert('total', total.innerText);
      break;
    }
    // const prAnchor = prsQ.shift(); // pr anchor tag
    // const response = await axios.get(prAnchor.href);
    // const prDoc = parser.parseFromString(response.data, 'text/html');
    // const diffStats = prDoc.querySelector(selectors.diffStats);
    // if (diffStats === null) {
    //   prsQ.push(prAnchor);
    // } else {
    //   prAnchor.append(diffStats);
    // }
    // }
  }
};

main();
