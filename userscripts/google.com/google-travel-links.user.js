// ==UserScript==
// @name                 Google Travel Links
// @author               AZ
// @description          adds Booking and Super shortcuts to Google Travel hotel pages
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-travel-links.user.js
// @grant                none
// @match                https://www.google.com/travel/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-travel-links.user.js
// @version              0.1.0
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

  // src/google.com/google-travel-links.user.ts
  var exports_google_travel_links_user = {};

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

  // src/google.com/google-travel-links.helpers.ts
  var cleanPart2 = (value) => value.replace(/\s+/g, " ").trim();
  var looksLikeAdminArea = (value) => {
    return /\b(province|state|region|county|district|prefecture|department|territory|parish|oblast|voivodeship)\b/i.test(value) || /^[A-Z]{2,3}$/.test(value.trim());
  };
  var MONTH_MAP = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };
  var toIsoDate = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  var cleanGoogleTravelHotelName = (value) => {
    return cleanPart2(value).replace(/\s+-\s+Google hotels?$/i, "").replace(/\s+-\s+Google Travel$/i, "");
  };
  var cleanGoogleTravelAddress = (value) => {
    return cleanPart2(value).replace(/\s*[•·]\s*/g, " • ").replace(/\s*(?:[•·]\s*)?\+\d[\d\s()-]{5,}.*$/u, "").trim();
  };
  var parseGoogleTravelLocation = (address) => {
    const parts = cleanGoogleTravelAddress(address).split(",").map((part) => cleanPart2(part)).filter(Boolean);
    if (!parts.length) {
      return { city: "" };
    }
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined;
    const localParts = country ? parts.slice(0, -1) : parts;
    const city = [...localParts].reverse().find((part) => !looksLikeAdminArea(part)) ?? localParts[localParts.length - 1] ?? "";
    return {
      city,
      country
    };
  };
  var parseGoogleTravelDateLabel = (value, now = new Date) => {
    const match = /^(?:[A-Za-z]{3,9},\s+)?(?<month>[A-Za-z]{3,9})\s+(?<day>\d{1,2})$/u.exec(cleanPart2(value));
    if (!match?.groups)
      return;
    const month = MONTH_MAP[match.groups.month.toLowerCase()];
    const day = Number.parseInt(match.groups.day, 10);
    if (!Number.isInteger(month) || !Number.isInteger(day))
      return;
    const currentYear = now.getFullYear();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const candidates = [currentYear, currentYear + 1].flatMap((year) => {
      const candidate = new Date(Date.UTC(year, month, day));
      if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month || candidate.getUTCDate() !== day) {
        return [];
      }
      return [{ year, utcMs: candidate.getTime() }];
    });
    const upcoming = candidates.find((candidate) => candidate.utcMs >= todayUtc - 86400000);
    const resolved = upcoming ?? candidates[0];
    if (!resolved)
      return;
    return toIsoDate(resolved.year, month, day);
  };
  var parseGoogleTravelGuestCount = (value) => {
    const parsed = Number.parseInt(cleanPart2(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  // src/google.com/google-travel-links.user.ts
  var STYLE_ID = "google-travel-links-style";
  var BAR_ID = "google-travel-links-bar";
  var CSS = `
  #${BAR_ID} {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  #${BAR_ID} a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid #dadce0;
    border-radius: 999px;
    background: #fff;
    color: #202124;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
  }

  #${BAR_ID} a:hover {
    border-color: #1a73e8;
    background: #f8fbff;
    color: #1a73e8;
  }
`;
  var LINK_ORDER = ["booking", "super"];
  var getPageHotelName = () => {
    const rawTitle = document.title;
    const cleaned = cleanGoogleTravelHotelName(rawTitle);
    return cleaned === rawTitle ? "" : cleaned;
  };
  var getHotelTitleEl = () => {
    const pageHotelName = getPageHotelName();
    if (!pageHotelName)
      return null;
    const headings = Array.from(document.querySelectorAll("h1"));
    return headings.find((heading) => cleanGoogleTravelHotelName(heading.textContent ?? "") === pageHotelName) ?? headings.find((heading) => {
      const text = cleanGoogleTravelHotelName(heading.textContent ?? "");
      return Boolean(text && !["Nearby places"].includes(text));
    }) ?? null;
  };
  var getHeaderAnchor = () => {
    const titleEl = getHotelTitleEl();
    if (!titleEl)
      return null;
    return titleEl.parentElement ?? titleEl;
  };
  var getAddressFromContactSection = () => {
    const heading = Array.from(document.querySelectorAll("h3")).find((el) => el.textContent?.trim() === "Address & contact information");
    if (!heading?.parentElement)
      return "";
    const line = Array.from(heading.parentElement.children).find((child) => {
      if (child === heading)
        return false;
      const text = cleanGoogleTravelAddress(child.textContent ?? "");
      return Boolean(text && text.includes(","));
    });
    return cleanGoogleTravelAddress(line?.textContent ?? "");
  };
  var getAddressFromHeader = () => {
    const titleEl = getHotelTitleEl();
    if (!titleEl)
      return "";
    for (let depth = 0, root = titleEl.parentElement;root && depth < 4; depth += 1, root = root.parentElement) {
      const candidate = Array.from(root.querySelectorAll("span, div")).find((el) => {
        const text2 = cleanGoogleTravelAddress(el.textContent ?? "");
        return Boolean(text2 && text2.includes(",") && text2.length < 120 && !/website|directions|share|check availability|view more photos|review/i.test(text2));
      });
      const text = cleanGoogleTravelAddress(candidate?.textContent ?? "");
      if (text)
        return text;
    }
    return "";
  };
  var getAdults = () => {
    const value = document.querySelector('[aria-label="Adults"] [jsname="yvdD4c"]')?.textContent ?? document.querySelector('[aria-label="Adults"] [aria-live="polite"]')?.textContent ?? "";
    return parseGoogleTravelGuestCount(value);
  };
  var getHotelContext = () => {
    const propertyName = getPageHotelName() || cleanGoogleTravelHotelName(getHotelTitleEl()?.textContent ?? "");
    const address = getAddressFromContactSection() || getAddressFromHeader();
    const { city, country } = parseGoogleTravelLocation(address);
    const now = new Date;
    return {
      source: "google-travel",
      propertyName,
      city,
      country,
      address: address || undefined,
      checkin: parseGoogleTravelDateLabel(document.querySelector('input[aria-label="Check-in"]')?.value ?? "", now),
      checkout: parseGoogleTravelDateLabel(document.querySelector('input[aria-label="Check-out"]')?.value ?? "", now),
      guests: getAdults()
    };
  };
  var getShortcutLinks = (context) => {
    const links = buildHotelSearchLinks(context);
    return LINK_ORDER.map((service) => links.find((link) => link.service === service)).filter((link) => Boolean(link));
  };
  var ensureTravelLinks = () => {
    const anchor = getHeaderAnchor();
    const context = getHotelContext();
    if (!anchor || !context.propertyName || !context.address && !context.city) {
      document.getElementById(BAR_ID)?.remove();
      return false;
    }
    const links = getShortcutLinks(context);
    if (!links.length) {
      document.getElementById(BAR_ID)?.remove();
      return false;
    }
    injectCSS(STYLE_ID, CSS);
    return Boolean(renderHotelSearchBar({
      anchor,
      barId: BAR_ID,
      links,
      placement: "after"
    }));
  };
  var main = () => {
    ensureTravelLinks();
    const observer = observeDomChanges(ensureTravelLinks, {
      root: document.body,
      debounceMs: 150,
      shouldRun: (mutations) => mutations.some((mutation) => mutation.addedNodes.length > 0)
    });
    observer.observe(document.body, { childList: true, subtree: true });
    watchLocationChange(() => {
      window.setTimeout(() => {
        ensureTravelLinks();
      }, 80);
    }, { debounceMs: 120 });
  };
  runWhenReady(main);
})();
