// ==UserScript==
// @name                 Gemini Auto-focus
// @author               AZ
// @description          focus the editor, default to the 4 Argon model with Medium thinking, and map Ctrl+N / Ctrl+F to Gemini actions
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @grant                GM_getValue
// @grant                GM_setValue
// @grant                GM_registerMenuCommand
// @match                https://gemini.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @version              1.6.1
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
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        } else if (Date.now() > endTime) {
          observer.disconnect();
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el)
          resolve(el);
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
  var MODEL_OPTION_SEL = '[data-test-id^="bard-mode-option-"]';
  var THINKING_ITEM_SEL = 'gem-menu-item[value="thinking_level"]';
  var KEY_ENABLED = "autoSwitchEnabled";
  var KEY_PATTERN = "modelPattern";
  var DEFAULT_PATTERN = "Argon";
  var THINKING_LEVEL = "Medium";
  var PICKER_TIMEOUT_MS = 180000;
  var isAutoSwitchEnabled = () => GM_getValue(KEY_ENABLED, "1") !== "0";
  var getModelPattern = () => GM_getValue(KEY_PATTERN, DEFAULT_PATTERN);
  var registerMenuCommands = () => {
    const updateToggleLabel = () => {
      const on = isAutoSwitchEnabled();
      GM_registerMenuCommand(`Auto-switch model: ${on ? "ON (click to disable)" : "OFF (click to enable)"}`, () => {
        GM_setValue(KEY_ENABLED, on ? "0" : "1");
        registerMenuCommands();
        if (!on)
          selectModel();
      });
    };
    updateToggleLabel();
    GM_registerMenuCommand("Set model pattern (regex)...", () => {
      const current = getModelPattern();
      const input = prompt("Model name regex (e.g. Argon, Pro, Flash):", current);
      if (input === null)
        return;
      const trimmed = input.trim();
      if (!trimmed)
        return;
      try {
        new RegExp(trimmed);
      } catch {
        alert(`Invalid regex: ${trimmed}`);
        return;
      }
      GM_setValue(KEY_PATTERN, trimmed);
      selectModel();
    });
  };
  var findModelOption = (pattern) => {
    const opts = document.querySelectorAll(MODEL_OPTION_SEL);
    for (const opt of opts) {
      if (pattern.test(opt.textContent?.trim() ?? ""))
        return opt;
    }
    return null;
  };
  var findThinkingOption = (level) => {
    const id = document.querySelector(THINKING_ITEM_SEL)?.getAttribute("aria-controls");
    const submenu = id ? document.getElementById(id) : null;
    if (!submenu)
      return null;
    const items = submenu.querySelectorAll("gem-menu-item");
    for (const item of items) {
      if (item.querySelector(".label")?.textContent?.trim() === level)
        return item;
    }
    return null;
  };
  var hasThinkingLevel = (modeBtn, level) => (modeBtn.getAttribute("aria-label") ?? "").trim().endsWith(` ${level}`);
  var isMenuOpen = (modeBtn) => modeBtn.getAttribute("aria-expanded") === "true";
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
  var running = false;
  var selectThinkingLevel = async (modeBtn) => {
    await pollUntil(() => isMenuOpen(modeBtn) ? null : true, 2000);
    modeBtn.click();
    const option = await pollUntil(() => findThinkingOption(THINKING_LEVEL), 3000);
    if (option.classList.contains("selected"))
      modeBtn.click();
    else
      option.click();
  };
  var selectModel = async () => {
    if (!isNewChat() || running)
      return;
    running = true;
    const autoSwitch = isAutoSwitchEnabled();
    const pattern = (() => {
      try {
        return new RegExp(getModelPattern(), "i");
      } catch {
        return /Argon/i;
      }
    })();
    let modeBtn = null;
    try {
      await waitForEl(MODE_BTN_SEL, PICKER_TIMEOUT_MS);
      modeBtn = await pollUntil(() => {
        const btn = document.querySelector(MODE_BTN_SEL);
        return btn?.textContent?.trim() ? btn : null;
      }, 5000);
      if (!isNewChat())
        return;
      const needsModel = autoSwitch && !pattern.test(modeBtn.textContent?.trim() ?? "");
      const needsThinking = !hasThinkingLevel(modeBtn, THINKING_LEVEL);
      if (!needsModel && !needsThinking)
        return;
      const editor = document.querySelector(EDITOR_SEL);
      const savedHTML = editor?.innerHTML ?? "";
      const hadFocus = document.activeElement === editor;
      if (needsModel) {
        modeBtn.click();
        const targetOption = await pollUntil(() => findModelOption(pattern), 3000);
        targetOption.click();
      }
      if (needsThinking)
        await selectThinkingLevel(modeBtn);
      if (editor && (savedHTML || hadFocus)) {
        requestAnimationFrame(() => {
          if (savedHTML && !editor.textContent?.trim()) {
            editor.innerHTML = savedHTML;
          }
          if (hadFocus)
            focusEnd(editor);
        });
      }
    } catch {
      if (modeBtn && isMenuOpen(modeBtn))
        modeBtn.click();
    } finally {
      running = false;
    }
  };
  registerMenuCommands();
  window.addEventListener("focus", focusEditor);
  bindCtrlNToClick(getNewChatLink);
  bindShortcutToClick(getSearchButton, { key: "f", ctrlKey: true });
  watchLocationChange(() => selectModel(), { debounceMs: 300 });
  var main = () => {
    focusEditor();
    selectModel();
  };
  main();
})();
