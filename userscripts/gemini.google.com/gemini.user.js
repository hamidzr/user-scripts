// ==UserScript==
// @name                 Gemini Auto-focus
// @author               AZ
// @description          focus the editor and map Ctrl+N / Ctrl+F to Gemini actions
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @grant                none
// @match                https://gemini.google.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/gemini.google.com/gemini.user.js
// @version              1.2.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
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

  // src/gemini.google.com/gemini.user.ts
  var EDITOR_SEL = 'div.ql-editor[contenteditable="true"]';
  var NEW_CHAT_SEL = 'a[aria-label="New chat"]';
  var SEARCH_SEL = 'button[aria-label="Search"]';
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
  window.addEventListener("focus", focusEditor);
  bindCtrlNToClick(getNewChatLink);
  bindShortcutToClick(getSearchButton, { key: "f", ctrlKey: true });
  var main = () => {
    focusEditor();
  };
  main();
})();
