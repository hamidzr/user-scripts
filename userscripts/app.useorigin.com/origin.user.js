// ==UserScript==
// @name         Investments: Origin holdings
// @namespace    https://investments.lbyte.app/
// @version      2
// @description  Download your Origin holdings as a file the Investments app imports
// @match        https://app.useorigin.com/*
// @grant        none
// @inject-into  page
// @sandbox      raw
// @license      MIT
// @homepageURL  https://investments.lbyte.app
// @downloadURL  https://investments.lbyte.app/userscripts/origin.user.js
// @updateURL    https://investments.lbyte.app/userscripts/origin.user.js
// ==/UserScript==

// Asks Origin's API for today's accounts and holdings with the signed-in session and writes
// them to a file. Performance history and the session token stay out of the file.
(() => {
  const API = "https://api.useorigin.com/holdings/investments";
  let button = null;

  function token() {
    const cookie = document.cookie
      .split("; ")
      .find((c) => /^CognitoIdentityServiceProvider\.[^.]+\.[^.]+\.idToken=/.test(c));
    return cookie ? decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)) : null;
  }

  async function get(path, auth) {
    const response = await fetch(`${API}/${path}`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Origin answered ${response.status}`);
    return response.json();
  }

  async function capture() {
    const auth = token();
    if (!auth) throw new Error("sign in to Origin first");
    const today = new Date().toISOString().slice(0, 10);
    const range = [
      ["start_date", today],
      ["end_date", today],
    ];
    const accounts = await get(`accounts-return?${new URLSearchParams(range)}`, auth);
    const ids = accounts.accounts_return.map((a) => a.account_id);
    if (ids.length === 0) throw new Error("no investment accounts are linked");
    const query = new URLSearchParams([
      ...ids.map((id) => ["account_id", id]),
      ...range,
      ["sort_field", "total_value"],
      ["sort_order", "desc"],
    ]);
    const holdings = await get(`holdings-return?${query}`, auth);
    for (const h of holdings.holdings) {
      delete h.performance_history;
      const price = h.security?.statistics?.share_price;
      if (h.security) h.security.statistics = price == null ? null : { share_price: price };
    }
    return {
      format: "origin-capture",
      version: 1,
      capturedAt: new Date().toISOString(),
      generator: "investments origin userscript 1",
      accounts,
      holdings,
    };
  }

  async function download() {
    button.disabled = true;
    button.textContent = "Fetching holdings...";
    try {
      const file = await capture();
      const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `origin-holdings-${file.capturedAt.slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      button.textContent = `Downloaded ${file.holdings.holdings.length} holdings`;
    } catch (error) {
      button.textContent = `Investments: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  }

  function mount() {
    button = document.createElement("button");
    button.type = "button";
    button.textContent = "Download holdings for Investments";
    button.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer";
    button.addEventListener("click", () => void download());
    document.body.append(button);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
