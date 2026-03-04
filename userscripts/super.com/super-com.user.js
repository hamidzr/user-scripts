// ==UserScript==
// @name                 Super.com Enhancer
// @author               Zare
// @description          map pins show total price, list cards bold total, hotel detail adds search buttons
// @grant                none
// @match                https://www.super.com/travel/*
// @namespace            hamidza.re
// @run-at               document-start
// @version              1.0.0
// ==/UserScript==

'use strict';
(() => {

  // src/super.com/super-com.user.ts
  var priceMap = {};
  var _fetch = window.fetch.bind(window);
  window.fetch = async function(...args) {
    const res = await _fetch(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    if (url.includes("/recommender/") && url.includes("/mapview")) {
      res.clone().json().then(parseMapviewResponse).catch(() => {});
    }
    return res;
  };
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    const urlStr = String(url);
    if (urlStr.includes("/recommender/") && urlStr.includes("/mapview")) {
      this.addEventListener("load", () => {
        try {
          parseMapviewResponse(JSON.parse(this.responseText));
        } catch (_e) {}
      });
    }
    return _open.apply(this, [method, url, ...rest]);
  };
  var parseMapviewResponse = (data) => {
    const results = !Array.isArray(data) ? data?.query_results ?? [] : data;
    results.forEach((item) => {
      const rate = item?.rate ?? item;
      const nightly = rate?.nightly_price_before_tax ?? rate?.nightly_rate ?? rate?.snaptravel_rate;
      const total = rate?.nightly_total_price ?? rate?.total_price ?? rate?.snaptravel_total_rate;
      if (nightly != null && total != null) {
        const key = String(Math.round(Number(nightly)));
        priceMap[key] = { total: Number(total), display: `$${Math.round(Number(total))} total` };
      }
    });
    refreshMapPins();
  };
  var superObserver = new MutationObserver((mutations) => {
    let hasNew = false;
    for (const m of mutations) {
      if (m.addedNodes.length) {
        hasNew = true;
        break;
      }
    }
    if (!hasNew)
      return;
    enhanceListCards();
    refreshMapPins();
    enhanceDetailPage();
    enhanceDetailPrices();
    compactDetailPriceCards();
    maybeInjectMapButton();
  });
  var startObserver = () => {
    superObserver.observe(document.body, { childList: true, subtree: true });
    enhanceListCards();
    refreshMapPins();
    enhanceDetailPage();
    enhanceDetailPrices();
    compactDetailPriceCards();
    maybeInjectMapButton();
  };
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver);
  }
  var mapFetched = false;
  var maybeInjectMapButton = () => {
    if (mapFetched)
      return;
    const match = location.pathname.match(/\/travel\/requests\/([^/]+)\/mapview/);
    if (!match)
      return;
    mapFetched = true;
    fetch(`/travel/recommender/requests/${match[1]}/mapview?user_properties=`).then((r) => r.ok ? r.json() : Promise.reject(r.status)).then(parseMapviewResponse).catch(() => {});
  };
  var refreshMapPins = () => {
    if (!Object.keys(priceMap).length)
      return;
    document.querySelectorAll('[data-test-id="price-tag"]').forEach((pin) => {
      if (pin.dataset.scEnhanced)
        return;
      const span = pin.querySelector("span");
      if (!span)
        return;
      const match = span.textContent?.match(/[\d,]+/);
      if (!match)
        return;
      const nightly = String(Math.round(Number(match[0].replace(",", ""))));
      const info = priceMap[nightly];
      if (!info)
        return;
      span.textContent = info.display;
      pin.dataset.scEnhanced = "1";
      pin.title = `Nightly: $${nightly} — ${info.display} incl. taxes & fees`;
    });
  };
  var enhanceListCards = () => {
    document.querySelectorAll('[data-test-id="hco-card-snaptravel-rate"]').forEach((el) => {
      if (el.dataset.scEnhanced)
        return;
      el.dataset.scEnhanced = "1";
      el.style.fontWeight = "400";
      el.style.opacity = "0.4";
    });
    document.querySelectorAll('[data-test-id="hco-card-snaptravel-total-rate"]').forEach((el) => {
      if (el.dataset.scEnhanced)
        return;
      el.dataset.scEnhanced = "1";
      const text = el.textContent ?? "";
      const match = text.match(/^(\$[\d,]+(?:\.\d+)?)\s*(.*)/s);
      if (match) {
        el.innerHTML = `<strong style="font-weight:700;color:#111;font-size:1rem;">${match[1]}</strong> <span style="opacity:0.8;">${match[2]}</span>`;
      } else {
        el.style.fontWeight = "700";
      }
      const nightlyEl = el.parentElement && el.parentElement.querySelector('[data-test-id="hco-card-snaptravel-rate"]');
      if (!nightlyEl)
        return;
      const nightlyMatch = nightlyEl.textContent?.match(/[\d,]+/);
      const totalMatch = text.match(/[\d,]+/);
      if (!nightlyMatch || !totalMatch)
        return;
      const nightly = String(Math.round(Number(nightlyMatch[0].replace(/,/g, ""))));
      const total = Math.round(Number(totalMatch[0].replace(/,/g, "")));
      priceMap[nightly] = { total, display: `$${total} total` };
      document.querySelectorAll(`[data-test-id="price-tag"][title*="Nightly: $${nightly}"]`).forEach((pin) => {
        const span = pin.querySelector("span");
        if (span)
          span.textContent = `$${total} total`;
        pin.title = `Nightly: $${nightly} — $${total} total incl. taxes & fees`;
      });
    });
  };
  var enhanceDetailPrices = () => {
    document.querySelectorAll("p, span").forEach((el) => {
      if (el.dataset.scEnhanced)
        return;
      const text = el.textContent?.trim() ?? "";
      const m = text.match(/^(\$[\d,.]+)\s+(total incl\.? taxes and fees.*)$/i);
      if (!m)
        return;
      el.dataset.scEnhanced = "1";
      el.innerHTML = `<strong style="font-weight:700;color:#111;font-size:1.05rem;">${m[1]}</strong>` + ` <span style="opacity:0.75;font-size:0.85rem;">${m[2]}</span>`;
    });
    document.querySelectorAll("h6").forEach((el) => {
      if (el.dataset.scEnhanced)
        return;
      if (!/total savings/i.test(el.textContent ?? ""))
        return;
      el.dataset.scEnhanced = "1";
      const row = el.parentElement;
      (row ?? el).style.display = "none";
    });
  };
  var compactDetailPriceCards = () => {
    document.querySelectorAll('[data-test-id="nonmember-strikethrough-price"]').forEach((strikeEl) => {
      if (strikeEl.dataset.scCompacted)
        return;
      strikeEl.dataset.scCompacted = "1";
      const nightlyDiv = strikeEl.nextElementSibling;
      const priceBlock = strikeEl.parentElement?.parentElement?.parentElement;
      if (!priceBlock)
        return;
      const toHide = [strikeEl, nightlyDiv].filter(Boolean);
      toHide.forEach((el) => el.style.display = "none");
      priceBlock.addEventListener("mouseenter", () => {
        toHide.forEach((el) => el.style.display = "");
      });
      priceBlock.addEventListener("mouseleave", () => {
        toHide.forEach((el) => el.style.display = "none");
      });
    });
  };
  var detailEnhanced = false;
  var findViewLocationRow = () => {
    const h6s = document.querySelectorAll("h6");
    for (const h6 of h6s) {
      if (h6.textContent?.trim() === "View Location") {
        return h6.closest("[class]") ?? h6.parentElement;
      }
    }
    return null;
  };
  var enhanceDetailPage = () => {
    if (detailEnhanced)
      return;
    const nameEl = document.querySelector('[data-test-id="hotel-name"]');
    if (!nameEl)
      return;
    const hotelName = nameEl.textContent?.trim() ?? "";
    let address = "";
    document.querySelectorAll('[data-disable-translation="true"]').forEach((el) => {
      const t = el.textContent?.trim() ?? "";
      if (t === hotelName)
        return;
      if (/\d/.test(t) && t.includes(",") && t.length < 120) {
        address = t;
      }
    });
    const viewLocRow = findViewLocationRow();
    if (!viewLocRow)
      return;
    detailEnhanced = true;
    const query = encodeURIComponent(`${hotelName} ${address}`.trim());
    const buttons = [
      {
        icon: "\uD83D\uDD0D",
        label: "Google",
        href: `https://www.google.com/search?q=${query}`,
        title: `Search Google: ${hotelName}`
      },
      {
        icon: "\uD83D\uDCCD",
        label: "Maps",
        href: `https://www.google.com/maps/search/${query}`,
        title: `Open in Google Maps: ${hotelName}`
      },
      {
        icon: "\uD83C\uDFE8",
        label: "Booking",
        href: `https://www.booking.com/searchresults.html?ss=${query}`,
        title: `Search Booking.com: ${hotelName}`
      },
      {
        icon: "⭐",
        label: "TripAdvisor",
        href: `https://www.tripadvisor.com/Search?q=${query}`,
        title: `Search TripAdvisor: ${hotelName}`
      }
    ];
    const bar = document.createElement("div");
    bar.dataset.scEnhanced = "1";
    Object.assign(bar.style, { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" });
    buttons.forEach(({ icon, label, href, title: btnTitle }) => {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = btnTitle;
      a.textContent = `${icon} ${label}`;
      Object.assign(a.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "20px",
        border: "1.5px solid #e0e0e0",
        background: "#fff",
        color: "#333",
        fontSize: "0.78rem",
        fontWeight: "600",
        textDecoration: "none",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        whiteSpace: "nowrap"
      });
      a.addEventListener("mouseenter", () => {
        a.style.borderColor = "#e91e8c";
        a.style.color = "#e91e8c";
        a.style.background = "#fff0f7";
      });
      a.addEventListener("mouseleave", () => {
        a.style.borderColor = "#e0e0e0";
        a.style.color = "#333";
        a.style.background = "#fff";
      });
      bar.appendChild(a);
    });
    viewLocRow.parentElement?.insertBefore(bar, viewLocRow.nextSibling);
  };
})();
