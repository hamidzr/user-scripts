// ==UserScript==
// @name                 Teams Utils
// @author               AZ
// @description          auto-join meetings, mute, and capture transcripts in Microsoft Teams
// @grant                none
// @match                https://teams.microsoft.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @version              0.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var findAll = (selector) => {
    return Array.from(document.querySelectorAll(selector)).filter((el) => el instanceof HTMLElement);
  };
  var POLL_INTERVAL = 100;
  var DEFAULT_TIMEOUT = 2000;
  var pollUntil = (fn, timeoutMs) => {
    const endTime = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const result = await fn();
          if (result !== null && result !== undefined) {
            resolve(result);
          } else if (Date.now() > endTime) {
            reject(new Error("timeout"));
          } else {
            setTimeout(check, POLL_INTERVAL);
          }
        } catch (error) {
          reject(error);
        }
      };
      check();
    });
  };
  var find = async (selector, opts) => {
    const timeout = opts?.timeout ?? DEFAULT_TIMEOUT;
    if (timeout) {
      return pollUntil(() => find(selector, { ...opts, timeout: 0 }), timeout);
    }
    if (opts?.text) {
      return findAll(selector).find((el2) => el2.innerText.includes(opts.text)) ?? null;
    }
    const el = document.querySelector(selector);
    return el instanceof HTMLElement ? el : null;
  };

  // src/lib/download.ts
  var stringify = (val) => {
    if (typeof val === "string")
      return val;
    if (Array.isArray(val))
      return val.map(stringify).join(`
`);
    if (val instanceof HTMLElement)
      return val.innerText;
    return JSON.stringify(val);
  };
  var download = (filename, text) => {
    const content = stringify(text);
    const el = document.createElement("a");
    el.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    el.setAttribute("download", filename);
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  // src/lib/poll.ts
  var rerunUntilSuccess = (fn, intervalMs) => {
    let id;
    const promise = new Promise((resolve) => {
      id = setInterval(async () => {
        try {
          const done = await fn() === true;
          if (done) {
            clearInterval(id);
            resolve();
          }
        } catch (_e) {}
      }, intervalMs);
    });
    const stop = () => clearInterval(id);
    return { promise, stop };
  };

  // src/teams.microsoft.com/teams.user.ts
  var sels = {
    lines: "calling-closed-captions .ts-calling-closed-captions-words span",
    joinBtn: 'button[data-tid="joinOnWeb"]',
    joinNow: 'button[aria-label="Join now"]',
    toggleMute: '[data-cid="toggle-mute-true"]',
    openDevSettings: '[aria-label="Open device settings"]',
    overallGrid: '[data-tid="experience-layout"]'
  };
  var capturedLines = [];
  var meetingLink = window.location.href;
  var downloadTranscript = (filename = "matn-jalase") => {
    console.log("downloading", capturedLines.length, "lines");
    const lines = [`meeting link: ${meetingLink}`, ...capturedLines];
    download(filename, lines.join("NEWLINE"));
    capturedLines = [];
  };
  window.teamsDownload = downloadTranscript;
  var findAndClickJoinBtn = async () => {
    const btn = await find(sels.joinBtn, { timeout: 0 });
    if (!btn)
      return;
    btn.click();
    return true;
  };
  var styleJoinBtn = () => {
    const btn = document.querySelector(sels.joinNow);
    if (!btn)
      return;
    btn.style.position = "fixed";
    btn.style.top = "50%";
    btn.style.left = "50%";
    btn.style.transform = "translate(-50%, -50%)";
  };
  var joinMuted = async () => {
    const btn = await find(sels.toggleMute, { timeout: 0 });
    if (!btn)
      return;
    btn.click();
    styleJoinBtn();
    return true;
  };
  var openDevSettings = async () => {
    const btn = await find(sels.openDevSettings, { timeout: 0 });
    if (!btn)
      return;
    btn.click();
    return true;
  };
  var hideLeftSidebar = async () => {
    const el = await find(sels.overallGrid, { timeout: 0 });
    if (!el)
      return;
    el.style.gridTemplate = `
    "title-bar title-bar title-bar" 4.8rem
    "line-loader line-loader line-loader" 0px
    "notifications notifications notifications"
    "toasts nav header"
    "toasts nav main" minmax(0px, 1fr) / 0px 0px minmax(0px, 1fr);
  `;
    return true;
  };
  var main = () => {
    rerunUntilSuccess(findAndClickJoinBtn, 1000);
    rerunUntilSuccess(joinMuted, 1000);
    rerunUntilSuccess(openDevSettings, 1000);
    rerunUntilSuccess(hideLeftSidebar, 3000);
  };
  main();
})();
