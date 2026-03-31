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
// @version              1.0.1
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

  // src/super.com/super-com.user.ts
  var SUPER_LINKS_STYLE_ID = "sc-search-links-style";
  var SUPER_LINKS_BAR_ID = "sc-search-links-bar";
  var SUPER_LINKS_CSS = `
  #${SUPER_LINKS_BAR_ID} {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  #${SUPER_LINKS_BAR_ID} a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1.5px solid #e0e0e0;
    background: #fff;
    color: #333;
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  #${SUPER_LINKS_BAR_ID} a:hover {
    border-color: #e91e8c;
    color: #e91e8c;
    background: #fff0f7;
  }
`;
  var priceMap = {};
  var lookupStarted = false;
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
  var slugify = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  var getCookie = (name) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  };
  var getCountryCode = (countryName) => {
    const target = norm(countryName);
    if (!target)
      return "";
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    for (let i = 65;i <= 90; i++) {
      for (let j = 65;j <= 90; j++) {
        const code = String.fromCharCode(i, j);
        if (norm(dn.of(code) ?? "") === target)
          return code.toLowerCase();
      }
    }
    return "";
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
  var maybeResolveHostelworldLookup = () => {
    if (lookupStarted)
      return;
    if (location.pathname !== "/home/travel")
      return;
    const params = new URLSearchParams(location.search);
    if (params.get("super_lookup") !== "1")
      return;
    const destination = params.get("destination") ?? "";
    const query = params.get("super_query") ?? [params.get("super_name") ?? "", params.get("super_city") ?? ""].filter(Boolean).join(" ");
    const name = params.get("super_name") ?? "";
    const city = params.get("super_city") ?? "";
    const country = params.get("super_country") ?? "";
    if (!query && !destination)
      return;
    lookupStarted = true;
    findLookupRegion(query || destination, name, city, country).then(({ hotel, region }) => {
      params.delete("super_lookup");
      params.delete("super_query");
      params.delete("super_name");
      params.delete("super_city");
      params.delete("super_country");
      if (hotel?.hotel_id) {
        location.replace(`/travel/hotels/${hotel.hotel_id}?${params.toString()}`);
        return;
      }
      const countryCode = getCountryCode(country);
      const citySlug = slugify(region?.name ?? city);
      if (region?.id && countryCode && citySlug) {
        location.replace(`/travel/regions/${region.id}/cities/${countryCode}/${citySlug}-hotels?${params.toString()}`);
      }
    }).catch(() => {});
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
  if (document.body) {
    maybeResolveHostelworldLookup();
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      maybeResolveHostelworldLookup();
      startObserver();
    });
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
