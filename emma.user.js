// ==UserScript==
// @name         Helper to get help from Emma
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @updateURL
// @description  TODO
// @match        https://www.uscis.gov/tools/*
// @match        https://ceciva.uscis.gov/Alme/*
// @run-at document-idle
// ==/UserScript==

// 'use strict';

class Emma {
  NIT = undefined
  s = {
    agent: '.aa_agentresp',
    user: '.aa_userresp',
    old: '_old',
    textInput: '#aagent_input_box',
    sendBtn: '#aagent_ask',
  };
  s2 = {
    anyChat: `${this.s.user}, ${this.s.user + this.s.old}, ${this.s.agent}, ${this.s.agent + this.s.old}`,
  };
  _onReceive = {}

  constructor(nit) {
    this.NIT = nit;
    console.log('creating with NIT', this.NIT)
    this._readMessages();
    this._onReceive = {
      beep: msg => {
        hmd.beep();
      },
    };
  }

  allChatEls() {
    const chats = hmd.findAll(this.s2.anyChat)
    return chats;
  }

  allChats() {
    return hmd.textSelector(this.s2.anyChat)
  }

  _last(arr) {
    if (arr.length < 1) return null;
    const last = arr[arr.length-1]
    return last
  }

  lastChat() {
    return this._last(this.allChatEls())
  }

  _elText(el) {
    return el.innertText
  }

  agentMsgs() {
    return hmd.textSelector(`${this.s.agent}, ${this.s.agent + this.s.old}`)
  }

  userMsgs() {
    return hmd.textSelector(`${this.s.user}, ${this.s.user + this.s.old}`)
  }

  async _onNewMessage(msg) {
    console.log('received new message', msg);
    for (let handler of Object.values(this._onReceive)) {
      await handler.call(this, msg);
    }
  }

  registerMsgHandler(name, handler) {
    this._onReceive[name] = handler;
  }

  async _readMessages() {
    let lastMsg = '';
    let lastChatCount = 0;
    while (true) {
      const agentMsgs = this.agentMsgs()
      const text = this._last(agentMsgs)
      if (lastMsg === text && lastChatCount === agentMsgs.length) {
        await hmd.sleep(50);
        continue;
      }
      // new message
      this._onNewMessage(text);
      lastMsg = text;
      lastChatCount = agentMsgs.length
    }
  }

  async sendMessage(text) {
    console.log('messaging', text)
    this.NIT.UI.Input.setText.call(this.NIT, text);
    // add artifical wait and typing
    this.NIT.UI.Input.ask.call(this.NIT)
    await hmd.sleepUntil(() => !this.isInputDisabled(), 30000);
  }

  isInputDisabled() {
    return document.querySelector(this.s.textInput).disabled;
  }

  async fireReplies(msgList, readClipboard=false) {
    if (msgList === undefined && readClipboard) {
      const clipboard = await hmd.readClipboard()
      msgList = clipboard.split('\n');
    }
    if (!Array.isArray(msgList)) {
      msgList = msgList.split('\n');
    }
    for (let msg of msgList) {
      await hmd.sleepUntil(this.isAwaitingResponse.bind(this), 30000)
      await this.sendMessage(msg)
    }
  }

  setupCondtionalReply() {}
  simulateTyping() {}
  isAwaitingResponse() {
    const lastChat = this.lastChat();
    if (!lastChat) return false;
    return lastChat.getAttribute('class').includes('agent');
  }

  isChatReady() {}
  announceResponses() {}

  exportChat() {
    hmd.download(('uscis-chat.txt', this.allChats().join('\n')), text)
    hmd.download(('uscis-chat.agent.txt', this.agentMsgs().join('\n')), text)
    hmd.download(('uscis-chat.user.txt', this.userMsgs().join('\n')), text)
  }
}

window.hmd = hmd || {};
window.hmd.Emma = Emma;

// global NIT
const main = async () => {
  await hmd.sleepUntil(() => window.NIT !== undefined, 30000);
  window.e = new Emma(NIT);
};

// e = new hmd.Emma(NIT)
