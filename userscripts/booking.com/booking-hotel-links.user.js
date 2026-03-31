// ==UserScript==
// @name                 Booking Hotel Links
// @author               AZ
// @description          adds external hotel search links on Booking.com property pages
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-hotel-links.user.js
// @grant                none
// @match                https://www.booking.com/hotel/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/booking.com/booking-hotel-links.user.js
// @version              0.1.1
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

  // src/booking.com/booking-hotel-links.user.ts
  var exports_booking_hotel_links_user = {};

  // src/lib/dom.ts
  var waitForEl = (selector, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el)
        return resolve(el);
      const endTime = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        const el2 = document.querySelector(selector);
        if (el2) {
          observer.disconnect();
          resolve(el2);
        } else if (Date.now() > endTime) {
          observer.disconnect();
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el2 = document.querySelector(selector);
        if (el2)
          resolve(el2);
        else
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };
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

  // src/lib/dom-observe.ts
  var DEFAULT_INIT = {
    childList: true,
    subtree: true
  };
  var observeDomChanges = (run, opts) => {
    let timer = null;
    let disconnectTimer = null;
    let currentTarget = opts?.root ?? null;
    let currentInit = opts?.observerInit ?? DEFAULT_INIT;
    const disconnect = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (disconnectTimer) {
        window.clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      observer.disconnect();
    };
    const refreshDisconnectTimer = () => {
      if (disconnectTimer)
        window.clearTimeout(disconnectTimer);
      if (!opts?.disconnectAfterMs)
        return;
      disconnectTimer = window.setTimeout(() => {
        disconnect();
      }, opts.disconnectAfterMs);
    };
    const scheduleRun = () => {
      if (timer)
        window.clearTimeout(timer);
      const debounceMs = opts?.debounceMs ?? 0;
      if (debounceMs <= 0) {
        run();
        refreshDisconnectTimer();
        return;
      }
      timer = window.setTimeout(() => {
        timer = null;
        run();
        refreshDisconnectTimer();
      }, debounceMs);
    };
    const observer = new MutationObserver((mutations) => {
      if (opts?.shouldRun && !opts.shouldRun(mutations))
        return;
      scheduleRun();
    });
    const observe = (target, options) => {
      const nextTarget = target ?? currentTarget ?? document.body;
      if (!nextTarget)
        return;
      currentTarget = nextTarget;
      currentInit = options ?? currentInit;
      observer.disconnect();
      observer.observe(nextTarget, currentInit);
      refreshDisconnectTimer();
    };
    if (opts?.runImmediately)
      scheduleRun();
    return {
      disconnect,
      observe
    };
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
  var runWhenReady = (fn) => {
    if (document.body) {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  };

  // src/booking.com/booking-hotel-links.helpers.ts
  var cleanText = (value) => {
    return value.replace(/\s+/g, " ").trim();
  };
  var cleanBookingHotelName = (value) => {
    let next = cleanText(value).replace(/\s+Deals$/i, "").trim();
    while (/\s+\([^)]*\)$/i.test(next)) {
      next = next.replace(/\s+\([^)]*\)$/i, "").trim();
    }
    return next;
  };
  var getBookingMetaTitleParts = (value) => {
    const parts = cleanText(value).split(",").map((part) => cleanText(part));
    return {
      propertyName: parts[0] ?? "",
      city: parts[1] ?? "",
      country: parts[2] ?? ""
    };
  };
  var cleanBookingAddress = (value) => {
    return cleanText(value).replace(/(Excellent location|Real guests|show map).*$/i, "").replace(/After booking.*$/i, "").replace(/[–-]\s*$/u, "").trim();
  };
  var hasHotelType = (value) => {
    if (Array.isArray(value)) {
      return value.some((entry) => String(entry).toLowerCase() === "hotel");
    }
    return String(value).toLowerCase() === "hotel";
  };
  var asRecord = (value) => {
    return value !== null && typeof value === "object" ? value : null;
  };
  var parseJsonScripts = (scripts) => {
    return scripts.flatMap((script) => {
      try {
        const parsed = JSON.parse(script);
        if (Array.isArray(parsed)) {
          return parsed.map(asRecord).filter((item) => item !== null);
        }
        const record = asRecord(parsed);
        return record ? [record] : [];
      } catch (_err) {
        return [];
      }
    });
  };
  var getBookingHotelJsonLdData = (scripts) => {
    const hotel = parseJsonScripts(scripts).find((item) => hasHotelType(item["@type"]));
    if (!hotel)
      return {};
    const address = asRecord(hotel.address);
    return {
      propertyName: cleanBookingHotelName(String(hotel.name ?? "")),
      address: cleanBookingAddress(String(address?.streetAddress ?? "")),
      city: cleanText(String(address?.addressLocality ?? "")),
      country: cleanText(String(address?.addressCountry ?? ""))
    };
  };

  // src/booking.com/booking-hotel-links.user.ts
  var STYLE_ID = "booking-hotel-links-style";
  var BAR_ID = "booking-hotel-links-bar";
  var CSS = `
  #${BAR_ID} {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  #${BAR_ID} a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(26, 26, 26, 0.14);
    background: #fff;
    color: #1a1a1a;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 2px 10px rgba(17, 34, 68, 0.08);
  }

  #${BAR_ID} a:hover {
    border-color: #006ce4;
    color: #006ce4;
    background: #f3f8ff;
  }
`;
  var getMetaTitleParts = () => {
    return getBookingMetaTitleParts(document.querySelector('meta[property="og:title"]')?.content ?? "");
  };
  var getJsonLdContext = () => {
    return getBookingHotelJsonLdData(Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script) => script.textContent ?? "").filter(Boolean));
  };
  var getAddressText = () => {
    return cleanBookingAddress(document.querySelector('[data-testid="PropertyHeaderAddressDesktop-wrapper"]')?.textContent ?? "");
  };
  var getHotelContext = () => {
    const metaParts = getMetaTitleParts();
    const jsonLd = getJsonLdContext();
    const h1 = cleanBookingHotelName(document.querySelector("h1")?.textContent ?? "");
    const urlParams = new URLSearchParams(window.location.search);
    const adults = Number.parseInt(urlParams.get("group_adults") ?? "1", 10);
    return {
      source: "booking",
      propertyName: jsonLd.propertyName ?? h1 ?? metaParts.propertyName ?? "",
      city: metaParts.city || jsonLd.city || "",
      country: metaParts.country || jsonLd.country || undefined,
      address: jsonLd.address ?? getAddressText(),
      checkin: urlParams.get("checkin") ?? undefined,
      checkout: urlParams.get("checkout") ?? undefined,
      guests: Number.isFinite(adults) ? adults : 1
    };
  };
  var getHeaderAnchor = () => {
    const address = document.querySelector('[data-testid="PropertyHeaderAddressDesktop-wrapper"]');
    if (address?.parentElement instanceof HTMLElement)
      return address.parentElement;
    const titleWrap = document.querySelector(".hp__hotel-title");
    if (titleWrap)
      return titleWrap;
    return document.querySelector("h1")?.parentElement ?? null;
  };
  var ensureSearchBar = () => {
    const anchor = getHeaderAnchor();
    const context = getHotelContext();
    if (!anchor || !context.propertyName) {
      document.getElementById(BAR_ID)?.remove();
      return false;
    }
    injectCSS(STYLE_ID, CSS);
    const links = buildHotelSearchLinks(context).filter((link) => link.service !== "booking");
    if (!links.length) {
      document.getElementById(BAR_ID)?.remove();
      return false;
    }
    return Boolean(renderHotelSearchBar({
      anchor,
      barId: BAR_ID,
      links
    }));
  };
  var main = () => {
    ensureSearchBar();
    waitForEl("h1", 1e4).then(() => {
      const observer = observeDomChanges(ensureSearchBar, {
        root: document.body,
        debounceMs: 120,
        disconnectAfterMs: 20000,
        runImmediately: true
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }).catch(() => {});
  };
  runWhenReady(main);
})();
