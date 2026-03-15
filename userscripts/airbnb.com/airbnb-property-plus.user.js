// ==UserScript==
// @name                 Airbnb Property Plus
// @author               AZ
// @description          Adds quick actions, message templates, and pricing helpers on Airbnb listing pages
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/airbnb.com/airbnb-property-plus.user.js
// @grant                none
// @match                https://www.airbnb.com/rooms/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/airbnb.com/airbnb-property-plus.user.js
// @version              0.5.1
// ==/UserScript==

'use strict';
(() => {

  // src/lib/dom.ts
  var injectCSS = (id, css) => {
    let style = document.getElementById(id);
    if (style) {
      style.textContent = css;
      return style;
    }
    style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  };

  // src/airbnb.com/airbnb-property-plus.user.ts
  var STYLE_ID = "ab-property-plus-style";
  var QUICK_ACTIONS_ID = "ab-property-plus-actions";
  var QUICK_ACTIONS_HANDLE_ID = "ab-property-plus-actions-handle";
  var MAP_PANEL_ID = "ab-property-plus-map-panel";
  var MAP_PANEL_HANDLE_ID = "ab-property-plus-map-handle";
  var TEMPLATE_BAR_ID = "ab-property-plus-templates";
  var TEMPLATE_EDITOR_ID = "ab-property-plus-template-editor";
  var NIGHTLY_INLINE_ID = "ab-property-plus-nightly-inline";
  var REVIEWS_COPY_BTN_ID = "ab-property-plus-copy-reviews";
  var TEMPLATES_KEY = "ab-property-plus-message-templates-v1";
  var FLOATING_POS_KEY = "ab-property-plus-floating-pos-v1";
  var DEFAULT_TEMPLATES = [
    {
      id: "internet-details",
      name: "Internet speed and type",
      body: "Could you share recent internet speed test results, if you have them? Also, do you know whether the connection is fiber, cable, DSL, cellular, or another type?"
    }
  ];
  var CSS = `
  #${QUICK_ACTIONS_ID} {
    position: fixed;
    top: 88px;
    right: 20px;
    z-index: 9999;
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(34, 34, 34, 0.12);
    border-radius: 999px;
    padding: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(6px);
  }

  #${QUICK_ACTIONS_ID}.is-dragging,
  #${MAP_PANEL_ID}.is-dragging {
    cursor: grabbing;
    user-select: none;
  }

  #${QUICK_ACTIONS_ID} .ab-property-plus-drag-handle,
  #${MAP_PANEL_ID} .ab-property-plus-drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    min-width: 34px;
    height: 34px;
    border: 1px dashed rgba(34, 34, 34, 0.18);
    border-radius: 999px;
    background: #fff;
    color: #6b6b6b;
    font-size: 15px;
    line-height: 1;
    cursor: grab;
  }

  #${QUICK_ACTIONS_ID} button {
    border: 1px solid rgba(34, 34, 34, 0.2);
    border-radius: 999px;
    background: #fff;
    color: #222;
    font-size: 13px;
    font-weight: 700;
    padding: 8px 12px;
    cursor: pointer;
  }

  #${QUICK_ACTIONS_ID} button:hover {
    background: #f7f7f7;
  }

  #${QUICK_ACTIONS_ID} button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  #${MAP_PANEL_ID} {
    position: fixed;
    top: 140px;
    right: 20px;
    z-index: 9998;
    width: min(360px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.97);
    border: 1px solid rgba(34, 34, 34, 0.12);
    border-radius: 20px;
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.16);
    backdrop-filter: blur(6px);
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-topbar {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-heading {
    min-width: 0;
    flex: 1;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #717171;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-label {
    margin-top: 2px;
    font-size: 14px;
    font-weight: 700;
    color: #222;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-actions button,
  #${MAP_PANEL_ID} .ab-property-plus-map-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    border: 1px solid rgba(34, 34, 34, 0.14);
    border-radius: 999px;
    background: #fff;
    color: #222;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    padding: 0 12px;
    cursor: pointer;
  }

  #${MAP_PANEL_ID} iframe {
    width: 100%;
    height: 240px;
    border: 0;
    border-radius: 14px;
    background: #f1f1f1;
  }

  #${MAP_PANEL_ID} .ab-property-plus-map-meta {
    font-size: 12px;
    color: #6b6b6b;
  }

  #${TEMPLATE_BAR_ID} {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
    padding: 10px;
    width: 100%;
    max-width: 640px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #ebebeb;
    font-size: 13px;
  }

  #${TEMPLATE_BAR_ID} select,
  #${TEMPLATE_BAR_ID} button {
    height: 32px;
    border: 1px solid #d6d6d6;
    border-radius: 8px;
    background: #fff;
    font-size: 12px;
    padding: 0 10px;
  }

  #${TEMPLATE_BAR_ID} button {
    cursor: pointer;
    font-weight: 600;
  }

  #${TEMPLATE_EDITOR_ID} {
    width: 100%;
    display: none;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid #e3e3e3;
  }

  #${TEMPLATE_EDITOR_ID}.is-open {
    display: flex;
  }

  #${TEMPLATE_EDITOR_ID} input,
  #${TEMPLATE_EDITOR_ID} textarea {
    width: 100%;
    border: 1px solid #d6d6d6;
    border-radius: 8px;
    background: #fff;
    padding: 8px 10px;
    font-size: 12px;
    font-family: inherit;
  }

  #${TEMPLATE_EDITOR_ID} textarea {
    min-height: 82px;
    resize: vertical;
  }

  #${TEMPLATE_EDITOR_ID} .ab-property-plus-editor-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  #${NIGHTLY_INLINE_ID} {
    margin-left: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #6a1b9a;
  }

  #${REVIEWS_COPY_BTN_ID} {
    position: sticky;
    top: 10px;
    margin-left: auto;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(34, 34, 34, 0.18);
    border-radius: 999px;
    background: #fff;
    color: #222;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    padding: 10px 14px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  }

  #${REVIEWS_COPY_BTN_ID}:disabled {
    opacity: 0.6;
    cursor: default;
  }

  @media (min-width: 1320px) {
    [data-plugin-in-point-id='PDP_CONTENT'],
    [data-testid='pdp-main-content'],
    main[data-testid='pdp-main'] {
      width: min(96vw, 1560px) !important;
      max-width: min(96vw, 1560px) !important;
      margin-inline: auto !important;
    }
  }

  @media (max-width: 1000px) {
    #${QUICK_ACTIONS_ID} {
      right: 12px;
      left: 12px;
      top: auto;
      bottom: 12px;
      justify-content: center;
      border-radius: 16px;
    }

    #${MAP_PANEL_ID} {
      right: 12px;
      left: 12px;
      top: auto;
      bottom: 84px;
      width: auto;
    }

    #${TEMPLATE_BAR_ID} { max-width: 100%; }
  }
`;
  var isVisible = (el) => {
    if (!el.isConnected)
      return false;
    if (el.offsetParent !== null)
      return true;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  var qText = (el) => {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
  };
  var escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };
  var qInnerLines = (el) => {
    const raw = (el.innerText || qText(el)).split(/\n+/g);
    const seen = new Set;
    const lines = [];
    for (const chunk of raw) {
      const line = chunk.replace(/\s+/g, " ").trim();
      if (!line || seen.has(line))
        continue;
      seen.add(line);
      lines.push(line);
    }
    return lines;
  };
  var sleep = (ms) => {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  };
  var loadFloatingPositions = () => {
    try {
      const raw = localStorage.getItem(FLOATING_POS_KEY);
      if (!raw)
        return {};
      return JSON.parse(raw);
    } catch (_e) {
      return {};
    }
  };
  var saveFloatingPosition = (key, value) => {
    try {
      const next = loadFloatingPositions();
      next[key] = value;
      localStorage.setItem(FLOATING_POS_KEY, JSON.stringify(next));
    } catch (_e) {}
  };
  var clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };
  var applySavedFloatingPosition = (key, el) => {
    const saved = loadFloatingPositions()[key];
    if (!saved)
      return;
    const maxLeft = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    el.style.left = `${clamp(saved.left, 8, maxLeft)}px`;
    el.style.top = `${clamp(saved.top, 8, maxTop)}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  };
  var makeFloatingDraggable = (key, el, handle) => {
    if (!handle || handle.dataset.dragBound === "true") {
      applySavedFloatingPosition(key, el);
      return;
    }
    handle.dataset.dragBound = "true";
    applySavedFloatingPosition(key, el);
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0)
        return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      el.classList.add("is-dragging");
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_e) {}
      const onMove = (moveEvent) => {
        const nextLeft = clamp(moveEvent.clientX - offsetX, 8, window.innerWidth - rect.width - 8);
        const nextTop = clamp(moveEvent.clientY - offsetY, 8, window.innerHeight - rect.height - 8);
        el.style.left = `${nextLeft}px`;
        el.style.top = `${nextTop}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
      };
      const finish = () => {
        el.classList.remove("is-dragging");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        const current = el.getBoundingClientRect();
        saveFloatingPosition(key, {
          top: current.top,
          left: current.left,
          right: null,
          bottom: null
        });
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });
  };
  var triggerClick = (el) => {
    try {
      el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    } catch (_e) {}
    el.focus();
    el.click();
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  var findClickableByText = (pattern) => {
    const selectors = 'button, a, [role="button"]';
    const candidates = Array.from(document.querySelectorAll(selectors));
    for (const candidate of candidates) {
      if (candidate.closest(`#${QUICK_ACTIONS_ID}`))
        continue;
      if (!isVisible(candidate))
        continue;
      const combined = [
        qText(candidate),
        candidate.getAttribute("aria-label") ?? "",
        candidate.getAttribute("title") ?? ""
      ].join(" ").trim();
      if (pattern.test(combined))
        return candidate;
    }
    return null;
  };
  var cachedListingMapPath = "";
  var cachedListingMapData = null;
  var extractJsonScriptValue = (text, key) => {
    const pattern = new RegExp(`"${escapeRegExp(key)}":"([^"]+)"`);
    return text.match(pattern)?.[1] ?? null;
  };
  var getGoogleMapsUrl = (mapData) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapData.lat},${mapData.lng}`)}`;
  };
  var getGoogleEmbedUrl = (mapData) => {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${mapData.lat},${mapData.lng}`)}&z=14&output=embed`;
  };
  var parseListingMapData = () => {
    const scripts = Array.from(document.querySelectorAll("script"));
    let fallback = null;
    for (const script of scripts) {
      const text = script.textContent ?? "";
      if (!text)
        continue;
      const isLocationSection = /"pluginPointId":"LOCATION_DEFAULT"/.test(text) || /"title":"Where you’ll be"/.test(text) || /"title":"Where you'll be"/.test(text);
      const latLngMatch = text.match(/"lat":(-?\d+(?:\.\d+)?),"lng":(-?\d+(?:\.\d+)?)/);
      if (latLngMatch && isLocationSection) {
        const lat = Number.parseFloat(latLngMatch[1]);
        const lng = Number.parseFloat(latLngMatch[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
          continue;
        const label = extractJsonScriptValue(text, "subtitle") || extractJsonScriptValue(text, "title") || "Listing location";
        const markerType = extractJsonScriptValue(text, "mapMarkerType");
        return {
          lat,
          lng,
          label,
          isApproximate: markerType === "APPROX"
        };
      }
      if (!fallback && latLngMatch) {
        const lat = Number.parseFloat(latLngMatch[1]);
        const lng = Number.parseFloat(latLngMatch[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
          continue;
        const label = extractJsonScriptValue(text, "subtitle") || extractJsonScriptValue(text, "title") || "Listing location";
        const markerType = extractJsonScriptValue(text, "mapMarkerType");
        fallback = {
          lat,
          lng,
          label,
          isApproximate: markerType !== "EXACT"
        };
      }
      const schemaMatch = text.match(/"latitude":(-?\d+(?:\.\d+)?),"longitude":(-?\d+(?:\.\d+)?)/);
      if (!fallback && schemaMatch) {
        const lat = Number.parseFloat(schemaMatch[1]);
        const lng = Number.parseFloat(schemaMatch[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
          continue;
        const locality = text.match(/"addressLocality":"([^"]+)"/)?.[1] || "Listing location";
        fallback = {
          lat,
          lng,
          label: locality,
          isApproximate: true
        };
      }
    }
    return fallback;
  };
  var getListingMapData = () => {
    const key = `${window.location.pathname}${window.location.search}`;
    if (cachedListingMapPath === key)
      return cachedListingMapData;
    cachedListingMapPath = key;
    cachedListingMapData = parseListingMapData();
    return cachedListingMapData;
  };
  var ensureQuickActions = () => {
    let actions = document.getElementById(QUICK_ACTIONS_ID);
    if (!actions) {
      actions = document.createElement("div");
      actions.id = QUICK_ACTIONS_ID;
      actions.innerHTML = `<button id="${QUICK_ACTIONS_HANDLE_ID}" class="ab-property-plus-drag-handle" type="button" aria-label="Move quick actions" title="Move quick actions">::</button>` + '<button data-action="map">Open map</button>' + '<button data-action="message">Message host</button>' + '<button data-action="reviews">Show all reviews</button>' + '<button data-action="reviews-search">Search reviews</button>' + '<button data-action="reviews-copy">Copy reviews</button>';
      document.body.appendChild(actions);
    }
    const mapBtn = actions.querySelector('button[data-action="map"]');
    const handle = actions.querySelector(`#${QUICK_ACTIONS_HANDLE_ID}`);
    const messageBtn = actions.querySelector('button[data-action="message"]');
    const reviewsBtn = actions.querySelector('button[data-action="reviews"]');
    const reviewsSearchBtn = actions.querySelector('button[data-action="reviews-search"]');
    const reviewsCopyBtn = actions.querySelector('button[data-action="reviews-copy"]');
    if (!mapBtn || !messageBtn || !reviewsBtn || !reviewsSearchBtn || !reviewsCopyBtn)
      return;
    makeFloatingDraggable("actions", actions, handle);
    const mapData = getListingMapData();
    mapBtn.disabled = !mapData;
    messageBtn.disabled = false;
    reviewsBtn.disabled = false;
    mapBtn.onclick = () => {
      const current = getListingMapData();
      if (!current)
        return;
      window.open(getGoogleMapsUrl(current), "_blank", "noopener,noreferrer");
    };
    messageBtn.onclick = () => {
      const target = findClickableByText(/^(message|contact)\s+host/i);
      if (target)
        triggerClick(target);
    };
    reviewsBtn.onclick = () => {
      const target = findClickableByText(/show\s+all.*reviews/i);
      if (target)
        triggerClick(target);
    };
    reviewsSearchBtn.onclick = () => {
      const openReviews = () => {
        const target = findClickableByText(/show\s+all.*reviews/i);
        if (target)
          triggerClick(target);
      };
      const focusSearch = () => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => isVisible(el) && /review/i.test(qText(el)));
        const root = dialog ?? document.body;
        const searchBtn = Array.from(root.querySelectorAll('button, [role="button"], input[type="button"]')).find((el) => {
          if (!isVisible(el))
            return false;
          const text = [
            qText(el),
            el.getAttribute("aria-label") ?? "",
            el.getAttribute("title") ?? ""
          ].join(" ").trim();
          return /search/i.test(text);
        });
        if (searchBtn) {
          triggerClick(searchBtn);
          return;
        }
        const searchInput = root.querySelector('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]');
        searchInput?.focus();
      };
      openReviews();
      [250, 700, 1300, 2200].forEach((delayMs) => {
        setTimeout(focusSearch, delayMs);
      });
    };
    reviewsCopyBtn.onclick = async () => {
      reviewsCopyBtn.disabled = true;
      reviewsCopyBtn.textContent = "Copying...";
      try {
        const copiedCount = await copyAllReviewsFlow();
        reviewsCopyBtn.textContent = `Copied ${copiedCount}`;
        window.setTimeout(() => {
          reviewsCopyBtn.textContent = "Copy reviews";
          reviewsCopyBtn.disabled = false;
        }, 1800);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "copy failed";
        reviewsCopyBtn.textContent = `Copy failed: ${msg.slice(0, 18)}`;
      }
      reviewsCopyBtn.disabled = false;
    };
  };
  var ensureMapPanel = () => {
    const mapData = getListingMapData();
    let panel = document.getElementById(MAP_PANEL_ID);
    if (!mapData) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = MAP_PANEL_ID;
      document.body.appendChild(panel);
    }
    const approxLabel = mapData.isApproximate ? "Approximate area from Airbnb map" : "Exact map pin";
    if (!panel.dataset.initialized) {
      panel.innerHTML = '<div class="ab-property-plus-map-topbar">' + `<button id="${MAP_PANEL_HANDLE_ID}" class="ab-property-plus-drag-handle" type="button" aria-label="Move map panel" title="Move map panel">::</button>` + '<div class="ab-property-plus-map-heading">' + '<div class="ab-property-plus-map-kicker"></div>' + '<div class="ab-property-plus-map-label"></div>' + "</div>" + "</div>" + '<div class="ab-property-plus-map-actions">' + '<a data-action="open-google-maps" target="_blank" rel="noreferrer noopener">Google Maps</a>' + '<button type="button" data-action="copy-coords"></button>' + "</div>" + '<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Listing map preview"></iframe>' + '<div class="ab-property-plus-map-meta"></div>';
      panel.dataset.initialized = "true";
    }
    const handle = panel.querySelector(`#${MAP_PANEL_HANDLE_ID}`);
    const kicker = panel.querySelector(".ab-property-plus-map-kicker");
    const label = panel.querySelector(".ab-property-plus-map-label");
    const googleMapsLink = panel.querySelector('a[data-action="open-google-maps"]');
    const copyBtn = panel.querySelector('button[data-action="copy-coords"]');
    const iframe = panel.querySelector("iframe");
    const meta = panel.querySelector(".ab-property-plus-map-meta");
    makeFloatingDraggable("map", panel, handle);
    const coordsText = `${mapData.lat.toFixed(5)}, ${mapData.lng.toFixed(5)}`;
    const googleMapsUrl = getGoogleMapsUrl(mapData);
    const embedUrl = getGoogleEmbedUrl(mapData);
    if (kicker)
      kicker.textContent = approxLabel;
    if (label)
      label.textContent = mapData.label;
    if (googleMapsLink && googleMapsLink.href !== googleMapsUrl)
      googleMapsLink.href = googleMapsUrl;
    if (meta)
      meta.textContent = coordsText;
    if (iframe && iframe.getAttribute("src") !== embedUrl)
      iframe.src = embedUrl;
    if (copyBtn) {
      const defaultCopyLabel = `Copy ${coordsText}`;
      if (!copyBtn.disabled)
        copyBtn.textContent = defaultCopyLabel;
      copyBtn.onclick = async () => {
        copyBtn.disabled = true;
        const text = `${mapData.lat.toFixed(6)}, ${mapData.lng.toFixed(6)}`;
        await copyTextWithFallback(text, "Copy listing coordinates");
        copyBtn.textContent = "Copied";
        window.setTimeout(() => {
          const current = document.getElementById(MAP_PANEL_ID);
          if (current?.contains(copyBtn)) {
            copyBtn.disabled = false;
            copyBtn.textContent = defaultCopyLabel;
          }
        }, 1500);
      };
    }
  };
  var parseCurrency = (amount, symbol) => {
    const currency = symbol === "EUR" ? "EUR" : symbol === "GBP" ? "GBP" : "USD";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  };
  var findPriceCard = () => {
    const scoped = document.querySelector('[data-plugin-in-point-id="BOOK_IT_SIDEBAR"]');
    if (scoped)
      return scoped;
    const asides = Array.from(document.querySelectorAll("aside"));
    for (const aside of asides) {
      const text = qText(aside);
      if (text.includes("night") && text.includes("total"))
        return aside;
    }
    return null;
  };
  var ensureNightlyRateHint = () => {
    const card = findPriceCard();
    if (!card)
      return;
    const priceLine = Array.from(card.querySelectorAll("div, span, h1, h2, h3, strong")).find((el) => /([$€£])\s?[\d,]+(?:\.\d{1,2})?\s+for\s+\d+\s+nights?/i.test(qText(el)));
    if (!priceLine)
      return;
    const match = qText(priceLine).match(/([$€£])\s?([\d,]+(?:\.\d{1,2})?)\s+for\s+(\d+)\s+nights?/i);
    if (!match)
      return;
    const symbolRaw = match[1];
    const symbol = symbolRaw === "€" ? "EUR" : symbolRaw === "£" ? "GBP" : "USD";
    const total = Number.parseFloat(match[2].replace(/,/g, ""));
    const nights = Number.parseInt(match[3], 10);
    if (!Number.isFinite(total) || !nights)
      return;
    const nightly = total / nights;
    let inline = priceLine.querySelector(`#${NIGHTLY_INLINE_ID}`);
    if (!inline) {
      inline = document.createElement("span");
      inline.id = NIGHTLY_INLINE_ID;
      priceLine.appendChild(inline);
    }
    inline.textContent = `${parseCurrency(nightly, symbol)}/n`;
  };
  var loadTemplates = () => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      if (!raw)
        return DEFAULT_TEMPLATES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length)
        return DEFAULT_TEMPLATES;
      return parsed.filter((t) => t?.id && t?.name && t?.body);
    } catch (_e) {
      return DEFAULT_TEMPLATES;
    }
  };
  var saveTemplates = (templates) => {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    } catch (_e) {}
  };
  var copyTextWithFallback = async (text, promptTitle) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_e) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok)
        return true;
    } catch (_e) {}
    window.prompt(promptTitle, text);
    return false;
  };
  var copyMessageText = (text) => {
    copyTextWithFallback(text, "Copy this message");
  };
  var cachedAirbnbApiKey = null;
  var AIRBNB_PUBLIC_API_KEY_FALLBACK = "d306zoyjsyarp7ifhu67rjxn52tv0t20";
  var REVIEWS_QUERY_HASH_FALLBACK = "2ed951bfedf71b87d9d30e24a419e15517af9fbed7ac560a8d1cc7feadfa22e6";
  var discoverAirbnbApiKey = async () => {
    if (cachedAirbnbApiKey)
      return cachedAirbnbApiKey;
    cachedAirbnbApiKey = AIRBNB_PUBLIC_API_KEY_FALLBACK;
    return cachedAirbnbApiKey;
  };
  var getReviewsApiBaseUrl = () => {
    const reviewsUrls = performance.getEntriesByType("resource").map((entry) => entry.name).filter((url) => /\/api\/v3\/StaysPdpReviewsQuery\//.test(url));
    const latest = reviewsUrls[reviewsUrls.length - 1];
    if (latest) {
      try {
        return new URL(latest);
      } catch (_e) {
        return null;
      }
    }
    try {
      const listingId = window.location.pathname.match(/\/rooms\/(\d+)/)?.[1];
      if (!listingId)
        return null;
      const relayId = window.btoa(`StayListing:${listingId}`);
      const locale = document.documentElement.getAttribute("lang") || "en";
      const currency = (document.cookie.match(/(?:^|;\s*)currency=([^;]+)/)?.[1] || "USD").toUpperCase();
      const variables = {
        id: relayId,
        pdpReviewsRequest: {
          fieldSelector: "for_p3_translation_only",
          forPreview: false,
          limit: 24,
          offset: "0",
          showingTranslationButton: false,
          first: 24,
          sortingPreference: "MOST_RECENT"
        }
      };
      const extensions = {
        persistedQuery: {
          version: 1,
          sha256Hash: REVIEWS_QUERY_HASH_FALLBACK
        }
      };
      const fallback = new URL(`https://www.airbnb.com/api/v3/StaysPdpReviewsQuery/${REVIEWS_QUERY_HASH_FALLBACK}`);
      fallback.searchParams.set("operationName", "StaysPdpReviewsQuery");
      fallback.searchParams.set("locale", locale);
      fallback.searchParams.set("currency", currency);
      fallback.searchParams.set("variables", JSON.stringify(variables));
      fallback.searchParams.set("extensions", JSON.stringify(extensions));
      return fallback;
    } catch (_e) {
      return null;
    }
  };
  var buildReviewsApiUrl = (base, offset, pageSize) => {
    try {
      const next = new URL(base.toString());
      const variablesRaw = next.searchParams.get("variables");
      if (!variablesRaw)
        return null;
      const variables = JSON.parse(variablesRaw);
      const request = variables.pdpReviewsRequest ?? {};
      request.offset = `${offset}`;
      request.first = pageSize;
      request.limit = pageSize;
      request.forPreview = false;
      variables.pdpReviewsRequest = request;
      next.searchParams.set("variables", JSON.stringify(variables));
      return next;
    } catch (_e) {
      return null;
    }
  };
  var parseRating = (review) => {
    if (typeof review.rating === "number" && Number.isFinite(review.rating)) {
      return `${review.rating}/5`;
    }
    if (typeof review.rating === "string" && review.rating.trim()) {
      const numeric = Number.parseFloat(review.rating);
      if (Number.isFinite(numeric))
        return `${numeric}/5`;
    }
    const fromLabel = review.ratingAccessibilityLabel?.match(/([0-5](?:\.\d+)?)\s*stars?/i);
    if (fromLabel?.[1])
      return `${fromLabel[1]}/5`;
    return "n/a";
  };
  var toTextValue = (value) => {
    if (typeof value === "string")
      return value;
    if (Array.isArray(value))
      return value.map((item) => toTextValue(item)).join(" ");
    if (value && typeof value === "object") {
      const record = value;
      const preferredKeys = ["text", "body", "comment", "localizedText", "value"];
      for (const key of preferredKeys) {
        const nested = record[key];
        if (nested !== undefined) {
          const text = toTextValue(nested).trim();
          if (text)
            return text;
        }
      }
      for (const nested of Object.values(record)) {
        const text = toTextValue(nested).trim();
        if (text)
          return text;
      }
    }
    return "";
  };
  var collectTextValues = (value, out) => {
    if (typeof value === "string") {
      const text = value.replace(/\s+/g, " ").trim();
      if (text)
        out.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collectTextValues(item, out));
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach((item) => collectTextValues(item, out));
    }
  };
  var dedupeLines = (lines) => {
    const seen = new Set;
    const result = [];
    for (const line of lines) {
      const key = line.toLowerCase();
      if (seen.has(key))
        continue;
      seen.add(key);
      result.push(line);
    }
    return result;
  };
  var extractApiReviewBody = (review) => {
    const candidates = [
      review.localizedCommentV2,
      review.localizedReview,
      review.comments,
      review.comment,
      review.review,
      review.translatedComment
    ];
    const chunks = [];
    candidates.forEach((item) => collectTextValues(item, chunks));
    const normalized = dedupeLines(chunks).filter((line) => !/^(show more|read more|translation|translated)$/i.test(line)).join(" ").replace(/\s+/g, " ").trim();
    if (normalized)
      return normalized;
    const fallbackRaw = review.localizedCommentV2 ?? review.localizedReview ?? review.comments;
    return toTextValue(fallbackRaw).replace(/\s+/g, " ").trim() || "n/a";
  };
  var mapApiReview = (review) => {
    return {
      author: review.reviewer?.firstName?.trim() || "Unknown",
      location: review.localizedReviewerLocation?.trim() || "n/a",
      date: review.localizedDate?.trim() || "n/a",
      stars: parseRating(review),
      body: extractApiReviewBody(review)
    };
  };
  var loadAllReviewsFromApi = async () => {
    const baseUrl = getReviewsApiBaseUrl();
    if (!baseUrl)
      return null;
    const apiKey = await discoverAirbnbApiKey();
    if (!apiKey)
      return null;
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ?? "";
    const headers = {
      "X-Airbnb-API-Key": apiKey,
      "X-CSRF-Without-Token": "1"
    };
    if (csrfToken)
      headers["X-CSRF-Token"] = csrfToken;
    const pageSize = 24;
    let total = Number.POSITIVE_INFINITY;
    let offset = 0;
    const seen = new Map;
    while (offset < total && offset < 1200) {
      const url = buildReviewsApiUrl(baseUrl, offset, pageSize);
      if (!url)
        break;
      const response = await window.fetch(url.toString(), {
        credentials: "include",
        headers
      });
      if (!response.ok)
        break;
      const payload = await response.json();
      if (payload.errors?.length) {
        const firstError = payload.errors[0]?.message ?? "api error";
        if (/invalid api key|invalid_key/i.test(firstError))
          cachedAirbnbApiKey = null;
        break;
      }
      const reviewsNode = payload.data?.presentation?.stayProductDetailPage?.reviews;
      const rows = reviewsNode?.reviews ?? [];
      const reviewsCount = reviewsNode?.metadata?.reviewsCount;
      if (Number.isFinite(reviewsCount))
        total = reviewsCount ?? total;
      if (!rows.length)
        break;
      for (const row of rows) {
        const mapped = mapApiReview(row);
        const key = row.id || `${mapped.author}|${mapped.date}|${mapped.body.slice(0, 120)}`;
        seen.set(key, mapped);
      }
      offset += rows.length;
      if (rows.length < pageSize)
        break;
    }
    return seen.size ? Array.from(seen.values()) : null;
  };
  var isReviewsDialog = (el) => {
    if (!isVisible(el))
      return false;
    const hasPanel = Boolean(el.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"]'));
    if (hasPanel)
      return true;
    const text = qText(el);
    return /reviews?/i.test(text) && /rated|stars?/i.test(text);
  };
  var getOpenReviewsDialog = () => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    return dialogs.find((dialog) => isReviewsDialog(dialog)) ?? null;
  };
  var findReviewScroller = (dialog) => {
    const panel = dialog.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"]');
    if (panel)
      return panel;
    const candidates = Array.from(dialog.querySelectorAll("div, section"));
    const scrollable = candidates.filter((el) => {
      const style = window.getComputedStyle(el);
      const canScroll = /(auto|scroll)/.test(style.overflowY);
      return canScroll && el.scrollHeight > el.clientHeight + 80;
    }).sort((a, b) => b.scrollHeight - a.scrollHeight);
    return scrollable[0] ?? dialog;
  };
  var clickButtonsByText = (root, pattern) => {
    const buttons = Array.from(root.querySelectorAll('button, [role="button"], input[type="button"]')).filter((el) => {
      if (!isVisible(el))
        return false;
      const text = [qText(el), el.getAttribute("aria-label") ?? "", el.getAttribute("title") ?? ""].join(" ").trim();
      return pattern.test(text);
    });
    let clicked = false;
    for (const button of buttons) {
      triggerClick(button);
      clicked = true;
    }
    return clicked;
  };
  var openReviewsDialog = async () => {
    const existing = getOpenReviewsDialog();
    if (existing)
      return existing;
    const opener = findClickableByText(/show\s+all.*reviews/i);
    if (opener)
      triggerClick(opener);
    for (let i = 0;i < 32; i += 1) {
      await sleep(250);
      const dialog = getOpenReviewsDialog();
      if (dialog)
        return dialog;
    }
    return null;
  };
  var extractStars = (card, lines) => {
    const direct = qText(card).match(/rating,\s*([0-5](?:\.\d+)?)\s*stars?/i);
    if (direct?.[1])
      return `${direct[1]}/5`;
    const fromAria = Array.from(card.querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label") ?? "").find((label) => /star|rating/i.test(label));
    const starText = fromAria ?? lines.join(" ");
    const match = starText.match(/([0-5](?:\.\d+)?)\s*(?:out\s+of\s+5)?\s*stars?/i);
    return match?.[1] ? `${match[1]}/5` : "n/a";
  };
  var extractDate = (card, lines) => {
    const compact = qText(card).match(/rating,\s*[0-5](?:\.\d+)?\s*stars?,\s*[·,]?\s*([^·,]+?)(?:\s*[·,]\s*stayed|$)/i);
    if (compact?.[1])
      return compact[1].trim();
    const timeEl = card.querySelector("time");
    const timeText = qText(timeEl ?? card).match(/(\d+\s+weeks?\s+ago|\d+\s+days?\s+ago|\d+\s+months?\s+ago|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i);
    if (timeText?.[0])
      return timeText[0];
    const lineHit = lines.find((line) => /(\d+\s+weeks?\s+ago|\d+\s+days?\s+ago|\d+\s+months?\s+ago|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i.test(line));
    return lineHit ?? "n/a";
  };
  var extractAuthor = (card, lines) => {
    const heading = card.querySelector("h1, h2, h3, h4");
    const headingText = qText(heading ?? card).trim();
    if (headingText && headingText.length <= 50 && !/rating|review|stayed/i.test(headingText)) {
      return headingText;
    }
    for (const line of lines) {
      if (!line || line.length > 50)
        continue;
      if (/\d/.test(line))
        continue;
      if (/(star|rating|review|stayed|show more|read more)/i.test(line))
        continue;
      if (!/^[A-Za-z][A-Za-z' -]{1,40}$/.test(line))
        continue;
      return line;
    }
    return "Unknown";
  };
  var extractLocation = (lines, author, date) => {
    for (const line of lines) {
      if (line === author || line === date)
        continue;
      if (/\d/.test(line))
        continue;
      if (/(star|rating|review|stayed|show more|read more)/i.test(line))
        continue;
      if (line.length < 2 || line.length > 70)
        continue;
      return line;
    }
    return "n/a";
  };
  var extractReviewBody = (lines, author, location, date, stars) => {
    const ignore = new Set([
      author.toLowerCase(),
      location.toLowerCase(),
      date.toLowerCase(),
      stars.toLowerCase()
    ]);
    const content = lines.filter((line) => {
      if (ignore.has(line.toLowerCase()))
        return false;
      if (/(show more|read more|translation|translated)/i.test(line))
        return false;
      return line.length > 2;
    });
    return content.join(" ").trim();
  };
  var parseReviewCard = (card) => {
    const lines = qInnerLines(card);
    if (!lines.length)
      return null;
    const stars = extractStars(card, lines);
    const date = extractDate(card, lines);
    const author = extractAuthor(card, lines);
    const location = extractLocation(lines, author, date);
    const body = extractReviewBody(lines, author, location, date, stars);
    if (!body && author === "Unknown" && date === "n/a" && stars === "n/a")
      return null;
    return { author, location, date, stars, body: body || "n/a" };
  };
  var collectReviewCards = (dialog) => {
    const cards = new Set;
    const byId = Array.from(dialog.querySelectorAll("[data-review-id]"));
    for (const item of byId)
      cards.add(item);
    if (cards.size) {
      const seen2 = new Set;
      const results2 = [];
      for (const card of cards) {
        const parsed = parseReviewCard(card);
        if (!parsed)
          continue;
        const key = `${parsed.author}|${parsed.date}|${parsed.body.slice(0, 120)}`;
        if (seen2.has(key))
          continue;
        seen2.add(key);
        results2.push(parsed);
      }
      return results2;
    }
    const anchors = Array.from(dialog.querySelectorAll('[aria-label*="star" i], [aria-label*="rating" i], time'));
    for (const anchor of anchors) {
      const card = anchor.closest("article, li, section, div");
      if (!card || !isVisible(card))
        continue;
      if (qText(card).length < 40)
        continue;
      cards.add(card);
    }
    if (!cards.size) {
      const fallback = Array.from(dialog.querySelectorAll("article, li")).filter((el) => {
        if (!isVisible(el))
          return false;
        const text = qText(el);
        return text.length > 40 && /review|star|stayed|guest/i.test(text);
      });
      for (const item of fallback)
        cards.add(item);
    }
    const seen = new Set;
    const results = [];
    for (const card of cards) {
      const parsed = parseReviewCard(card);
      if (!parsed)
        continue;
      const key = `${parsed.author}|${parsed.date}|${parsed.body.slice(0, 120)}`;
      if (seen.has(key))
        continue;
      seen.add(key);
      results.push(parsed);
    }
    return results;
  };
  var loadAllReviews = async (dialog) => {
    const scroller = findReviewScroller(dialog);
    const seen = new Map;
    let staleRounds = 0;
    for (let i = 0;i < 40; i += 1) {
      clickButtonsByText(dialog, /show\s+more|read\s+more/i);
      const chunk = collectReviewCards(dialog);
      for (const item of chunk) {
        const key = `${item.author}|${item.date}|${item.body.slice(0, 140)}`;
        seen.set(key, item);
      }
      const before = scroller.scrollTop;
      scroller.scrollTo({
        top: before + Math.max(800, Math.floor(scroller.clientHeight * 0.8)),
        behavior: "auto"
      });
      const clickedMore = clickButtonsByText(dialog, /load\s+more|next|more\s+reviews/i);
      await sleep(380);
      const after = scroller.scrollTop;
      const moved = Math.abs(after - before) > 8;
      if (!moved && !clickedMore)
        staleRounds += 1;
      else
        staleRounds = 0;
      if (staleRounds >= 4)
        break;
    }
    return Array.from(seen.values());
  };
  var formatReviews = (reviews) => {
    const lines = [];
    lines.push("Airbnb reviews export");
    lines.push(`Total reviews captured: ${reviews.length}`);
    lines.push("");
    reviews.forEach((review, index) => {
      lines.push(`${index + 1}. ${review.author}`);
      lines.push(`- Stars: ${review.stars}`);
      lines.push(`- Date: ${review.date}`);
      lines.push(`- Location: ${review.location}`);
      lines.push(`- Review: ${review.body}`);
      lines.push("");
    });
    return lines.join(`
`).trim();
  };
  var copyAllReviewsFlow = async () => {
    const apiReviews = await loadAllReviewsFromApi();
    if (apiReviews?.length) {
      const output2 = formatReviews(apiReviews);
      await copyTextWithFallback(output2, "Copy all reviews");
      return apiReviews.length;
    }
    const dialog = await openReviewsDialog();
    if (!dialog)
      throw new Error("reviews dialog not found");
    const reviews = await loadAllReviews(dialog);
    if (!reviews.length)
      throw new Error("no reviews found");
    const output = formatReviews(reviews);
    await copyTextWithFallback(output, "Copy all reviews");
    return reviews.length;
  };
  var ensureReviewsCopyButton = () => {
    const dialog = getOpenReviewsDialog();
    if (!dialog) {
      document.getElementById(REVIEWS_COPY_BTN_ID)?.remove();
      return;
    }
    let button = dialog.querySelector(`#${REVIEWS_COPY_BTN_ID}`);
    if (!button) {
      button = document.createElement("button");
      button.id = REVIEWS_COPY_BTN_ID;
      button.type = "button";
      button.textContent = "Copy all reviews";
      const title = dialog.querySelector("h1, h2, h3");
      if (title?.parentElement)
        title.parentElement.appendChild(button);
      else
        dialog.prepend(button);
    }
    button.onclick = async () => {
      button.disabled = true;
      button.textContent = "Loading reviews...";
      try {
        const copiedCount = await copyAllReviewsFlow();
        button.textContent = `Copied ${copiedCount} reviews`;
        window.setTimeout(() => {
          const current = getOpenReviewsDialog();
          if (current?.querySelector(`#${REVIEWS_COPY_BTN_ID}`)) {
            button.textContent = "Copy all reviews";
            button.disabled = false;
          }
        }, 1800);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "copy failed";
        button.textContent = `Copy failed: ${msg.slice(0, 18)}`;
      }
      button.disabled = false;
    };
  };
  var findHostFirstName = () => {
    const messageTarget = findClickableByText(/^(message|contact)\s+.+/i);
    const matchFromButton = qText(messageTarget ?? document.body).match(/(?:message|contact)\s+([a-zA-Z][\w'-]+)/i);
    if (matchFromButton?.[1])
      return matchFromButton[1];
    const title = Array.from(document.querySelectorAll("h1, h2, h3, span, p")).map((el) => qText(el)).find((text) => /contact\s+[a-zA-Z]/i.test(text));
    const matchFromTitle = title?.match(/contact\s+([a-zA-Z][\w'-]+)/i);
    if (matchFromTitle?.[1])
      return matchFromTitle[1];
    return "there";
  };
  var composeMessage = (body) => {
    const firstName = findHostFirstName();
    return `Hi ${firstName},

${body.trim()}

Thanks!`;
  };
  var escapeHtml = (value) => {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  };
  var ensureTemplateToolbar = () => {
    const composer = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]')).find((el) => isVisible(el));
    if (!composer || !composer.parentElement) {
      document.getElementById(TEMPLATE_BAR_ID)?.remove();
      return;
    }
    let bar = document.getElementById(TEMPLATE_BAR_ID);
    if (!bar) {
      bar = document.createElement("div");
      bar.id = TEMPLATE_BAR_ID;
      composer.parentElement.insertBefore(bar, composer);
    } else if (bar.parentElement !== composer.parentElement) {
      composer.parentElement.insertBefore(bar, composer);
    }
    const templates = loadTemplates();
    const selectedBeforeRender = bar.querySelector("select")?.value;
    const selected = templates.find((template) => template.id === selectedBeforeRender)?.id ?? templates[0]?.id;
    const options = templates.map((template) => {
      const isSelected = template.id === selected ? " selected" : "";
      return `<option value="${escapeHtml(template.id)}"${isSelected}>${escapeHtml(template.name)}</option>`;
    }).join("");
    bar.innerHTML = "<span>Message templates</span>" + `<select>${options}</select>` + '<button data-action="insert">Insert</button>' + '<button data-action="manage">Manage</button>' + `<div id="${TEMPLATE_EDITOR_ID}">` + '<input data-field="name" type="text" placeholder="Template name" />' + '<textarea data-field="body" placeholder="Template message body"></textarea>' + '<div class="ab-property-plus-editor-actions">' + '<button data-action="save-new">Save as new</button>' + '<button data-action="update">Update selected</button>' + '<button data-action="delete">Delete selected</button>' + '<button data-action="close">Close</button>' + "</div>" + "</div>";
    const select = bar.querySelector("select");
    const insertBtn = bar.querySelector('button[data-action="insert"]');
    const manageBtn = bar.querySelector('button[data-action="manage"]');
    const editor = bar.querySelector(`#${TEMPLATE_EDITOR_ID}`);
    const nameInput = bar.querySelector('input[data-field="name"]');
    const bodyInput = bar.querySelector('textarea[data-field="body"]');
    const saveNewBtn = bar.querySelector('button[data-action="save-new"]');
    const updateBtn = bar.querySelector('button[data-action="update"]');
    const delBtn = bar.querySelector('button[data-action="delete"]');
    const closeBtn = bar.querySelector('button[data-action="close"]');
    if (!select || !insertBtn || !manageBtn || !editor || !nameInput || !bodyInput || !saveNewBtn || !updateBtn || !delBtn || !closeBtn) {
      return;
    }
    const getCurrentTemplate = () => {
      const currentTemplates = loadTemplates();
      return currentTemplates.find((item) => item.id === select.value) ?? null;
    };
    const syncEditorFields = () => {
      const current = getCurrentTemplate();
      if (!current) {
        nameInput.value = "";
        bodyInput.value = "";
        return;
      }
      nameInput.value = current.name;
      bodyInput.value = current.body;
    };
    insertBtn.onclick = () => {
      const tpl = getCurrentTemplate();
      if (!tpl)
        return;
      copyMessageText(composeMessage(tpl.body));
    };
    select.onchange = syncEditorFields;
    manageBtn.onclick = () => {
      editor.classList.toggle("is-open");
      if (editor.classList.contains("is-open")) {
        syncEditorFields();
        nameInput.focus();
      }
    };
    closeBtn.onclick = () => {
      editor.classList.remove("is-open");
    };
    saveNewBtn.onclick = () => {
      const name = nameInput.value.trim();
      const body = bodyInput.value.trim();
      if (!name || !body)
        return;
      const next = [...loadTemplates(), { id: `${Date.now()}`, name, body }];
      saveTemplates(next);
      ensureTemplateToolbar();
    };
    updateBtn.onclick = () => {
      const current = getCurrentTemplate();
      if (!current)
        return;
      const name = nameInput.value.trim();
      const body = bodyInput.value.trim();
      if (!name || !body)
        return;
      const next = loadTemplates().map((item) => {
        if (item.id !== current.id)
          return item;
        return { ...item, name, body };
      });
      saveTemplates(next);
      ensureTemplateToolbar();
    };
    delBtn.onclick = () => {
      const current = getCurrentTemplate();
      if (!current)
        return;
      const ok = window.confirm(`Delete template "${current.name}"?`);
      if (!ok)
        return;
      const next = loadTemplates().filter((item) => item.id !== current.id);
      if (!next.length)
        next.push(...DEFAULT_TEMPLATES);
      saveTemplates(next);
      ensureTemplateToolbar();
    };
  };
  var run = () => {
    ensureQuickActions();
    ensureMapPanel();
    ensureTemplateToolbar();
    ensureNightlyRateHint();
    ensureReviewsCopyButton();
  };
  var main = () => {
    injectCSS(STYLE_ID, CSS);
    run();
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(run, 350);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const onNavigate = () => setTimeout(run, 300);
    const pushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      cachedListingMapPath = "";
      cachedListingMapData = null;
      pushState(...args);
      onNavigate();
    };
    const replaceState = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      cachedListingMapPath = "";
      cachedListingMapData = null;
      replaceState(...args);
      onNavigate();
    };
    window.addEventListener("popstate", onNavigate);
  };
  main();
})();
