// ==UserScript==
// @name                 Google Meet - Auto Mute on Join
// @author               AZ
// @description          automatically disables microphone and camera on the Google Meet join screen
// @grant                none
// @match                https://meet.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @version              1.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var POLL_INTERVAL = 100;
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

  // src/meet.google.com/google-meet-auto-mute.user.ts
  var MAX_RUNTIME_MS = 30000;
  var micDone = false;
  var camDone = false;
  var tryMute = () => {
    if (micDone && camDone)
      return true;
    const tooltipBtns = document.querySelectorAll('div[role="button"][data-tooltip]');
    for (const btn of tooltipBtns) {
      const tip = btn.getAttribute("data-tooltip") ?? "";
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
    if (!micDone || !camDone) {
      const buttons = document.querySelectorAll("button[aria-label]");
      for (const btn of buttons) {
        const label = btn.getAttribute("aria-label") ?? "";
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
    return micDone && camDone ? true : null;
  };
  pollUntil(tryMute, MAX_RUNTIME_MS).then(() => console.log("[Meet Auto-Mute] done, both muted")).catch(() => console.log("[Meet Auto-Mute] timed out, mic:", micDone, "cam:", camDone));
})();
