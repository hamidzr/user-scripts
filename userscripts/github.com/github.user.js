// ==UserScript==
// @name                 GitHub Status Checks
// @author               Zare
// @description          reorder GitHub PR status checks so failures appear first
// @grant                none
// @match                https://github.com/*/*/pull/*
// @namespace            hamidza.re
// @run-at               document-idle
// @version              0.1.1
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

  // src/lib/poll.ts
  var addInterval = (fn, intervalMs) => {
    const id = setInterval(() => {
      try {
        fn();
      } catch (_e) {}
    }, intervalMs);
    return () => clearInterval(id);
  };

  // src/github.com/github.user.ts
  var sels = {
    statusParent: ".merge-status-list.js-updatable-content-preserve-scroll-position",
    status: ".merge-status-item"
  };
  var STATUS_ORDER = {
    failed: 1,
    "in-progress": 2,
    unknown: 3,
    pending: 4,
    skipped: 5,
    completed: 5.5,
    passed: 6
  };
  var getStatus = (el) => {
    if (el.querySelector(".octicon-check"))
      return "passed";
    if (el.querySelector(".octicon-square-fill"))
      return "completed";
    if (el.querySelector(".octicon-x"))
      return "failed";
    if (el.querySelector(".anim-rotate"))
      return "in-progress";
    if (el.querySelector(".octicon-skip"))
      return "skipped";
    if (el.querySelector(".octicon-dot-fill"))
      return "pending";
    console.warn("failed to identify status:", el);
    return "unknown";
  };
  var reorderStatusChecks = async () => {
    const parent = await find(sels.statusParent);
    if (!parent)
      return;
    const items = Array.from(parent.children);
    const sorted = [...items].sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
    const needsReorder = sorted.some((item, i) => item !== items[i]);
    if (!needsReorder)
      return;
    console.log("reordering statuses");
    for (const item of items)
      parent.removeChild(item);
    for (const item of sorted)
      parent.appendChild(item);
  };
  var main = async () => {
    const parent = await find(sels.statusParent, { timeout: 1e4 });
    if (!parent)
      return;
    await new Promise((resolve) => {
      const check = () => {
        const statuses = findAll(sels.statusParent + " " + sels.status);
        if (statuses.length > 5) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
    await reorderStatusChecks();
    addInterval(reorderStatusChecks, 3000);
  };
  main();
})();
