// ==UserScript==
// @name         Chat GPT Mods
// @namespace    https://hamidza.re
// @version      0.1.0
// @author       Hamid Zare @hamidzr
// @match        https://chat.openai.com/chat*
// @require      https://unpkg.com/turndown/dist/turndown.js
// @run-at       context-menu
// ==/UserScript==

/*
- Usage: right click on the page: Tampermonkey -> Chat GPT Mods
- Installation: follow README.md
*/

const turndownService = new TurndownService();

const selectors = {
  messages: '.lg\\3A px-0',
};

const SEPARATOR = '\n\n---\n\n';

const getMessages = () => {
  const msgs = Array.from(document.querySelectorAll(selectors.messages));
  // get the children of each msg
  return msgs.map((msg) => {
    const [_, body] = Array.from(msg.children);
    return turndownService.turndown(body);
  });
};

const copyToClipboard = (msgs) => {
  navigator.clipboard.writeText(msgs.join(SEPARATOR));
};

const msgs = getMessages();
console.log(msgs);
copyToClipboard(msgs);
window.alert('Copied to clipboard!');
