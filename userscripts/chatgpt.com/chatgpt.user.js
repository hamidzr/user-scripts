// ==UserScript==
// @name                 ChatGPT Shortcuts
// @author               AZ
// @description          map Ctrl+N and Ctrl+F to ChatGPT actions
// @grant                none
// @match                https://chatgpt.com/*
// @match                https://chat.openai.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @version              1.1.0
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
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

  // src/chatgpt.com/chatgpt.user.ts
  var getNewChatLink = () => {
    const links = Array.from(document.querySelectorAll("a"));
    return links.find((link) => {
      const text = link.textContent?.trim() ?? "";
      return text.startsWith("New chat");
    }) ?? null;
  };
  var getSearchChatsButton = () => {
    const nodes = Array.from(document.querySelectorAll("div"));
    return nodes.find((node) => {
      const text = node.textContent?.trim() ?? "";
      return text === "Search chats⌘K";
    }) ?? null;
  };
  var main = () => {
    bindCtrlNToClick(getNewChatLink);
    bindShortcutToClick(getSearchChatsButton, { key: "f", ctrlKey: true });
  };
  main();
})();
