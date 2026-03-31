// ==UserScript==
// @name                 Hostelworld Enhancer
// @author               AZ
// @description          review search panel with live regex filter + quick search buttons
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/hostelworld.com/hostelworld.user.js
// @grant                none
// @match                https://www.hostelworld.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/hostelworld.com/hostelworld.user.js
// @version              2.0.3
// ==/UserScript==

'use strict';
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap).get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function") {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
    }
    __moduleCache.set(from, entry);
    return entry;
  };
  var __moduleCache;

  // src/hostelworld.com/hostelworld.user.ts
  var exports_hostelworld_user = {};

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

  // src/lib/hotel-search.ts
  var cleanPart = (value) => {
    return (value ?? "").replace(/\s+/g, " ").trim();
  };
  var uniqueParts = (parts) => {
    const seen = new Set;
    const out = [];
    parts.forEach((part) => {
      const cleaned = cleanPart(part);
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key))
        return;
      seen.add(key);
      out.push(cleaned);
    });
    return out;
  };
  var joinParts = (parts, sep) => {
    return uniqueParts(parts).join(sep);
  };
  var getFallbackDestination = (ctx) => {
    return joinParts([ctx.city, ctx.country], ", ");
  };
  var getPreferredSearchLocationText = (ctx) => {
    const city = cleanPart(ctx.city);
    if (city) {
      return joinParts([city, ctx.country], ", ");
    }
    return getBestLocationText(ctx);
  };
  var normalizeLocationPart = (value) => {
    return cleanPart(value).toLowerCase();
  };
  var isAddressCoveringLocationPart = (address, part) => {
    const normalizedAddress = normalizeLocationPart(address);
    const normalizedPart = normalizeLocationPart(part);
    if (!normalizedAddress || !normalizedPart)
      return false;
    return normalizedAddress.split(",").map((segment) => segment.trim()).some((segment) => segment === normalizedPart || segment.endsWith(` ${normalizedPart}`));
  };
  var getBestLocationText = (ctx) => {
    const locationParts = [];
    const address = cleanPart(ctx.address);
    if (address)
      locationParts.push(address);
    [ctx.neighborhood, ctx.city, ctx.country].forEach((part) => {
      const cleaned = cleanPart(part);
      if (!cleaned || isAddressCoveringLocationPart(address, cleaned))
        return;
      locationParts.push(cleaned);
    });
    return locationParts.join(", ");
  };
  var getPrimarySearchText = (ctx) => {
    return joinParts([ctx.propertyName, getPreferredSearchLocationText(ctx)], ", ");
  };
  var getDestinationSearchText = (ctx) => {
    return joinParts([ctx.propertyName, ctx.city, ctx.country], " ");
  };
  var getGoogleMapsText = (ctx) => {
    if (Number.isFinite(ctx.lat) && Number.isFinite(ctx.lng)) {
      return `${ctx.lat},${ctx.lng}`;
    }
    return getPrimarySearchText(ctx) || getDestinationSearchText(ctx) || getFallbackDestination(ctx);
  };
  var parseTravelDate = (value) => {
    const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value ?? "");
    if (!match?.groups)
      return null;
    const year = Number.parseInt(match.groups.year, 10);
    const month = Number.parseInt(match.groups.month, 10);
    const day = Number.parseInt(match.groups.day, 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day))
      return null;
    const utcMs = Date.UTC(year, month - 1, day);
    const roundTrip = new Date(utcMs);
    if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day) {
      return null;
    }
    return { year, month, day, utcMs };
  };
  var getGoogleTravelDateRange = (ctx) => {
    const checkin = parseTravelDate(ctx.checkin);
    const checkout = parseTravelDate(ctx.checkout);
    if (!checkin || !checkout)
      return null;
    const nights = Math.round((checkout.utcMs - checkin.utcMs) / 86400000);
    if (!Number.isInteger(nights) || nights <= 0)
      return null;
    return { checkin, checkout, nights };
  };
  var encodeVarint = (value) => {
    const bytes = [];
    let next = value;
    while (next >= 128) {
      bytes.push(next & 127 | 128);
      next >>= 7;
    }
    bytes.push(next);
    return bytes;
  };
  var encodeFieldVarint = (fieldNumber, value) => {
    return [...encodeVarint(fieldNumber << 3 | 0), ...encodeVarint(value)];
  };
  var encodeFieldBytes = (fieldNumber, payload) => {
    return [...encodeVarint(fieldNumber << 3 | 2), ...encodeVarint(payload.length), ...payload];
  };
  var encodeTravelDateMessage = (date) => {
    return [
      ...encodeFieldVarint(1, date.year),
      ...encodeFieldVarint(2, date.month),
      ...encodeFieldVarint(3, date.day)
    ];
  };
  var encodeBase64Url = (bytes) => {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };
  var buildGoogleTravelTs = (ctx) => {
    const dateRange = getGoogleTravelDateRange(ctx);
    if (!dateRange)
      return null;
    const travelDates = [
      ...encodeFieldBytes(1, encodeTravelDateMessage(dateRange.checkin)),
      ...encodeFieldBytes(2, encodeTravelDateMessage(dateRange.checkout)),
      ...encodeFieldVarint(3, dateRange.nights)
    ];
    const stayConfig = [
      ...encodeFieldBytes(2, travelDates),
      ...encodeFieldBytes(6, encodeFieldVarint(1, 1))
    ];
    const payload = [
      ...encodeFieldBytes(1, encodeFieldBytes(3, [])),
      ...encodeFieldBytes(2, stayConfig)
    ];
    return encodeBase64Url([...encodeFieldVarint(1, 1), ...encodeFieldBytes(3, payload)]);
  };
  var buildGoogleTravelUrl = (ctx) => {
    const query = getPrimarySearchText(ctx) || getDestinationSearchText(ctx) || getFallbackDestination(ctx);
    const params = new URLSearchParams({ q: query });
    const travelTs = buildGoogleTravelTs(ctx);
    if (travelTs) {
      params.set("qs", "CAE4AA");
      params.set("ts", travelTs);
      params.set("ap", "MAE");
    }
    return `https://www.google.com/travel/search?${params.toString()}`;
  };
  var getTripAdvisorText = (ctx) => {
    const base = getPrimarySearchText(ctx) || getDestinationSearchText(ctx);
    if (!base)
      return "";
    if (/\b(hostel|hotel|resort|apartment|apartments|villa|inn|lodge|suite|suites)\b/i.test(base)) {
      return base;
    }
    const hint = ctx.source === "hostelworld" ? "hostel" : "hotel";
    return `${base} ${hint}`.trim();
  };
  var getPositiveGuestCount = (guests) => {
    return Number.isFinite(guests) && (guests ?? 0) > 0 ? Math.floor(guests) : 1;
  };
  var buildSuperSearchUrl = (ctx) => {
    const destination = getDestinationSearchText(ctx) || getFallbackDestination(ctx);
    const query = joinParts([ctx.propertyName, ctx.city], " ") || destination;
    const params = new URLSearchParams({
      destination,
      super_lookup: "1",
      super_query: query,
      super_name: cleanPart(ctx.propertyName),
      super_city: cleanPart(ctx.city),
      super_country: cleanPart(ctx.country),
      num_adults: String(getPositiveGuestCount(ctx.guests)),
      children: "[]",
      expand_params: "false"
    });
    if (ctx.checkin)
      params.set("checkin_at", ctx.checkin);
    if (ctx.checkout)
      params.set("checkout_at", ctx.checkout);
    return `https://www.super.com/home/travel?${params.toString()}`;
  };
  var buildHotelSearchLinks = (ctx) => {
    const primary = getPrimarySearchText(ctx) || getDestinationSearchText(ctx);
    const maps = getGoogleMapsText(ctx);
    const tripAdvisor = getTripAdvisorText(ctx) || primary;
    const googleTravel = buildGoogleTravelUrl(ctx);
    const encodedPrimary = encodeURIComponent(primary);
    const encodedMaps = encodeURIComponent(maps);
    const encodedTripAdvisor = encodeURIComponent(tripAdvisor);
    const propertyLabel = cleanPart(ctx.propertyName) || cleanPart(ctx.city) || "property";
    return [
      {
        service: "google",
        label: "Google",
        href: `https://www.google.com/search?q=${encodedPrimary}`,
        title: `Search Google: ${propertyLabel}`
      },
      {
        service: "google-travel",
        label: "Travel",
        href: googleTravel,
        title: `Search Google Travel: ${propertyLabel}`
      },
      {
        service: "google-maps",
        label: "Maps",
        href: `https://www.google.com/maps/search/?api=1&query=${encodedMaps}`,
        title: `Open in Google Maps: ${propertyLabel}`
      },
      {
        service: "booking",
        label: "Booking",
        href: `https://www.booking.com/searchresults.html?ss=${encodedPrimary}`,
        title: `Search Booking.com: ${propertyLabel}`
      },
      {
        service: "tripadvisor",
        label: "TripAdvisor",
        href: `https://www.tripadvisor.com/Search?q=${encodedTripAdvisor}`,
        title: `Search TripAdvisor: ${propertyLabel}`
      },
      {
        service: "super",
        label: "Super",
        href: buildSuperSearchUrl(ctx),
        title: `Search Super.com: ${propertyLabel}`
      }
    ];
  };

  // src/lib/hotel-search-ui.ts
  var buildSignature = (links, getLinkText) => {
    return links.map((link) => `${getLinkText(link)}:${link.href}`).join("|");
  };
  var renderHotelSearchBar = (opts) => {
    const existing = document.getElementById(opts.barId);
    const placement = opts.placement ?? "append";
    const getLinkText = opts.getLinkText ?? ((link) => link.label);
    if (!opts.anchor || !opts.links.length) {
      existing?.remove();
      return null;
    }
    let bar = existing;
    if (!bar) {
      bar = document.createElement("div");
      bar.id = opts.barId;
    }
    if (opts.barClassName)
      bar.className = opts.barClassName;
    if (opts.barAttrs) {
      Object.entries(opts.barAttrs).forEach(([key, value]) => {
        bar.setAttribute(key, value);
      });
    }
    const signature = buildSignature(opts.links, getLinkText);
    const expectedParent = placement === "append" ? opts.anchor : opts.anchor.parentElement;
    const isMounted = placement === "append" ? bar.parentElement === opts.anchor : bar.previousElementSibling === opts.anchor && bar.parentElement === expectedParent;
    if (bar.dataset.signature === signature && isMounted) {
      return bar;
    }
    bar.textContent = "";
    bar.dataset.signature = signature;
    opts.links.forEach((link) => {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = link.title;
      const linkClassName = opts.getLinkClassName?.(link);
      if (linkClassName)
        a.className = linkClassName;
      if (opts.renderLinkContent) {
        opts.renderLinkContent(link, a);
      } else {
        a.textContent = getLinkText(link);
      }
      bar.appendChild(a);
    });
    if (placement === "append") {
      if (bar.parentElement !== opts.anchor)
        opts.anchor.appendChild(bar);
      return bar;
    }
    if (!opts.anchor.parentElement) {
      bar.remove();
      return null;
    }
    if (bar.previousElementSibling !== opts.anchor || bar.parentElement !== opts.anchor.parentElement) {
      opts.anchor.parentElement.insertBefore(bar, opts.anchor.nextSibling);
    }
    return bar;
  };

  // src/lib/page-lifecycle.ts
  var KEY = "__lbLocationChangeController__";
  var scheduleListener = (listener) => {
    const nextHref = window.location.href;
    if (nextHref === listener.lastHref)
      return;
    listener.lastHref = nextHref;
    if (listener.timer)
      window.clearTimeout(listener.timer);
    if (listener.debounceMs <= 0) {
      listener.callback();
      return;
    }
    listener.timer = window.setTimeout(() => {
      listener.timer = null;
      listener.callback();
    }, listener.debounceMs);
  };
  var ensureController = () => {
    const existing = window[KEY];
    if (existing)
      return existing;
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    const controller = {
      listeners: new Set,
      pushState,
      replaceState,
      notify: () => {
        controller.listeners.forEach((listener) => {
          scheduleListener(listener);
        });
      },
      restore: () => {
        history.pushState = pushState;
        history.replaceState = replaceState;
        window.removeEventListener("popstate", controller.onPopState);
        delete window[KEY];
      },
      onPopState: () => {
        controller.notify();
      }
    };
    history.pushState = (...args) => {
      pushState(...args);
      controller.notify();
    };
    history.replaceState = (...args) => {
      replaceState(...args);
      controller.notify();
    };
    window.addEventListener("popstate", controller.onPopState);
    window[KEY] = controller;
    return controller;
  };
  var watchLocationChange = (callback, opts) => {
    const controller = ensureController();
    const listener = {
      callback,
      debounceMs: opts?.debounceMs ?? 0,
      lastHref: window.location.href,
      timer: null
    };
    controller.listeners.add(listener);
    return () => {
      if (listener.timer)
        window.clearTimeout(listener.timer);
      controller.listeners.delete(listener);
      if (controller.listeners.size === 0)
        controller.restore();
    };
  };

  // src/hostelworld.com/hostelworld.css
  var hostelworld_default = `#hw-review-search-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
  background: #ff6600;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font:
    600 13px/1 system-ui,
    sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  transition: background 0.15s;
}
#hw-review-search-btn:hover {
  background: #e05500;
}
#hw-review-search-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: min(520px, 100vw);
  height: 100vh;
  z-index: 99998;
  background: #1a1a1a;
  color: #e8e8e8;
  display: flex;
  flex-direction: column;
  font:
    13px/1.4 system-ui,
    sans-serif;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  transform: translateX(100%);
  transition: transform 0.25s ease;
}
#hw-review-search-panel.open {
  transform: translateX(0);
}
.hw-rs-header {
  padding: 14px 16px 10px;
  background: #111;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}
.hw-rs-header h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #ff6600;
}
.hw-rs-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hw-rs-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hw-rs-input {
  flex: 1;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e8e8e8;
  padding: 6px 10px;
  font:
    13px system-ui,
    sans-serif;
  outline: none;
}
.hw-rs-input:focus {
  border-color: #ff6600;
}
.hw-rs-input.error {
  border-color: #e55;
  background: #2a1a1a;
}
.hw-rs-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  font-weight: 600;
}
.hw-rs-badge.match {
  background: #2a4a2a;
  color: #6f6;
}
.hw-rs-badge.total {
  background: #2a2a3a;
  color: #aaf;
}
.hw-rs-progress {
  font-size: 11px;
  color: #888;
  padding: 4px 0 0;
}
.hw-rs-progress-bar {
  height: 3px;
  background: #333;
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.hw-rs-progress-fill {
  height: 100%;
  background: #ff6600;
  transition: width 0.15s;
}
.hw-rs-options {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #aaa;
}
.hw-rs-options label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.hw-rs-options input[type='checkbox'] {
  accent-color: #ff6600;
}
.hw-rs-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.hw-rs-list::-webkit-scrollbar {
  width: 6px;
}
.hw-rs-list::-webkit-scrollbar-track {
  background: transparent;
}
.hw-rs-list::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}
.hw-rs-empty {
  padding: 32px 16px;
  text-align: center;
  color: #666;
  font-size: 12px;
}
.hw-rv {
  background: #242424;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 6px;
}
.hw-rv-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.hw-rv-score {
  font-weight: 700;
  font-size: 13px;
  padding: 2px 7px;
  border-radius: 4px;
  color: #fff;
  flex-shrink: 0;
}
.hw-rv-nick {
  font-weight: 600;
  font-size: 12px;
  color: #ccc;
}
.hw-rv-nat {
  font-size: 11px;
  color: #888;
}
.hw-rv-date {
  font-size: 11px;
  color: #666;
  margin-left: auto;
}
.hw-rv-text {
  font-size: 12px;
  color: #ddd;
  line-height: 1.5;
}
.hw-rv-text mark {
  background: rgba(255, 165, 0, 0.35);
  color: #ffcc66;
  border-radius: 2px;
  padding: 0 1px;
}
.hw-rs-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  position: absolute;
  top: 12px;
  right: 12px;
}
.hw-rs-close:hover {
  color: #ccc;
}
.hw-rs-load-btn {
  width: 100%;
  background: #ff6600;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px;
  font: 600 12px system-ui;
  cursor: pointer;
  margin-top: 4px;
}
.hw-rs-load-btn:disabled {
  background: #555;
  cursor: not-allowed;
}
.hw-rs-load-btn:not(:disabled):hover {
  background: #e05500;
}
.hw-rs-sort {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e8e8e8;
  padding: 5px 8px;
  font: 12px system-ui;
  cursor: pointer;
}
#hw-search-bar {
  position: fixed;
  bottom: 62px;
  right: 20px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}
.hw-sb-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 20px;
  border: none;
  font:
    600 11px/1 system-ui,
    sans-serif;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
  transition:
    opacity 0.15s,
    transform 0.15s;
  color: #fff;
}
.hw-sb-btn:hover {
  opacity: 0.85;
  transform: translateX(-2px);
}
.hw-sb-btn-google {
  background: #4285f4;
}
.hw-sb-btn-travel {
  background: #1a73e8;
}
.hw-sb-btn-maps {
  background: #34a853;
}
.hw-sb-btn-booking {
  background: #003580;
}
.hw-sb-btn-super {
  background: #1f6fff;
}
.hw-sb-btn-tripadv {
  background: #00aa6c;
}
`;

  // src/hostelworld.com/hostelworld.user.ts
  var PANEL_ID = "hw-review-search-panel";
  var HW_STYLE_ID = "hw-review-search-style";
  var BTN_ID = "hw-review-search-btn";
  var SEARCH_BAR_ID = "hw-search-bar";
  var getPropertyId = () => {
    const m = window.location.pathname.match(/\/(\d+)(?:$|[?#/])/);
    return m ? m[1] : null;
  };
  var slugToWords = (value) => decodeURIComponent(value).replace(/-/g, " ").replace(/\s+/g, " ").trim();
  var getNameAndCityFromUrl = () => {
    const m = window.location.pathname.match(/hosteldetails\.php\/([^/]+)\/([^/]+)\/\d+/);
    if (!m)
      return { name: "", city: "" };
    return {
      name: slugToWords(m[1]),
      city: slugToWords(m[2])
    };
  };
  var cleanPropertyName = (value) => value.replace(/\s*[|,-]\s*Hostelworld.*$/i, "").replace(/\s+-\s+Hostelworld.*$/i, "").replace(/\s+/g, " ").trim();
  var parseJsonRecord = (value) => {
    if (!value || typeof value !== "object")
      return null;
    const rec = value;
    const address = rec.address && typeof rec.address === "object" ? rec.address : null;
    const name = typeof rec.name === "string" ? cleanPropertyName(rec.name) : "";
    const city = typeof address?.addressLocality === "string" ? address.addressLocality.trim() : "";
    const country = typeof address?.addressCountry === "string" ? address.addressCountry.trim() : "";
    return name || city || country ? { name, city, country } : null;
  };
  var getPropertyDetails = () => {
    const fromUrl = getNameAndCityFromUrl();
    const h1 = cleanPropertyName(document.querySelector("h1")?.textContent?.trim() || "");
    const ogTitle = cleanPropertyName(document.querySelector('meta[property="og:title"]')?.content || "");
    const title = cleanPropertyName(document.title);
    const pageName = h1 || ogTitle || title || fromUrl.name;
    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const parsed = JSON.parse(script.textContent || "");
        const records = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && ("@graph" in parsed) ? parsed["@graph"] ?? [] : [parsed];
        for (const record of records) {
          const details = parseJsonRecord(record);
          if (!details)
            continue;
          return {
            name: pageName || details.name || fromUrl.name,
            city: details.city || fromUrl.city,
            country: details.country
          };
        }
      } catch (_e) {}
    }
    return {
      name: pageName,
      city: fromUrl.city,
      country: ""
    };
  };
  var escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var getCountry = (city) => {
    if (!city)
      return "";
    const text = document.body?.innerText ?? "";
    const cityLine = text.match(new RegExp(`${escRe(city)},\\s*([^\\n]+?)\\s+View Map`));
    if (cityLine?.[1])
      return cityLine[1].trim();
    const citySentence = text.match(new RegExp(`\\b${escRe(city)}\\s+([^\\n,.]+?)\\s+provides`, "i"));
    if (citySentence?.[1])
      return citySentence[1].trim();
    return "";
  };
  var reviewsUrl = (propId, page, allLangs) => `https://prod.apigee.hostelworld.com/legacy-hwapi-service/2.2/properties/${propId}/reviews/` + `?sort=-date&allLanguages=${allLangs ? "true" : "false"}&page=${page}&monthCount=36&application=web`;
  var fetchPage = async (propId, page, allLangs) => {
    const resp = await fetch(reviewsUrl(propId, page, allLangs));
    if (!resp.ok)
      throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  };
  var injectHwStyles = () => {
    injectCSS(HW_STYLE_ID, hostelworld_default);
  };
  var scoreColor = (v) => {
    if (v >= 80)
      return "#2d7a2d";
    if (v >= 60)
      return "#6a7a1a";
    if (v >= 40)
      return "#7a4a1a";
    return "#7a1a1a";
  };
  var escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  var highlightText = (text, regex) => {
    if (!regex)
      return escHtml(text);
    const parts = [];
    let last = 0;
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      parts.push(escHtml(text.slice(last, m.index)));
      parts.push(`<mark>${escHtml(m[0])}</mark>`);
      last = m.index + m[0].length;
      if (!regex.global)
        break;
    }
    parts.push(escHtml(text.slice(last)));
    return parts.join("");
  };
  var renderCard = (rv, regex) => {
    const score = rv.rating?.overall ?? rv.rating?.value ?? 0;
    const color = scoreColor(score);
    const text = rv.notes || "";
    const nick = rv.user?.nickname || "anon";
    const nat = rv.user?.nationality?.name || "";
    const date = rv.date ? rv.date.substring(0, 7) : "";
    const body = text ? highlightText(text, regex) : '<span style="color:#555">no text</span>';
    return `
    <div class="hw-rv">
      <div class="hw-rv-meta">
        <span class="hw-rv-score" style="background:${color}">${(score / 10).toFixed(1)}</span>
        <span class="hw-rv-nick">${escHtml(nick)}</span>
        ${nat ? `<span class="hw-rv-nat">${escHtml(nat)}</span>` : ""}
        <span class="hw-rv-date">${date}</span>
      </div>
      <div class="hw-rv-text">${body}</div>
    </div>
  `;
  };
  var hwState = {
    reviews: [],
    loading: false,
    loadedPages: 0,
    totalPages: 0,
    totalReviews: 0,
    query: "",
    caseSensitive: false,
    allLanguages: false,
    sortBy: "date"
  };
  var listEl = null;
  var progressEl = null;
  var progressFillEl = null;
  var matchBadgeEl = null;
  var totalBadgeEl = null;
  var inputEl = null;
  var loadBtnEl = null;
  var applyFilter = () => {
    if (!listEl)
      return;
    const q = hwState.query.trim();
    let regex = null;
    let valid = true;
    if (q) {
      try {
        regex = new RegExp(q, hwState.caseSensitive ? "g" : "gi");
        inputEl?.classList.remove("error");
      } catch {
        valid = false;
        inputEl?.classList.add("error");
      }
    } else {
      inputEl?.classList.remove("error");
    }
    let matched = hwState.reviews;
    if (valid && regex) {
      matched = hwState.reviews.filter((rv) => {
        regex.lastIndex = 0;
        return regex.test(rv.notes || "");
      });
    }
    if (hwState.sortBy === "score") {
      matched = [...matched].sort((a, b) => (b.rating?.overall ?? 0) - (a.rating?.overall ?? 0));
    }
    if (matchBadgeEl) {
      matchBadgeEl.textContent = `${matched.length} match${matched.length !== 1 ? "es" : ""}`;
      matchBadgeEl.style.display = q && valid ? "" : "none";
    }
    if (totalBadgeEl) {
      totalBadgeEl.textContent = `${hwState.reviews.length} / ${hwState.totalReviews} loaded`;
    }
    if (matched.length === 0) {
      listEl.innerHTML = `<div class="hw-rs-empty">${hwState.reviews.length === 0 ? "No reviews loaded yet — click Load." : "No reviews match."}</div>`;
      return;
    }
    const html = matched.map((rv) => renderCard(rv, valid && q ? new RegExp(q, hwState.caseSensitive ? "g" : "gi") : null)).join("");
    listEl.innerHTML = html;
  };
  var updateProgress = () => {
    if (!progressEl)
      return;
    const pct = hwState.totalPages > 0 ? hwState.loadedPages / hwState.totalPages * 100 : 0;
    progressEl.textContent = `Loading… page ${hwState.loadedPages} / ${hwState.totalPages}`;
    if (progressFillEl)
      progressFillEl.style.width = `${pct}%`;
    if (hwState.loadedPages >= hwState.totalPages && hwState.totalPages > 0) {
      progressEl.textContent = `All ${hwState.totalReviews} reviews loaded`;
      if (progressFillEl)
        progressFillEl.style.width = "100%";
    }
  };
  var loadAllReviews = async (propId) => {
    if (hwState.loading)
      return;
    hwState.loading = true;
    if (loadBtnEl) {
      loadBtnEl.disabled = true;
      loadBtnEl.textContent = "Loading…";
    }
    try {
      const first = await fetchPage(propId, 1, hwState.allLanguages);
      hwState.totalReviews = first.pagination?.totalNumberOfItems ?? first.totalReviews ?? first.count ?? 0;
      hwState.totalPages = first.pagination?.numberOfPages ?? Math.ceil(hwState.totalReviews / ((first.reviews || []).length || 10));
      hwState.reviews = first.reviews || [];
      hwState.loadedPages = 1;
      updateProgress();
      applyFilter();
      const BATCH = 4;
      for (let p = 2;p <= hwState.totalPages; p += BATCH) {
        const batch = [];
        for (let i = 0;i < BATCH && p + i <= hwState.totalPages; i++) {
          batch.push(fetchPage(propId, p + i, hwState.allLanguages));
        }
        const results = await Promise.all(batch);
        for (const r of results) {
          hwState.reviews.push(...r.reviews || []);
          hwState.loadedPages++;
        }
        updateProgress();
        applyFilter();
      }
      if (loadBtnEl) {
        loadBtnEl.textContent = "Reload";
        loadBtnEl.disabled = false;
      }
    } catch (e) {
      if (loadBtnEl) {
        loadBtnEl.textContent = `Error: ${e.message} — Retry`;
        loadBtnEl.disabled = false;
      }
    } finally {
      hwState.loading = false;
    }
  };
  var buildPanel = (propId) => {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
    <button class="hw-rs-close" title="Close">✕</button>
    <div class="hw-rs-header">
      <h2>Review Search</h2>
      <div class="hw-rs-controls">
        <div class="hw-rs-row">
          <input class="hw-rs-input" type="text" placeholder="Regex or plain text…" autocomplete="off" spellcheck="false" />
          <span class="hw-rs-badge match" style="display:none"></span>
          <span class="hw-rs-badge total"></span>
        </div>
        <div class="hw-rs-row">
          <div class="hw-rs-options">
            <label><input type="checkbox" id="hw-rs-cs"> Case sensitive</label>
            <label><input type="checkbox" id="hw-rs-al"> All languages</label>
          </div>
          <select class="hw-rs-sort">
            <option value="date">Newest first</option>
            <option value="score">By score</option>
          </select>
        </div>
        <div class="hw-rs-progress"></div>
        <div class="hw-rs-progress-bar"><div class="hw-rs-progress-fill" style="width:0%"></div></div>
        <button class="hw-rs-load-btn">Load all reviews</button>
      </div>
    </div>
    <div class="hw-rs-list"></div>
  `;
    listEl = panel.querySelector(".hw-rs-list");
    progressEl = panel.querySelector(".hw-rs-progress");
    progressFillEl = panel.querySelector(".hw-rs-progress-fill");
    matchBadgeEl = panel.querySelector(".hw-rs-badge.match");
    totalBadgeEl = panel.querySelector(".hw-rs-badge.total");
    inputEl = panel.querySelector(".hw-rs-input");
    loadBtnEl = panel.querySelector(".hw-rs-load-btn");
    panel.querySelector(".hw-rs-close").addEventListener("click", () => {
      panel.classList.remove("open");
    });
    let debounce;
    inputEl.addEventListener("input", (e) => {
      hwState.query = e.target.value;
      clearTimeout(debounce);
      debounce = setTimeout(applyFilter, 120);
    });
    panel.querySelector("#hw-rs-cs").addEventListener("change", (e) => {
      hwState.caseSensitive = e.target.checked;
      applyFilter();
    });
    panel.querySelector("#hw-rs-al").addEventListener("change", (e) => {
      hwState.allLanguages = e.target.checked;
      hwState.reviews = [];
      hwState.loadedPages = 0;
      hwState.totalPages = 0;
      applyFilter();
    });
    panel.querySelector(".hw-rs-sort").addEventListener("change", (e) => {
      hwState.sortBy = e.target.value;
      applyFilter();
    });
    loadBtnEl.addEventListener("click", () => {
      hwState.reviews = [];
      hwState.loadedPages = 0;
      hwState.totalPages = 0;
      applyFilter();
      loadAllReviews(propId);
    });
    document.body.appendChild(panel);
    return panel;
  };
  var buildToggleButton = (panel) => {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Reviews Search";
    btn.addEventListener("click", () => panel.classList.toggle("open"));
    document.body.appendChild(btn);
    return btn;
  };
  var buildSearchBar = () => {
    const { name, city, country: parsedCountry } = getPropertyDetails();
    if (!name)
      return;
    const country = parsedCountry || getCountry(city);
    const pageParams = new URLSearchParams(window.location.search);
    const guests = Number.parseInt(pageParams.get("guests") ?? "1", 10);
    const getLinks = (propertyName, propertyCity, propertyCountry) => {
      return buildHotelSearchLinks({
        source: "hostelworld",
        propertyName,
        city: propertyCity,
        country: propertyCountry,
        checkin: pageParams.get("from") ?? undefined,
        checkout: pageParams.get("to") ?? undefined,
        guests: Number.isFinite(guests) ? guests : 1
      });
    };
    const linkMeta = new Map([
      ["Google", { cls: "hw-sb-btn-google", icon: "G" }],
      ["Travel", { cls: "hw-sb-btn-travel", icon: "Tr" }],
      ["Maps", { cls: "hw-sb-btn-maps", icon: "M" }],
      ["Booking", { cls: "hw-sb-btn-booking", icon: "B" }],
      ["Super", { cls: "hw-sb-btn-super", icon: "S" }],
      ["TripAdvisor", { cls: "hw-sb-btn-tripadv", icon: "T" }]
    ]);
    const orderedLinks = ["google", "google-travel", "google-maps", "booking", "super", "tripadvisor"].map((service) => getLinks(name, city, country).find((link) => link.service === service)).filter((link) => Boolean(link));
    const bar = renderHotelSearchBar({
      anchor: document.body,
      barId: SEARCH_BAR_ID,
      getLinkClassName: (link) => {
        const meta = linkMeta.get(link.label);
        return meta ? `hw-sb-btn ${meta.cls}` : "hw-sb-btn";
      },
      links: orderedLinks,
      renderLinkContent: (link, anchorEl) => {
        const meta = linkMeta.get(link.label);
        anchorEl.innerHTML = `<span>${meta?.icon ?? ""}</span>${link.label}`;
        anchorEl.title = `${link.label}: ${name}, ${city}`;
      }
    });
    if (!bar)
      return;
    const superLink = bar.querySelector(".hw-sb-btn-super");
    if (!superLink || superLink.dataset.hwSuperRefreshBound === "true")
      return;
    const refreshHref = () => {
      const liveDetails = getPropertyDetails();
      const liveCountry = liveDetails.country || getCountry(liveDetails.city);
      const liveLinks = getLinks(liveDetails.name, liveDetails.city, liveCountry);
      superLink.href = liveLinks.find((link) => link.service === "super")?.href ?? "#";
      superLink.title = `Super: ${liveDetails.name}, ${liveDetails.city}`;
    };
    superLink.dataset.hwSuperRefreshBound = "true";
    refreshHref();
    superLink.addEventListener("mouseenter", refreshHref);
    superLink.addEventListener("focus", refreshHref);
    superLink.addEventListener("click", refreshHref);
  };
  var isDetailPage = () => /\/pwa\/hosteldetails\.php\//.test(window.location.pathname);
  var hwInit = () => {
    if (!isDetailPage())
      return;
    if (document.getElementById(BTN_ID))
      return;
    const propId = getPropertyId();
    if (!propId)
      return;
    injectHwStyles();
    const panel = buildPanel(propId);
    buildToggleButton(panel);
    buildSearchBar();
    if (window.location.search.includes("display=reviews")) {
      panel.classList.add("open");
      loadAllReviews(propId);
    }
  };
  var hwBootstrap = () => {
    watchLocationChange(() => {
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(SEARCH_BAR_ID)?.remove();
      hwInit();
    }, { debounceMs: 600 });
    hwInit();
  };
  if (document.body) {
    hwBootstrap();
  } else {
    document.addEventListener("DOMContentLoaded", hwBootstrap);
  }
})();
