// ==UserScript==
// @name                 Super.com Enhancer
// @author               AZ
// @description          map pins show total price, list cards bold total, hotel detail adds search buttons
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/super.com/super-com.user.js
// @grant                none
// @match                https://www.super.com/home/travel*
// @match                https://www.super.com/travel/*
// @namespace            https://latentbyte.com/products
// @run-at               document-start
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/super.com/super-com.user.js
// @version              1.0.3
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
    (document.head ?? document.documentElement).appendChild(style);
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

  // src/lib/text.ts
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/lib/hotel-search.ts
  var cleanPart = (value) => normalizeWhitespace(value);
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
    const roundTrip = new Date(0);
    roundTrip.setUTCFullYear(year, month - 1, day);
    const utcMs = roundTrip.getTime();
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
    return Number.isFinite(guests) && (guests ?? 0) > 0 ? Math.max(1, Math.floor(guests)) : 1;
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
  var buildHotelSearchBarCss = (barSelector, opts = {}) => {
    const border = opts.border ?? "1px solid rgba(26, 26, 26, 0.14)";
    const boxShadow = opts.boxShadow ? `box-shadow: ${opts.boxShadow};` : "";
    const color = opts.color ?? "#1a1a1a";
    const fontSize = opts.fontSize ?? "12px";
    const fontWeight = opts.fontWeight ?? 700;
    const gap = opts.gap ?? "8px";
    const hoverBackground = opts.hoverBackground ?? "#f3f8ff";
    const hoverBorder = opts.hoverBorder ?? "#006ce4";
    const hoverColor = opts.hoverColor ?? "#006ce4";
    const linkGap = opts.linkGap ?? "0";
    const marginTop = opts.marginTop ?? "12px";
    const minHeight = opts.minHeight ?? "34px";
    const padding = opts.padding ?? "0 12px";
    const transition = opts.transition ? `transition: ${opts.transition};` : "";
    return `
  ${barSelector} {
    display: flex;
    flex-wrap: wrap;
    gap: ${gap};
    margin-top: ${marginTop};
  }

  ${barSelector} a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${linkGap};
    min-height: ${minHeight};
    padding: ${padding};
    border-radius: 999px;
    border: ${border};
    background: #fff;
    color: ${color};
    font-size: ${fontSize};
    font-weight: ${fontWeight};
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    ${boxShadow}
    ${transition}
  }

  ${barSelector} a:hover {
    border-color: ${hoverBorder};
    color: ${hoverColor};
    background: ${hoverBackground};
  }
`;
  };
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

  // src/super.com/super-com.helpers.ts
  var HOTEL_LAUNCHER_PARAM_KEYS = [
    "checkin",
    "checkout",
    "guests",
    "platforms",
    "tab",
    "loc_name",
    "loc_type",
    "loc_country",
    "loc_cc",
    "loc_city",
    "loc_state"
  ];
  var SUPER_LOOKUP_PARAM_KEYS = [
    "super_lookup",
    "super_query",
    "super_name",
    "super_city",
    "super_country"
  ];
  var SUPER_TRAVEL_PARAM_KEYS = ["checkin_at", "checkout_at", "num_adults", "children"];
  var COUNTRY_CODE_ALIASES = new Map([
    ["u.k.", "gb"],
    ["uk", "gb"],
    ["u.s.", "us"],
    ["u.s.a.", "us"],
    ["usa", "us"],
    ["united states of america", "us"],
    ["u.a.e.", "ae"],
    ["uae", "ae"]
  ]);
  var cleanPart2 = (value) => normalizeWhitespace(value);
  var getPositiveGuestCount2 = (value) => {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? String(Math.max(1, Math.floor(count))) : "1";
  };
  var firstClean = (...values) => {
    return values.map((value) => cleanPart2(value)).find(Boolean) ?? "";
  };
  var getDestinationParts = (destination) => {
    return cleanPart2(destination).split(",").map((part) => cleanPart2(part)).filter(Boolean);
  };
  var hasIncomingTravelParams = (params) => {
    return [...HOTEL_LAUNCHER_PARAM_KEYS, ...SUPER_TRAVEL_PARAM_KEYS].some((key) => params.has(key));
  };
  var slugify = (value) => {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  };
  var getCountryCode = (countryName) => {
    const target = cleanPart2(countryName).toLowerCase();
    if (!target)
      return "";
    const alias = COUNTRY_CODE_ALIASES.get(target);
    if (alias)
      return alias;
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    if (/^[a-z]{2}$/.test(target)) {
      const codeName = cleanPart2(dn.of(target.toUpperCase())).toLowerCase();
      if (codeName && codeName !== target && codeName !== "unknown region")
        return target;
    }
    for (let i = 65;i <= 90; i += 1) {
      for (let j = 65;j <= 90; j += 1) {
        const code = String.fromCharCode(i, j);
        if (cleanPart2(dn.of(code)).toLowerCase() === target)
          return code.toLowerCase();
      }
    }
    return "";
  };
  var getRedirectParams = (params) => {
    const next = new URLSearchParams(params);
    const checkin = cleanPart2(next.get("checkin_at") ?? next.get("checkin"));
    const checkout = cleanPart2(next.get("checkout_at") ?? next.get("checkout"));
    const adults = cleanPart2(next.get("num_adults") ?? next.get("guests"));
    if (checkin)
      next.set("checkin_at", checkin);
    if (checkout)
      next.set("checkout_at", checkout);
    next.set("num_adults", getPositiveGuestCount2(adults));
    if (!next.has("children"))
      next.set("children", "[]");
    if (!next.has("expand_params"))
      next.set("expand_params", "false");
    [...SUPER_LOOKUP_PARAM_KEYS, ...HOTEL_LAUNCHER_PARAM_KEYS].forEach((key) => {
      next.delete(key);
    });
    return next;
  };
  var getSuperLookupRequest = (params) => {
    const destination = cleanPart2(params.get("destination"));
    const markedLookup = params.get("super_lookup") === "1";
    if (!markedLookup && !(destination && hasIncomingTravelParams(params)))
      return null;
    const parts = getDestinationParts(destination);
    const city = firstClean(params.get("super_city"), params.get("loc_city"), parts[0]);
    const country = firstClean(params.get("super_country"), params.get("loc_country"), parts.length > 1 ? parts.at(-1) : "");
    const countryCode = firstClean(params.get("loc_cc")) || getCountryCode(country);
    const name = cleanPart2(params.get("super_name"));
    const query = firstClean(params.get("super_query"), destination, [name, city].filter(Boolean).join(" "));
    if (!query && !destination)
      return null;
    return {
      city,
      country,
      countryCode,
      destination,
      name,
      query,
      redirectParams: getRedirectParams(params)
    };
  };

  // src/super.com/super-com.user.ts
  var SUPER_LINKS_STYLE_ID = "sc-search-links-style";
  var SUPER_LINKS_BAR_ID = "sc-search-links-bar";
  var SUPER_LINKS_CSS = buildHotelSearchBarCss(`#${SUPER_LINKS_BAR_ID}`, {
    border: "1.5px solid #e0e0e0",
    color: "#333",
    fontSize: "0.78rem",
    fontWeight: 600,
    hoverBackground: "#fff0f7",
    hoverBorder: "#e91e8c",
    hoverColor: "#e91e8c",
    linkGap: "4px",
    marginTop: "10px",
    minHeight: "0",
    padding: "4px 10px",
    transition: "border-color 0.15s, background 0.15s"
  });
  var priceMap = {};
  var lookupStartedKey = "";
  var norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  var getTokens = (s) => norm(s).split(/\s+/).filter((token) => token.length >= 3);
  var countTokenOverlap = (left, right) => {
    const leftTokens = new Set(getTokens(left));
    const rightTokens = new Set(getTokens(right));
    let count = 0;
    leftTokens.forEach((token) => {
      if (rightTokens.has(token))
        count++;
    });
    return count;
  };
  var hasStrongHotelNameMatch = (expectedName, candidateName) => {
    const expected = norm(expectedName);
    const candidate = norm(candidateName);
    if (!expected || !candidate)
      return false;
    if (expected === candidate || expected.includes(candidate) || candidate.includes(expected)) {
      return true;
    }
    const overlap = countTokenOverlap(expected, candidate);
    const expectedTokenCount = getTokens(expected).length;
    return overlap >= 2 && expectedTokenCount > 0 && overlap >= expectedTokenCount - 1;
  };
  var getCookie = (name) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  };
  var queryOmnisearch = async (query) => {
    const params = new URLSearchParams({
      input: JSON.stringify({
        query,
        timestamp: new Date().toISOString(),
        userProperties: "",
        deviceId: getCookie("exp_uuid") || crypto.randomUUID()
      })
    });
    const res = await fetch(`/snapcommerce/api/trpc/recommender.queryAddressOmnisearch?${params}`);
    if (!res.ok)
      throw new Error(`super omnisearch failed: ${res.status}`);
    const data = await res.json();
    return data.result?.data ?? [];
  };
  var pickLookupHotel = (items, opts) => {
    const name = norm(opts.name);
    const city = norm(opts.city);
    const country = norm(opts.country);
    const destination = norm(opts.destination);
    let best = null;
    let bestScore = -1;
    items.forEach((item) => {
      if (!item.hotel_id || item.type !== "hotel")
        return;
      const itemName = norm(item.name ?? "");
      const itemCity = norm(item.city ?? "");
      const strongNameMatch = hasStrongHotelNameMatch(name, itemName);
      let score = 0;
      if (strongNameMatch)
        score += 120;
      if (city && (itemCity === city || itemCity.includes(city) || city.includes(itemCity)))
        score += 50;
      if (country && destination.includes(country))
        score += 5;
      if (destination && destination.includes(itemName))
        score += 20;
      if (destination && destination.includes(itemCity))
        score += 10;
      if (name && !strongNameMatch)
        score -= 60;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    });
    return { item: best, score: bestScore };
  };
  var pickCountryMatchedRegion = (items, city, country) => {
    const regionItems = items.filter((item) => item.type === "region" && item.region_type === "city");
    const cityMatches = regionItems.filter((item) => {
      const itemName = norm(item.name ?? "");
      const cityNorm = norm(city);
      return itemName === cityNorm || itemName.includes(cityNorm) || cityNorm.includes(itemName);
    });
    const countryNorm = norm(country);
    if (countryNorm) {
      const countryMatch = cityMatches.find((item) => norm(item.country ?? "") === countryNorm) ?? null;
      if (countryMatch)
        return countryMatch;
    }
    return cityMatches[0] ?? null;
  };
  var findLookupRegion = async (query, name, city, country) => {
    const queryItems = await queryOmnisearch(query);
    const hotel = pickLookupHotel(queryItems, { name, city, country, destination: query });
    if (hotel.item?.hotel_id && hotel.score >= 120)
      return { hotel: hotel.item, region: null };
    const directRegion = pickCountryMatchedRegion(queryItems, city, country);
    if (directRegion)
      return { hotel: null, region: directRegion };
    const cityQuery = city.trim();
    if (!cityQuery)
      return { hotel: null, region: null };
    const cityItems = await queryOmnisearch(cityQuery);
    return { hotel: null, region: pickCountryMatchedRegion(cityItems, city, country) };
  };
  var maybeResolveSuperLookup = () => {
    if (location.pathname !== "/home/travel")
      return;
    const attemptKey = `${location.pathname}?${location.search}`;
    if (lookupStartedKey === attemptKey)
      return;
    const request = getSuperLookupRequest(new URLSearchParams(location.search));
    if (!request)
      return;
    lookupStartedKey = attemptKey;
    findLookupRegion(request.query || request.destination, request.name, request.city, request.country).then(({ hotel, region }) => {
      const params = new URLSearchParams(request.redirectParams);
      if (hotel?.hotel_id) {
        location.replace(`/travel/hotels/${hotel.hotel_id}?${params.toString()}`);
        return;
      }
      const cityName = region?.name ?? request.city ?? "";
      const countryCode = request.countryCode || getCountryCode(request.country) || getCountryCode(region?.country ?? "") || "us";
      const citySlug = cityName ? slugify(cityName) : "hotels";
      if (cityName) {
        const regionId = region?.id == null ? "0" : String(region.id);
        location.replace(`/travel/regions/${regionId}/cities/${countryCode}/${citySlug}-hotels?${params.toString()}`);
        return;
      }
      const destinationSlug = request.destination ? slugify(request.destination.split(",")[0] ?? "") : "";
      const fallbackSlug = destinationSlug || "hotels";
      location.replace(`/travel/regions/0/cities/${countryCode}/${fallbackSlug}-hotels?${params.toString()}`);
    }).catch(() => {
      const fallbackParams = new URLSearchParams(request.redirectParams);
      const fallbackSlug = request.destination ? slugify(request.destination.split(",")[0] ?? "") : "hotels";
      const fallbackCountryCode = request.countryCode || getCountryCode(request.country) || getCountryCode(request.city) || "us";
      location.replace(`/travel/regions/0/cities/${fallbackCountryCode}/${fallbackSlug}-hotels?${fallbackParams.toString()}`);
    });
  };
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
  var runEnhancements = () => {
    maybeResolveSuperLookup();
    enhanceListCards();
    refreshMapPins();
    enhanceDetailPage();
    enhanceDetailPrices();
    compactDetailPriceCards();
    maybeInjectMapButton();
  };
  var startObserver = () => {
    const superObserver = observeDomChanges(runEnhancements, {
      root: document.body,
      shouldRun: (mutations) => mutations.some((mutation) => mutation.addedNodes.length > 0)
    });
    superObserver.observe(document.body, { childList: true, subtree: true });
    runEnhancements();
  };
  maybeResolveSuperLookup();
  runWhenReady(() => {
    maybeResolveSuperLookup();
    startObserver();
  });
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
    const params = new URLSearchParams(location.search);
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
    injectCSS(SUPER_LINKS_STYLE_ID, SUPER_LINKS_CSS);
    const buttons = buildHotelSearchLinks({
      source: "super",
      propertyName: hotelName,
      city: "",
      address,
      checkin: params.get("checkin_at") ?? undefined,
      checkout: params.get("checkout_at") ?? undefined,
      guests: Number.parseInt(params.get("num_adults") ?? "1", 10)
    }).filter((link) => link.service !== "super").map((link) => ({
      ...link,
      icon: link.service === "google" ? "\uD83D\uDD0D" : link.service === "google-travel" ? "\uD83D\uDECF" : link.service === "google-maps" ? "\uD83D\uDCCD" : link.service === "booking" ? "\uD83C\uDFE8" : "⭐"
    }));
    renderHotelSearchBar({
      anchor: viewLocRow,
      barId: SUPER_LINKS_BAR_ID,
      barAttrs: { "data-sc-enhanced": "1" },
      getLinkText: (link) => {
        const match = buttons.find((button) => button.href === link.href && button.service === link.service);
        return match ? `${match.icon} ${match.label}` : link.label;
      },
      links: buttons,
      placement: "after"
    });
  };
})();
