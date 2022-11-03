// ==UserScript==
// @name         Teams Open In Browser
// @namespace    http://hamidza.re
// @version      0.1.0
// @description  Click the "Open in browser" button on the Teams desktop app automatically
// @author       Zare
// @match        *://teams.microsoft.com/dl/launcher/launcher.html*
// @grant        none
// ==/UserScript==

'use strict';

const sels = {
  btn: 'button[data-tid="joinOnWeb"]',
};

const main = async () => {
  const webJoin = await hmd.find(sels.btn);
  webJoin.click();
};

main();
