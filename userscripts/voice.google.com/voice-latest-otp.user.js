// ==UserScript==
// @name                 Google Voice Latest Login Code
// @author               Zare
// @description          surface the most recent login / verification code from Google Voice texts for one-click copying
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/voice.google.com/voice-latest-otp.user.js
// @grant                none
// @match                https://voice.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/voice.google.com/voice-latest-otp.user.js
// @version              1.3.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/clipboard.ts
  var copyTextWithFallback = async (text, promptTitle) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_e) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok)
        return true;
    } catch (_e) {}
    window.prompt(promptTitle, text);
    return false;
  };

  // src/lib/dom.ts
  var injectCSS = (id, css) => {
    let style = document.getElementById(id);
    if (style) {
      style.textContent = css;
      return style;
    }
    style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
    return style;
  };
  var createElement = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "className") {
          el.className = value;
        } else {
          el[key] = value;
        }
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === "string") {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      }
    }
    return el;
  };

  // src/lib/dom-observe.ts
  var DEFAULT_INIT = {
    childList: true,
    subtree: true
  };
  var observeDomChanges = (run, opts) => {
    let timer = null;
    let disconnectTimer = null;
    let currentTarget = opts?.root ?? null;
    let currentInit = opts?.observerInit ?? DEFAULT_INIT;
    const disconnect = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (disconnectTimer) {
        window.clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      observer.disconnect();
    };
    const refreshDisconnectTimer = () => {
      if (disconnectTimer)
        window.clearTimeout(disconnectTimer);
      if (!opts?.disconnectAfterMs)
        return;
      disconnectTimer = window.setTimeout(() => {
        disconnect();
      }, opts.disconnectAfterMs);
    };
    const scheduleRun = () => {
      if (timer)
        window.clearTimeout(timer);
      const debounceMs = opts?.debounceMs ?? 0;
      if (debounceMs <= 0) {
        run();
        refreshDisconnectTimer();
        return;
      }
      timer = window.setTimeout(() => {
        timer = null;
        run();
        refreshDisconnectTimer();
      }, debounceMs);
    };
    const observer = new MutationObserver((mutations) => {
      if (opts?.shouldRun && !opts.shouldRun(mutations))
        return;
      scheduleRun();
    });
    const observe = (target, options) => {
      const nextTarget = target ?? currentTarget ?? document.body;
      if (!nextTarget)
        return;
      currentTarget = nextTarget;
      currentInit = options ?? currentInit;
      observer.disconnect();
      observer.observe(nextTarget, currentInit);
      refreshDisconnectTimer();
    };
    if (opts?.runImmediately)
      scheduleRun();
    return {
      disconnect,
      observe
    };
  };

  // src/lib/page-lifecycle.ts
  var runWhenReady = (fn) => {
    if (document.body) {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  };

  // src/lib/store.ts
  var LOCAL_STORAGE_ADAPTER = {
    name: "localStorage",
    readText: (key) => {
      return localStorage.getItem(key);
    },
    writeText: (key, value) => {
      localStorage.setItem(key, value);
    }
  };
  var getAdapters = (adapters) => {
    return adapters?.length ? adapters : [LOCAL_STORAGE_ADAPTER];
  };
  var reportError = (opts, error, ctx) => {
    opts?.onError?.(error, ctx);
  };
  var readRawStore = (key, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        return adapter.readText(key);
      } catch (error) {
        reportError(opts, error, {
          action: "read",
          adapterName: adapter.name,
          key
        });
      }
    }
    return null;
  };
  var readTextStore = (key, fallback, opts) => {
    const value = readRawStore(key, opts);
    return value === null ? fallback : value;
  };
  var writeTextStore = (key, value, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        adapter.writeText(key, value);
        return true;
      } catch (error) {
        reportError(opts, error, {
          action: "write",
          adapterName: adapter.name,
          key
        });
      }
    }
    return false;
  };

  // src/lib/otp-card.ts
  var STYLE_ID = "lb-otp-card-styles";
  var CARD_ID = "lb-otp-card";
  var SHORTCUT_KEY = "lb-otp-card-shortcut";
  var KEY_STYLE_KEY = "lb-otp-card-key-style";
  var SHORTCUT_LABELS = {
    mac: { chip: "⌥⇧C", name: "Option+Shift+C" },
    pc: { chip: "Alt+Shift+C", name: "Alt+Shift+C" }
  };
  var keyStyleForPlatform = (platform) => {
    if (!platform)
      return null;
    return /mac|iphone|ipad/i.test(platform) ? "mac" : "pc";
  };
  var detectKeyStyle = () => {
    const nav = navigator;
    return keyStyleForPlatform(nav.userAgentData?.platform || nav.platform || nav.userAgent);
  };
  var MAX_AGE_MS = 60 * 60 * 1000;
  var isStale = (entry) => entry.sentAt !== null && Date.now() - entry.sentAt > MAX_AGE_MS;
  var CSS = `
#${CARD_ID} {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 260px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  background: #1f1f1f;
  color: #f1f3f4;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  font: 12px/1.3 system-ui, -apple-system, sans-serif;
  cursor: pointer;
  user-select: none;
}
#${CARD_ID}[hidden] { display: none; }
#${CARD_ID}:hover { background: #2b2b2b; }
#${CARD_ID} .lb-otp-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
#${CARD_ID} .lb-otp-kbd {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid #81c995;
  border-radius: 6px;
  background: none;
  color: #81c995;
  font: 11px/1.4 system-ui, -apple-system, sans-serif;
  cursor: pointer;
}
#${CARD_ID} .lb-otp-kbd.lb-otp-kbd-off {
  border-color: #5f6368;
  color: #9aa0a6;
  text-decoration: line-through;
}
#${CARD_ID} .lb-otp-code {
  font: 600 22px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.08em;
}
#${CARD_ID} .lb-otp-meta {
  overflow: hidden;
  color: #bdc1c6;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#${CARD_ID}.lb-otp-copied .lb-otp-code { color: #81c995; }
`;
  var isShortcut = (e) => e.code === "KeyC" && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.repeat;
  var mountOtpCard = (scan) => {
    runWhenReady(() => {
      injectCSS(STYLE_ID, CSS);
      const codeEl = createElement("div", { className: "lb-otp-code" });
      const metaEl = createElement("div", { className: "lb-otp-meta" });
      const kbdEl = createElement("button", { className: "lb-otp-kbd", type: "button" });
      const card = createElement("div", { id: CARD_ID, role: "button", tabIndex: 0, hidden: true }, [
        createElement("div", { className: "lb-otp-row" }, [codeEl, kbdEl]),
        metaEl
      ]);
      document.body.appendChild(card);
      let shortcutOn = readTextStore(SHORTCUT_KEY, "on") !== "off";
      const savedStyle = keyStyleForPlatform(readTextStore(KEY_STYLE_KEY, ""));
      let keyStyle = savedStyle ?? detectKeyStyle() ?? "pc";
      const renderShortcut = () => {
        const { chip, name } = SHORTCUT_LABELS[keyStyle];
        const other = keyStyle === "mac" ? "PC" : "Mac";
        kbdEl.textContent = chip;
        kbdEl.classList.toggle("lb-otp-kbd-off", !shortcutOn);
        kbdEl.setAttribute("aria-pressed", String(shortcutOn));
        kbdEl.title = [
          shortcutOn ? `${name} copies the latest code. Click to turn off` : `${name} shortcut is off. Click to turn on`,
          `Right-click to show ${other} key names`
        ].join(`
`);
      };
      renderShortcut();
      let current = null;
      let lastKey = "";
      let resetTimer = null;
      let expiryTimer = null;
      const copy = async () => {
        if (!current)
          return;
        const ok = await copyTextWithFallback(current.code, "Copy login code");
        if (!ok)
          return;
        card.classList.add("lb-otp-copied");
        metaEl.textContent = "Copied";
        if (resetTimer)
          window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          card.classList.remove("lb-otp-copied");
          lastKey = "";
          update();
        }, 1200);
      };
      kbdEl.addEventListener("click", (e) => {
        e.stopPropagation();
        shortcutOn = !shortcutOn;
        writeTextStore(SHORTCUT_KEY, shortcutOn ? "on" : "off");
        renderShortcut();
      });
      kbdEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        keyStyle = keyStyle === "mac" ? "pc" : "mac";
        writeTextStore(KEY_STYLE_KEY, keyStyle);
        renderShortcut();
      });
      card.addEventListener("click", () => void copy());
      card.addEventListener("keydown", (e) => {
        if (e.target !== card)
          return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copy();
        }
      });
      const update = () => {
        if (card.classList.contains("lb-otp-copied"))
          return;
        const found = scan();
        const entry = found && !isStale(found) ? found : null;
        const key = entry ? `${entry.code}|${entry.sender}|${entry.time}` : "";
        if (key === lastKey)
          return;
        lastKey = key;
        current = entry;
        card.hidden = !entry;
        if (expiryTimer)
          window.clearTimeout(expiryTimer);
        expiryTimer = null;
        if (!entry)
          return;
        if (entry.sentAt !== null) {
          expiryTimer = window.setTimeout(update, entry.sentAt + MAX_AGE_MS - Date.now() + 1000);
        }
        codeEl.textContent = entry.code;
        metaEl.textContent = [entry.sender, entry.time].filter(Boolean).join(" - ");
        card.title = `${entry.message}

click to copy`;
      };
      document.addEventListener("keydown", (e) => {
        if (!shortcutOn || !current || !isShortcut(e))
          return;
        e.preventDefault();
        e.stopPropagation();
        copy();
      }, true);
      observeDomChanges(update, {
        debounceMs: 300,
        runImmediately: true,
        observerInit: { childList: true, subtree: true, characterData: true },
        shouldRun: (mutations) => mutations.some((m) => !card.contains(m.target))
      }).observe(document.body);
    });
  };

  // src/lib/otp.ts
  var KEYWORD_RE = /\b(?:code|passcode|pin|otp|one[- ]time|verif\w*|auth\w*|sign[- ]?in|log[- ]?in|security|2fa|token)\b/gi;
  var CANDIDATE_RE = /(?<![\w$.,-])(\d{3}[- ]\d{3}|\d{4,8})(?![\w%]|[.,:-]\d)/g;
  var extractOtpCode = (text) => {
    const normalized = text.replace(/\b[A-Z]-(\d{4,8})\b/g, " $1");
    const keywordIdx = [...normalized.matchAll(KEYWORD_RE)].map((m) => m.index ?? 0);
    if (!keywordIdx.length)
      return null;
    let best = null;
    for (const m of normalized.matchAll(CANDIDATE_RE)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const dist = Math.min(...keywordIdx.map((k) => k >= end ? k - end : Math.max(0, start - k)));
      if (!best || dist < best.dist)
        best = { code: m[1].replace(/[- ]/g, ""), dist };
    }
    return best?.code ?? null;
  };
  var MINUTE_MS = 60 * 1000;
  var HOUR_MS = 60 * MINUTE_MS;
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var monthIndex = (name) => MONTHS.indexOf(name.slice(0, 3));
  var to24h = (hour, meridiem) => {
    if (!meridiem)
      return hour;
    return hour % 12 + (meridiem === "pm" ? 12 : 0);
  };
  var endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  var parseMessageTime = (label, now = new Date) => {
    const s = label.trim().toLowerCase().replace(/\s+/g, " ");
    const nowMs = now.getTime();
    let m;
    m = s.match(/([a-z]+) (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2}) ?([ap]m)?/);
    if (m && monthIndex(m[1]) >= 0) {
      return new Date(Number(m[3]), monthIndex(m[1]), Number(m[2]), to24h(Number(m[4]), m[6]), Number(m[5])).getTime();
    }
    if (/^(just )?now$/.test(s))
      return nowMs;
    m = s.match(/^(\d+) ?(?:m|mins?|minutes?)\b/);
    if (m)
      return nowMs - Number(m[1]) * MINUTE_MS;
    m = s.match(/^(\d+) ?(?:h|hrs?|hours?)\b/);
    if (m)
      return nowMs - Number(m[1]) * HOUR_MS;
    m = s.match(/^(\d{1,2}):(\d{2}) ?([ap]m)?$/);
    if (m) {
      const t = new Date(now);
      t.setHours(to24h(Number(m[1]), m[3]), Number(m[2]), 0, 0);
      if (t.getTime() > nowMs + MINUTE_MS)
        t.setDate(t.getDate() - 1);
      return t.getTime();
    }
    if (s === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return endOfDay(d);
    }
    const weekday = WEEKDAYS.indexOf(s.slice(0, 3));
    if (weekday >= 0 && /^[a-z]+$/.test(s)) {
      const d = new Date(now);
      const back = (now.getDay() - weekday + 7) % 7 || 7;
      d.setDate(d.getDate() - back);
      return endOfDay(d);
    }
    m = s.match(/^([a-z]+) (\d{1,2})$/);
    if (m && monthIndex(m[1]) >= 0) {
      const d = new Date(now.getFullYear(), monthIndex(m[1]), Number(m[2]));
      if (d.getTime() > nowMs)
        d.setFullYear(d.getFullYear() - 1);
      return endOfDay(d);
    }
    return null;
  };

  // src/lib/text.ts
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/voice.google.com/voice-latest-otp.user.ts
  var sels = {
    row: "gv-message-thread-list-item",
    sender: "gv-annotation.participants",
    preview: "gv-annotation.preview",
    time: ".timestamp",
    fullTime: ".subtitle p.cdk-visually-hidden"
  };
  var clean = (text) => normalizeWhitespace(text?.replace(/[\u200e\u200f\u202a-\u202e]/g, ""));
  var scan = () => {
    for (const row of document.querySelectorAll(sels.row)) {
      const previewEl = row.querySelector(sels.preview);
      const message = clean(previewEl?.getAttribute("aria-label") || previewEl?.textContent);
      if (!message || message.startsWith("You:"))
        continue;
      const code = extractOtpCode(message);
      if (!code)
        continue;
      const time = clean(row.querySelector(sels.time)?.textContent);
      const fullTime = clean(row.querySelector(sels.fullTime)?.textContent);
      return {
        code,
        message,
        sender: clean(row.querySelector(sels.sender)?.textContent),
        time,
        sentAt: parseMessageTime(fullTime) ?? parseMessageTime(time)
      };
    }
    return null;
  };
  mountOtpCard(scan);
})();
