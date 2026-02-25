// ==UserScript==
// @name         Rocket Money Paywall Remover (Selective)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Remove only the premium upgrade paywall modal and blur from Rocket Money dashboard while keeping legitimate modals
// @author       You
// @match        https://app.rocketmoney.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // Function to check if a dialog is the paywall modal
  function isPaywallModal(element) {
    if (!element) return false;

    const text = element.textContent || "";

    // Identify paywall modal by its unique content
    return (
      text.includes("Upgrade to unlock Rocket Money for desktop") ||
      text.includes("Pay what you think is fair") ||
      (text.includes("With premium you get") &&
        text.includes("Start Free Trial"))
    );
  }

  // Function to remove only the paywall modal
  function removePaywallModal() {
    // Check all dialogs
    const dialogs = document.querySelectorAll("dialog");
    dialogs.forEach((dialog) => {
      if (isPaywallModal(dialog)) {
        dialog.remove();
      }
    });

    // Check role-based dialogs
    const roleDialogs = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"]',
    );
    roleDialogs.forEach((dialog) => {
      if (isPaywallModal(dialog)) {
        dialog.remove();
      }
    });

    // Remove blur from all elements
    const allElements = document.querySelectorAll("*");
    allElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.filter && style.filter.includes("blur")) {
        el.style.filter = "none";
      }
    });

    // Re-enable body scroll
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
  }

  // Function to inject CSS that only blocks paywall modal
  function injectCSS() {
    if (document.getElementById("paywall-remover-style")) return;

    const style = document.createElement("style");
    style.id = "paywall-remover-style";
    style.textContent = `
            /* Remove all blur filters */
            * {
                filter: none !important;
                backdrop-filter: none !important;
            }

            /* Ensure body is scrollable */
            body {
                overflow: auto !important;
                height: auto !important;
            }
        `;
    document.head.appendChild(style);
  }

  // Run immediately when DOM starts loading
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      injectCSS();
      removePaywallModal();
    });
  } else {
    injectCSS();
    removePaywallModal();
  }

  // Inject CSS as early as possible
  injectCSS();

  // Watch for dynamically added modals and remove only paywall ones
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          // Element node
          // Check if it's a paywall dialog
          if (node.tagName === "DIALOG" && isPaywallModal(node)) {
            node.remove();
          }
          // Check if it has blur
          if (
            node.style &&
            node.style.filter &&
            node.style.filter.includes("blur")
          ) {
            node.style.filter = "none";
          }
          // Check for paywall in newly added role-based dialogs
          if (
            node.getAttribute &&
            (node.getAttribute("role") === "dialog" ||
              node.getAttribute("role") === "alertdialog") &&
            isPaywallModal(node)
          ) {
            node.remove();
          }
          // Check children for dialogs
          if (node.querySelectorAll) {
            const childDialogs = node.querySelectorAll(
              'dialog, [role="dialog"], [role="alertdialog"]',
            );
            childDialogs.forEach((dialog) => {
              if (isPaywallModal(dialog)) {
                dialog.remove();
              }
            });
          }
        }
      });
    });
  });

  // Start observing when document is ready
  window.addEventListener("load", function () {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });

  // Run removal periodically for the first few seconds (in case of late-loading paywall)
  let attempts = 0;
  const intervalId = setInterval(function () {
    removePaywallModal();
    attempts++;
    if (attempts >= 10) {
      // Run 10 times over 5 seconds
      clearInterval(intervalId);
    }
  }, 500);
})();
