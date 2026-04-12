// ==UserScript==
// @name                 Gemini Auto-focus
// @author               AZ
// @description          focus the editor, default to Pro model, and map Ctrl+N / Ctrl+F to Gemini actions
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @grant                none
// @match                https://gemini.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @version              1.4.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var waitForEl = (selector, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el)
        return resolve(el);
      const endTime = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        const el2 = document.querySelector(selector);
        if (el2) {
          observer.disconnect();
          resolve(el2);
        } else if (Date.now() > endTime) {
          observer.disconnect();
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el2 = document.querySelector(selector);
        if (el2)
          resolve(el2);
        else
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };
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
  var focusEnd = (el) => {
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };
  var simClick = (el) => {
    el.click();
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  var bindShortcutToClick = (getTarget, opts) => {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.repeat)
        return;
      if ((event.ctrlKey ?? false) !== (opts.ctrlKey ?? false))
        return;
      if ((event.metaKey ?? false) !== (opts.metaKey ?? false))
        return;
      if ((event.altKey ?? false) !== (opts.altKey ?? false))
        return;
      if ((event.shiftKey ?? false) !== (opts.shiftKey ?? false))
        return;
      if (event.key.toLowerCase() !== opts.key.toLowerCase())
        return;
      const target = getTarget();
      if (!target)
        return;
      event.preventDefault();
      event.stopPropagation();
      simClick(target);
    }, true);
  };
  var bindCtrlNToClick = (getTarget) => {
    bindShortcutToClick(getTarget, { key: "n", ctrlKey: true });
  };

  // src/lib/page-lifecycle.ts
  var KEY = "__lbLocationChangeController__";
  var scheduleListener = (listener) => {
    const nextHref = window.location.href;
    if (nextHref === listener.lastHref)
      return;
    listener.lastHref = nextHref;
    if (listener.timer)
      window.clearTimeout(listener.timer);
    if (listener.debounceMs <= 0) {
      listener.callback();
      return;
    }
    listener.timer = window.setTimeout(() => {
      listener.timer = null;
      listener.callback();
    }, listener.debounceMs);
  };
  var ensureController = () => {
    const existing = window[KEY];
    if (existing)
      return existing;
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    const controller = {
      listeners: new Set,
      pushState,
      replaceState,
      notify: () => {
        controller.listeners.forEach((listener) => {
          scheduleListener(listener);
        });
      },
      restore: () => {
        history.pushState = pushState;
        history.replaceState = replaceState;
        window.removeEventListener("popstate", controller.onPopState);
        if ("navigation" in window) {
          window.navigation.removeEventListener("navigatesuccess", controller.onPopState);
        }
        delete window[KEY];
      },
      onPopState: () => {
        controller.notify();
      }
    };
    history.pushState = (...args) => {
      pushState(...args);
      controller.notify();
    };
    history.replaceState = (...args) => {
      replaceState(...args);
      controller.notify();
    };
    window.addEventListener("popstate", controller.onPopState);
    if ("navigation" in window) {
      window.navigation.addEventListener("navigatesuccess", controller.onPopState);
    }
    window[KEY] = controller;
    return controller;
  };
  var watchLocationChange = (callback, opts) => {
    const controller = ensureController();
    const listener = {
      callback,
      debounceMs: opts?.debounceMs ?? 0,
      lastHref: window.location.href,
      timer: null
    };
    controller.listeners.add(listener);
    return () => {
      if (listener.timer)
        window.clearTimeout(listener.timer);
      controller.listeners.delete(listener);
      if (controller.listeners.size === 0)
        controller.restore();
    };
  };

  // src/gemini.google.com/gemini.user.ts
  var EDITOR_SEL = 'div.ql-editor[contenteditable="true"]';
  var NEW_CHAT_SEL = 'a[aria-label="New chat"]';
  var SEARCH_SEL = 'button[aria-label="Search"]';
  var MODE_BTN_SEL = 'button[data-test-id="bard-mode-menu-button"]';
  var PRO_OPTION_SEL = '[data-test-id="bard-mode-option-pro"]';
  var focusEditor = () => {
    const editor = document.querySelector(EDITOR_SEL);
    if (!editor || document.activeElement === editor)
      return;
    focusEnd(editor);
  };
  var getNewChatLink = () => {
    return document.querySelector(NEW_CHAT_SEL);
  };
  var getSearchButton = () => {
    return document.querySelector(SEARCH_SEL);
  };
  var isNewChat = () => {
    const path = window.location.pathname;
    return path === "/app" || path === "/app/" || path === "/";
  };
  var selectProModel = async () => {
    if (!isNewChat())
      return;
    try {
      const modeBtn = await pollUntil(() => {
        const btn = document.querySelector(MODE_BTN_SEL);
        return btn?.textContent?.trim() ? btn : null;
      }, 5000);
      const current = modeBtn.textContent?.trim();
      if (current === "Pro")
        return;
      const editor = document.querySelector(EDITOR_SEL);
      const savedHTML = editor?.innerHTML ?? "";
      const hadFocus = document.activeElement === editor;
      modeBtn.click();
      const proOption = await waitForEl(PRO_OPTION_SEL, 3000);
      proOption.click();
      if (editor && savedHTML) {
        requestAnimationFrame(() => {
          if (!editor.textContent?.trim()) {
            editor.innerHTML = savedHTML;
          }
          if (hadFocus)
            focusEnd(editor);
        });
      }
    } catch {}
  };
  window.addEventListener("focus", focusEditor);
  bindCtrlNToClick(getNewChatLink);
  bindShortcutToClick(getSearchButton, { key: "f", ctrlKey: true });
  watchLocationChange(() => selectProModel(), { debounceMs: 300 });
  var main = () => {
    focusEditor();
    selectProModel();
  };
  main();
})();
