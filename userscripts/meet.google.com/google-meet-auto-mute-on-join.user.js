// ==UserScript==
// @name        Google Meet - Auto Mute on Join
// @namespace   hmd-userscripts
// @match       https://meet.google.com/*
// @version     1.1
// @description Automatically disables microphone and camera on the Google Meet join screen
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function () {
  "use strict";

  const MAX_RUNTIME_MS = 30_000;
  const POLL_INTERVAL_MS = 500;

  let micDone = false;
  let camDone = false;
  const startTime = Date.now();

  function tryMute() {
    if (micDone && camDone) return true;

    // pre-join screen: div[role="button"][data-tooltip]
    const tooltipBtns = document.querySelectorAll(
      'div[role="button"][data-tooltip]',
    );
    for (const btn of tooltipBtns) {
      const tip = btn.getAttribute("data-tooltip") || "";
      if (!micDone && tip.startsWith("Turn off microphone")) {
        btn.click();
        micDone = true;
        console.log("[Meet Auto-Mute] microphone muted (pre-join)");
      }
      if (!camDone && tip.startsWith("Turn off camera")) {
        btn.click();
        camDone = true;
        console.log("[Meet Auto-Mute] camera muted (pre-join)");
      }
    }

    // in-meeting screen: button[aria-label]
    if (!micDone || !camDone) {
      const buttons = document.querySelectorAll("button[aria-label]");
      for (const btn of buttons) {
        const label = btn.getAttribute("aria-label") || "";
        if (!micDone && label === "Turn off microphone") {
          btn.click();
          micDone = true;
          console.log("[Meet Auto-Mute] microphone muted (in-meeting)");
        }
        if (!camDone && label === "Turn off camera") {
          btn.click();
          camDone = true;
          console.log("[Meet Auto-Mute] camera muted (in-meeting)");
        }
      }
    }

    return micDone && camDone;
  }

  const timer = setInterval(() => {
    if (tryMute() || Date.now() - startTime > MAX_RUNTIME_MS) {
      clearInterval(timer);
      if (micDone && camDone) {
        console.log("[Meet Auto-Mute] done, both muted");
      } else {
        console.log(
          "[Meet Auto-Mute] timed out, mic:",
          micDone,
          "cam:",
          camDone,
        );
      }
    }
  }, POLL_INTERVAL_MS);
})();
