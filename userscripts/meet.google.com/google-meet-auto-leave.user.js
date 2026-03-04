// ==UserScript==
// @name                 Google Meet - Auto Leave on Empty
// @author               Zare
// @description          detects when participants drop and prompts to leave with a countdown
// @grant                none
// @match                https://meet.google.com/*
// @namespace            hamidza.re
// @run-at               document-idle
// @version              1.1.0
// ==/UserScript==

'use strict';
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap).get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function") {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
    }
    __moduleCache.set(from, entry);
    return entry;
  };
  var __moduleCache;

  // src/meet.google.com/google-meet-auto-leave.user.ts
  var exports_google_meet_auto_leave_user = {};
  var TAG = "[Meet Leave Detector]";
  var POLL_INTERVAL = 5000;
  var COUNTDOWN_SECONDS = 3;
  var STABILIZE_DELAY = 15000;
  var countHistory = [];
  var baselineCount = null;
  var alerted = false;
  var monitoring = false;
  var pollTimer = null;
  var getParticipantCount = () => {
    const peopleSpan = document.getElementById("DPUxh-nav9Xe");
    if (peopleSpan) {
      const parent = peopleSpan.parentElement;
      if (parent) {
        const m = parent.textContent?.trim().match(/People(\d+)/);
        if (m)
          return parseInt(m[1], 10);
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.trim();
      if (t === "People") {
        const gp = walker.currentNode.parentElement?.parentElement;
        if (gp) {
          const m = gp.textContent?.trim().match(/People(\d+)/);
          if (m)
            return parseInt(m[1], 10);
        }
      }
    }
    const ids = new Set([...document.querySelectorAll("[data-participant-id]")].map((e) => e.dataset.participantId));
    if (ids.size > 0)
      return ids.size;
    if (document.querySelector('button[aria-label="Leave call"]'))
      return 1;
    return null;
  };
  var leaveMeeting = () => {
    const btn = document.querySelector('button[aria-label="Leave call"]');
    if (btn) {
      btn.click();
      console.log(TAG, "clicked Leave call");
    } else {
      console.warn(TAG, "could not find Leave call button");
    }
  };
  var promptLeave = (reason) => {
    if (alerted)
      return;
    alerted = true;
    console.log(TAG, "trigger:", reason);
    let remaining = COUNTDOWN_SECONDS;
    const overlay = document.createElement("div");
    overlay.id = "meet-leave-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      fontFamily: "Google Sans, Roboto, Arial, sans-serif"
    });
    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#202124",
      color: "#e8eaed",
      borderRadius: "12px",
      padding: "28px 36px",
      maxWidth: "400px",
      textAlign: "center",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
    });
    const title = document.createElement("div");
    title.textContent = reason;
    Object.assign(title.style, { fontSize: "16px", marginBottom: "12px", color: "#f28b82" });
    const msg = document.createElement("div");
    msg.id = "meet-leave-msg";
    msg.textContent = `Leaving in ${remaining} seconds...`;
    Object.assign(msg.style, { fontSize: "22px", fontWeight: "500", marginBottom: "20px" });
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Stay in meeting";
    Object.assign(cancelBtn.style, {
      padding: "10px 28px",
      fontSize: "14px",
      fontWeight: "500",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      background: "#8ab4f8",
      color: "#202124"
    });
    card.append(title, msg, cancelBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try {
      const ctx = new AudioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_e) {}
    const countdownTimer = setInterval(() => {
      remaining--;
      const el = document.getElementById("meet-leave-msg");
      if (el)
        el.textContent = `Leaving in ${remaining} second${remaining !== 1 ? "s" : ""}...`;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        overlay.remove();
        leaveMeeting();
      }
    }, 1000);
    cancelBtn.addEventListener("click", () => {
      clearInterval(countdownTimer);
      overlay.remove();
      console.log(TAG, "user cancelled leave");
      alerted = false;
      const current = getParticipantCount();
      if (current !== null) {
        baselineCount = current;
        countHistory = [{ count: current, time: Date.now() }];
      }
    });
  };
  var evaluateDrop = (prevCount, currentCount) => {
    if (currentCount <= 1 && baselineCount !== null && baselineCount > 1) {
      return "You're the only one left in this meeting";
    }
    if (baselineCount !== null && baselineCount >= 6) {
      if (prevCount !== null && prevCount > 1) {
        const dropped = prevCount - currentCount;
        const dropPercent = dropped / prevCount;
        if (dropPercent >= 0.5 && dropped >= 2) {
          return `${dropped} of ${prevCount} participants just left (${Math.round(dropPercent * 100)}% drop)`;
        }
      }
    }
    return null;
  };
  var poll = () => {
    const count = getParticipantCount();
    if (count === null)
      return;
    const now = Date.now();
    const prev = countHistory.length > 0 ? countHistory[countHistory.length - 1] : null;
    if (baselineCount === null || count > baselineCount) {
      baselineCount = count;
    }
    countHistory.push({ count, time: now });
    if (countHistory.length > 60)
      countHistory.shift();
    console.log(TAG, `count=${count} baseline=${baselineCount} prev=${prev?.count ?? "?"}`);
    const reason = evaluateDrop(prev?.count ?? null, count);
    if (reason)
      promptLeave(reason);
  };
  var isInMeeting = () => !!document.querySelector('button[aria-label="Leave call"]');
  var startMonitoring = () => {
    if (monitoring)
      return;
    monitoring = true;
    console.log(TAG, `in meeting, waiting ${STABILIZE_DELAY / 1000}s before monitoring`);
    setTimeout(() => {
      console.log(TAG, "monitoring started");
      const initial = getParticipantCount();
      if (initial !== null) {
        baselineCount = initial;
        countHistory = [{ count: initial, time: Date.now() }];
      }
      pollTimer = setInterval(poll, POLL_INTERVAL);
    }, STABILIZE_DELAY);
  };
  var stopMonitoring = () => {
    if (!monitoring)
      return;
    monitoring = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    countHistory = [];
    baselineCount = null;
    alerted = false;
    console.log(TAG, "monitoring stopped");
  };
  var meetObserver = new MutationObserver(() => {
    if (isInMeeting() && !monitoring)
      startMonitoring();
    else if (!isInMeeting() && monitoring)
      stopMonitoring();
  });
  meetObserver.observe(document.body, { childList: true, subtree: true });
  setInterval(() => {
    if (isInMeeting() && !monitoring)
      startMonitoring();
    else if (!isInMeeting() && monitoring)
      stopMonitoring();
  }, 3000);
  if (isInMeeting())
    startMonitoring();
  console.log(TAG, "loaded, waiting to join meeting");
})();
