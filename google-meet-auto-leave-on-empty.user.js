// ==UserScript==
// @name        Google Meet - Auto Leave on Empty
// @namespace   hmd-userscripts
// @version     1.1
// @description Detects when participants drop and prompts to leave with a 3s countdown
// @match       https://meet.google.com/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function () {
  "use strict";

  const TAG = "[Meet Leave Detector]";
  const POLL_INTERVAL = 5000; // check every 5 seconds
  const COUNTDOWN_SECONDS = 3;
  const STABILIZE_DELAY = 15000; // wait 15s after joining before monitoring

  let history = []; // recent count readings: { count, time }
  let baselineCount = null; // highest count seen (the "full" meeting)
  let alerted = false; // only alert once per trigger
  let monitoring = false;
  let pollTimer = null;

  // --- participant count ---

  function getParticipantCount() {
    // method 1: parse "People<N>" from the hover tray label
    const peopleSpan = document.getElementById("DPUxh-nav9Xe");
    if (peopleSpan) {
      const parent = peopleSpan.parentElement;
      if (parent) {
        const m = parent.textContent.trim().match(/People(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }

    // method 2: walk text nodes for "People" + sibling number
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      if (t === "People") {
        const gp = walker.currentNode.parentElement?.parentElement;
        if (gp) {
          const m = gp.textContent.trim().match(/People(\d+)/);
          if (m) return parseInt(m[1], 10);
        }
      }
    }

    // method 3: count unique participant tiles
    const ids = new Set(
      [...document.querySelectorAll("[data-participant-id]")].map(
        (e) => e.dataset.participantId,
      ),
    );
    if (ids.size > 0) return ids.size;

    // method 4: if we're in a meeting (leave button exists) but found nothing
    // above, it means we're alone (Meet hides the count/tiles when solo)
    if (document.querySelector('button[aria-label="Leave call"]')) {
      return 1;
    }

    return null; // not in a meeting yet
  }

  // --- leave meeting ---

  function leaveMeeting() {
    const btn = document.querySelector('button[aria-label="Leave call"]');
    if (btn) {
      btn.click();
      console.log(TAG, "clicked Leave call");
    } else {
      console.warn(TAG, "could not find Leave call button");
    }
  }

  // --- countdown prompt ---

  function promptLeave(reason) {
    if (alerted) return;
    alerted = true;
    console.log(TAG, "trigger:", reason);

    let remaining = COUNTDOWN_SECONDS;

    // build a simple overlay instead of window.confirm (which blocks the thread)
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
      fontFamily: "Google Sans, Roboto, Arial, sans-serif",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#202124",
      color: "#e8eaed",
      borderRadius: "12px",
      padding: "28px 36px",
      maxWidth: "400px",
      textAlign: "center",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    });

    const title = document.createElement("div");
    title.textContent = reason;
    Object.assign(title.style, {
      fontSize: "16px",
      marginBottom: "12px",
      color: "#f28b82",
    });

    const msg = document.createElement("div");
    msg.id = "meet-leave-msg";
    msg.textContent = `Leaving in ${remaining} seconds...`;
    Object.assign(msg.style, {
      fontSize: "22px",
      fontWeight: "500",
      marginBottom: "20px",
    });

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
      color: "#202124",
    });

    card.append(title, msg, cancelBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // play a tone to get attention
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {
      /* audio not critical */
    }

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
      // reset so we can trigger again if conditions persist
      alerted = false;
      // reset baseline to current count so we don't re-trigger immediately
      const current = getParticipantCount();
      if (current !== null) {
        baselineCount = current;
        history = [{ count: current, time: Date.now() }];
      }
    });
  }

  // --- threshold logic ---

  function evaluateDrop(prevCount, currentCount) {
    // count = 1 means you're alone
    // but only trigger if we previously saw others (baseline > 1)
    // this avoids triggering when you join an empty meeting and wait
    if (currentCount <= 1 && baselineCount !== null && baselineCount > 1) {
      return "You're the only one left in this meeting";
    }

    // for meetings with 6+ people at peak, trigger on 50%+ sudden drop
    if (baselineCount !== null && baselineCount >= 6) {
      if (prevCount !== null && prevCount > 1) {
        const dropped = prevCount - currentCount;
        const dropPercent = dropped / prevCount;
        if (dropPercent >= 0.5 && dropped >= 2) {
          return `${dropped} of ${prevCount} participants just left (${Math.round(dropPercent * 100)}% drop)`;
        }
      }
    }

    return null; // no trigger
  }

  // --- main poll loop ---

  function poll() {
    const count = getParticipantCount();
    if (count === null) return; // not in meeting yet

    const now = Date.now();
    const prev = history.length > 0 ? history[history.length - 1] : null;

    // track peak
    if (baselineCount === null || count > baselineCount) {
      baselineCount = count;
    }

    history.push({ count, time: now });
    // keep last 60 readings (~5 minutes at 5s intervals)
    if (history.length > 60) history.shift();

    console.log(
      TAG,
      `count=${count} baseline=${baselineCount} prev=${prev?.count ?? "?"}`,
    );

    const reason = evaluateDrop(prev?.count ?? null, count);
    if (reason) {
      promptLeave(reason);
    }
  }

  // --- detect when we're actually in a meeting ---

  function isInMeeting() {
    // in-meeting: Leave call button exists
    return !!document.querySelector('button[aria-label="Leave call"]');
  }

  function startMonitoring() {
    if (monitoring) return;
    monitoring = true;
    console.log(
      TAG,
      `in meeting, waiting ${STABILIZE_DELAY / 1000}s before monitoring`,
    );
    setTimeout(() => {
      console.log(TAG, "monitoring started");
      // take initial reading
      const initial = getParticipantCount();
      if (initial !== null) {
        baselineCount = initial;
        history = [{ count: initial, time: Date.now() }];
      }
      pollTimer = setInterval(poll, POLL_INTERVAL);
    }, STABILIZE_DELAY);
  }

  function stopMonitoring() {
    if (!monitoring) return;
    monitoring = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    history = [];
    baselineCount = null;
    alerted = false;
    console.log(TAG, "monitoring stopped");
  }

  // --- boot ---

  // watch for meeting join/leave via mutation observer + periodic check
  const observer = new MutationObserver(() => {
    if (isInMeeting() && !monitoring) {
      startMonitoring();
    } else if (!isInMeeting() && monitoring) {
      stopMonitoring();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // also do a periodic check in case mutations miss it
  setInterval(() => {
    if (isInMeeting() && !monitoring) {
      startMonitoring();
    } else if (!isInMeeting() && monitoring) {
      stopMonitoring();
    }
  }, 3000);

  // check immediately
  if (isInMeeting()) {
    startMonitoring();
  }

  console.log(TAG, "loaded, waiting to join meeting");
})();
