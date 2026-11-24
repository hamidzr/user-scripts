// ==UserScript==
// @name         Investments: Monarch holdings
// @namespace    https://investments.lbyte.app/
// @version      2
// @description  Download your Monarch holdings as a file the Investments app imports
// @match        https://app.monarch.com/*
// @match        https://app.monarchmoney.com/*
// @run-at       document-start
// @grant        none
// @inject-into  page
// @sandbox      raw
// @license      MIT
// @homepageURL  https://investments.lbyte.app
// @downloadURL  https://investments.lbyte.app/userscripts/monarch.user.js
// @updateURL    https://investments.lbyte.app/userscripts/monarch.user.js
// ==/UserScript==

// Watches the two GraphQL responses the holdings page loads and writes them as a small HAR,
// which the Import page reads like a browser capture. No headers, cookies, or other traffic.
(() => {
  const OPERATIONS = ["Web_GetPortfolio", "Web_GetInvestmentsAccounts"];
  const captured = new Map();
  let button = null;

  const operationOf = (body) => {
    if (typeof body !== "string") return null;
    try {
      const name = JSON.parse(body).operationName;
      return OPERATIONS.includes(name) ? name : null;
    } catch {
      return null;
    }
  };

  const original = window.fetch;
  window.fetch = async function (input, init) {
    const response = await original.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : (input.url ?? String(input));
      const body = init?.body ?? null;
      const operation = url.includes("graphql") && operationOf(body);
      if (operation && response.ok && !captured.has(operation)) {
        const text = await response.clone().text();
        if (JSON.parse(text).data) {
          captured.set(operation, { url, body, text });
          update();
        }
      }
    } catch {
      // never break the page's own request
    }
    return response;
  };

  function update() {
    if (!button) return;
    const ready = captured.has("Web_GetPortfolio");
    button.disabled = !ready;
    button.textContent = ready
      ? "Download holdings for Investments"
      : "Investments: open Holdings to capture";
  }

  function download() {
    const entries = [...captured.values()].map(({ url, body, text }) => ({
      request: { method: "POST", url, postData: { mimeType: "application/json", text: body } },
      response: { status: 200, content: { mimeType: "application/json", text } },
    }));
    const har = {
      log: {
        version: "1.2",
        creator: { name: "investments-monarch-userscript", version: "1" },
        entries,
      },
    };
    const blob = new Blob([JSON.stringify(har)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `monarch-holdings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function mount() {
    button = document.createElement("button");
    button.type = "button";
    button.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer";
    button.addEventListener("click", download);
    document.body.append(button);
    update();
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
