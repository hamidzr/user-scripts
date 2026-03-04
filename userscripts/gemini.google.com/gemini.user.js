// ==UserScript==
// @name                 Gemini Auto-focus
// @author               Zare
// @description          focus the rich text editor when the window regains focus
// @grant                none
// @match                https://gemini.google.com/*
// @namespace            hamidza.re
// @run-at               document-idle
// @version              1.1.0
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

  // src/gemini.google.com/gemini.user.ts
  var EDITOR_SEL = 'div.ql-editor[contenteditable="true"]';
  var focusEditor = () => {
    const editor = document.querySelector(EDITOR_SEL);
    if (!editor || document.activeElement === editor)
      return;
    focusEnd(editor);
  };
  window.addEventListener("focus", focusEditor);
  var main = () => {
    focusEditor();
  };
  main();
})();
