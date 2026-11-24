// ==UserScript==
// @name         Investments: Monarch accounts
// @namespace    https://investments.lbyte.app/
// @version      3
// @description  Download your Monarch account list, with each account's institution, for the Investments app
// @match        https://app.monarch.com/*
// @match        https://app.monarchmoney.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @sandbox      raw
// @license      MIT
// @homepageURL  https://investments.lbyte.app
// @downloadURL  https://investments.lbyte.app/userscripts/monarch-accounts.user.js
// @updateURL    https://investments.lbyte.app/userscripts/monarch-accounts.user.js
// ==/UserScript==

// Asks Monarch for the account list the app shows, with the institution each account belongs to, and
// saves it as JSON. It uses the page's own signed-in session, sending the csrftoken cookie and the
// device id Monarch keeps in localStorage as its own requests do, and the file it saves holds no
// credentials.
(() => {
  const QUERY = `query { accounts {
    displayName mask isHidden deactivatedAt
    type { name } subtype { name } institution { name }
  } }`;

  const csrf = () => (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/) || [])[1] || "";

  async function download(button) {
    button.disabled = true;
    button.textContent = "Investments: reading accounts...";
    try {
      const response = await fetch("https://api.monarch.com/graphql", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "client-platform": "web",
          "x-csrftoken": csrf(),
          "device-uuid": localStorage.getItem("monarchDeviceUUID") || "",
        },
        body: JSON.stringify({ query: QUERY }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status !== 200 || body.errors || !body.data)
        throw new Error((body.errors || []).map((e) => e.message).join("; ") || response.status);
      const link = document.createElement("a");
      const blob = new Blob([JSON.stringify(body.data)], { type: "application/json" });
      link.href = URL.createObjectURL(blob);
      link.download = `monarch-accounts-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      button.textContent = "Investments: downloaded";
    } catch (error) {
      button.textContent = "Investments: could not read accounts";
      button.title = String(error && error.message ? error.message : error).slice(0, 200);
    } finally {
      button.disabled = false;
    }
  }

  function mount() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Download accounts for Investments";
    button.style.cssText =
      "position:fixed;right:16px;bottom:64px;z-index:2147483647;padding:8px 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer";
    button.addEventListener("click", () => download(button));
    document.body.append(button);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
