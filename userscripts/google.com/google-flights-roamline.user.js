// ==UserScript==
// @name                 Google Flights Roamline Climate
// @author               AZ
// @connect              roamline.lbyte.app
// @description          shows Roamline's usual weather for the travel month on Google Flights Explore destinations
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-flights-roamline.user.js
// @grant                GM_xmlhttpRequest
// @grant                GM_getValue
// @grant                GM_setValue
// @license              MIT
// @match                https://www.google.com/travel/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/google.com/google-flights-roamline.user.js
// @version              0.3.0
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

  // src/google.com/google-flights-roamline.helpers.ts
  var normalizePlaceName = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  var buildCityIndex = (cities) => {
    const index = new Map;
    for (const city of cities) {
      const key = normalizePlaceName(city.name);
      const bucket = index.get(key) ?? [];
      bucket.push(city);
      index.set(key, bucket);
    }
    return index;
  };
  var matchCity = (index, name) => {
    const found = index.get(normalizePlaceName(name));
    return found?.length === 1 ? found[0] : null;
  };
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var parseTripStartMonth = (label) => {
    const match = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.exec(label);
    if (!match)
      return null;
    return MONTHS.indexOf(match[1].toLowerCase()) + 1;
  };
  var conditionsOf = (month) => {
    if (month.snowDays >= 5)
      return "snow";
    if (month.rainDays >= 15)
      return "rain";
    const sunShare = month.daylightH > 0 ? month.sunshineH / month.daylightH : 0;
    if (sunShare >= 0.6 && month.rainDays < 8)
      return "sun";
    if (sunShare < 0.35)
      return "cloud";
    return "partly";
  };
  var CONDITION_LABELS = {
    sun: { icon: "☀️", label: "Mostly sunny" },
    partly: { icon: "⛅", label: "Sun and cloud" },
    cloud: { icon: "☁️", label: "Mostly cloudy" },
    rain: { icon: "\uD83C\uDF27️", label: "Rainy" },
    snow: { icon: "❄️", label: "Snowy" }
  };
  var toUnit = (celsius, unit) => Math.round(unit === "F" ? celsius * 9 / 5 + 32 : celsius);
  var buildClimateNugget = (month, unit) => {
    const { icon, label } = CONDITION_LABELS[conditionsOf(month)];
    const rainDays = Math.round(month.rainDays);
    return {
      icon,
      conditions: label,
      temps: `${toUnit(month.tempMinC, unit)}-${toUnit(month.tempMaxC, unit)}°${unit}`,
      rain: `${rainDays} rain day${rainDays === 1 ? "" : "s"}`,
      sun: `${Math.round(month.sunshineH)}h sun`
    };
  };
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  // src/google.com/google-flights-roamline.user.ts
  var ROAMLINE = "https://roamline.lbyte.app";
  var STYLE_ID = "roamline-climate-style";
  var NUGGET_CLASS = "roamline-climate";
  var DAY_MS = 24 * 60 * 60000;
  var CITIES_TTL_MS = DAY_MS;
  var READY_TTL_MS = 30 * DAY_MS;
  var MISSING_TTL_MS = DAY_MS;
  var MAX_PATHS = 50;
  var CITIES_KEY = "roamline-cities";
  var CLIMATE_KEY = "roamline-climate";
  var sels = {
    card: "li[data-code]",
    name: "h3",
    marker: "div[data-mid]",
    markerPrice: '[jsname="qCDwBb"]'
  };
  var CSS = `
.${NUGGET_CLASS} {
  display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px;
  margin-top: 4px; font-size: 12px; line-height: 16px; color: inherit; opacity: 0.85;
}
.${NUGGET_CLASS} a { color: #8ab4f8; text-decoration: none; white-space: nowrap; }
.${NUGGET_CLASS} a:hover { text-decoration: underline; }
.${NUGGET_CLASS}.is-compact {
  display: block; margin-top: 1px; font-size: 11px; line-height: 14px; white-space: nowrap;
}
`;
  var UNIT = /^en-(US|LR|MM)\b/i.test(navigator.language) ? "F" : "C";
  var readJson = (key, fallback) => {
    try {
      const raw = GM_getValue(key, "");
      return raw ? JSON.parse(raw) : fallback;
    } catch (_e) {
      return fallback;
    }
  };
  var writeJson = (key, value) => {
    try {
      GM_setValue(key, JSON.stringify(value));
    } catch (_e) {}
  };
  var FAILURE_PAUSE_MS = 10 * 60000;
  var blockedUntil = 0;
  var pauseAfterFailure = () => {
    blockedUntil = Date.now() + FAILURE_PAUSE_MS;
  };
  var getJson = (path) => {
    if (Date.now() < blockedUntil)
      return Promise.resolve(null);
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `${ROAMLINE}${path}`,
        headers: { accept: "application/json" },
        timeout: 15000,
        onload: (resp) => {
          if (resp.status === 429) {
            const retry = /^retry-after:\s*(\d+)/im.exec(resp.responseHeaders);
            blockedUntil = Date.now() + Number(retry?.[1] ?? 600) * 1000;
            console.warn(`[roamline] rate limited, pausing ${retry?.[1] ?? 600}s`);
            resolve(null);
            return;
          }
          if (resp.status !== 200) {
            console.warn(`[roamline] ${path} answered ${resp.status}`);
            pauseAfterFailure();
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(resp.responseText));
          } catch (_e) {
            pauseAfterFailure();
            resolve(null);
          }
        },
        onerror: () => {
          pauseAfterFailure();
          resolve(null);
        },
        ontimeout: () => {
          pauseAfterFailure();
          resolve(null);
        }
      });
    });
  };
  var cityIndex = null;
  var loadCityIndex = () => {
    cityIndex ??= (async () => {
      const cached = readJson(CITIES_KEY, null);
      if (cached && cached.until > Date.now())
        return buildCityIndex(cached.value);
      const fresh = await getJson("/api/public/places/map");
      if (!fresh) {
        cityIndex = null;
        return cached ? buildCityIndex(cached.value) : null;
      }
      writeJson(CITIES_KEY, { until: Date.now() + CITIES_TTL_MS, value: fresh.cities });
      return buildCityIndex(fresh.cities);
    })();
    return cityIndex;
  };
  var climateCache = readJson(CLIMATE_KEY, {});
  var ttlOf = (climate) => {
    if (climate.status === "ready")
      return READY_TTL_MS;
    if (climate.status === "pending")
      return climate.retryAfterSeconds * 1000;
    return MISSING_TTL_MS;
  };
  var cachedClimate = (path) => {
    const hit = climateCache[path];
    return hit && hit.until > Date.now() ? hit.value : null;
  };
  var inFlight = new Set;
  var retryTimer = null;
  var fetchClimate = async (paths) => {
    const wanted = paths.filter((path) => !cachedClimate(path) && !inFlight.has(path));
    if (wanted.length === 0)
      return false;
    for (const path of wanted)
      inFlight.add(path);
    try {
      for (let i = 0;i < wanted.length; i += MAX_PATHS) {
        const batch = wanted.slice(i, i + MAX_PATHS);
        const query = batch.map(encodeURIComponent).join(",");
        const body = await getJson(`/api/public/places/climate?paths=${query}`);
        if (!body)
          return false;
        climateCache = readJson(CLIMATE_KEY, climateCache);
        const now = Date.now();
        for (const [path, value] of Object.entries(body.places)) {
          climateCache[path] = { until: now + ttlOf(value), value };
          if (value.status === "pending")
            scheduleRetry(value.retryAfterSeconds);
        }
        for (const [path, hit] of Object.entries(climateCache)) {
          if (hit.until <= now)
            delete climateCache[path];
        }
        writeJson(CLIMATE_KEY, climateCache);
      }
      return true;
    } finally {
      for (const path of wanted)
        inFlight.delete(path);
    }
  };
  var renderNugget = ({ host, mount, city, month, compact }) => {
    const key = `${city.path}|${month}`;
    const existing = host.querySelector(`.${NUGGET_CLASS}`);
    if (existing?.dataset.key === key)
      return;
    const climate = cachedClimate(city.path);
    const row = climate?.status === "ready" ? climate.months[month - 1] : undefined;
    if (climate?.status !== "ready" || !row) {
      existing?.remove();
      return;
    }
    const nugget = buildClimateNugget(row, UNIT);
    const el = existing ?? document.createElement("div");
    el.className = compact ? `${NUGGET_CLASS} is-compact` : NUGGET_CLASS;
    el.dataset.key = key;
    el.title = `${nugget.conditions}, ${nugget.rain}, ${nugget.sun}: usual ${MONTH_NAMES[month - 1]} in ${city.name}, ${climate.period} averages (Roamline, Open-Meteo, ERA5)`;
    el.replaceChildren();
    if (compact) {
      el.textContent = `${nugget.icon} ${nugget.temps} · \uD83D\uDCA7${Math.round(row.rainDays)}d`;
    } else {
      const text = document.createElement("span");
      text.textContent = `${nugget.icon} ${nugget.temps} · ${nugget.rain} · ${nugget.sun}`;
      const link = document.createElement("a");
      link.href = `${ROAMLINE}${city.path}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Roamline ↗";
      link.addEventListener("click", (event) => event.stopPropagation());
      el.append(text, link);
    }
    if (!existing)
      mount.append(el);
  };
  var collectTargets = (index) => {
    const targets = [];
    const monthByMid = new Map;
    const dropNugget = (host) => host.querySelector(`.${NUGGET_CLASS}`)?.remove();
    for (const card of document.querySelectorAll(sels.card)) {
      const nameEl = card.querySelector(sels.name);
      const mount = nameEl?.parentElement;
      const name = nameEl?.textContent?.trim();
      const city = name ? matchCity(index, name) : null;
      const month = parseTripStartMonth(nameEl?.nextElementSibling?.textContent ?? "");
      if (month && card.dataset.code)
        monthByMid.set(card.dataset.code, month);
      if (city && month && mount)
        targets.push({ host: card, mount, city, month, compact: false });
      else
        dropNugget(card);
    }
    for (const marker of document.querySelectorAll(sels.marker)) {
      const priceBox = marker.querySelector(sels.markerPrice)?.parentElement;
      const mount = priceBox?.parentElement;
      const name = priceBox?.previousElementSibling?.textContent?.trim();
      const city = name ? matchCity(index, name) : null;
      const month = monthByMid.get(marker.dataset.mid ?? "");
      if (city && month && mount)
        targets.push({ host: marker, mount, city, month, compact: true });
      else
        dropNugget(marker);
    }
    return targets;
  };
  var scheduleRetry = (seconds) => {
    if (retryTimer)
      return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      run();
    }, Math.max(5, seconds) * 1000);
  };
  var running = false;
  var runAgain = false;
  var run = async () => {
    if (!location.pathname.startsWith("/travel/explore"))
      return;
    if (running) {
      runAgain = true;
      return;
    }
    if (!document.querySelector(sels.card))
      return;
    running = true;
    try {
      const index = await loadCityIndex();
      if (!index)
        return;
      const targets = collectTargets(index);
      for (const target of targets)
        renderNugget(target);
      const fetched = await fetchClimate([...new Set(targets.map((target) => target.city.path))]);
      if (fetched)
        for (const target of collectTargets(index))
          renderNugget(target);
    } finally {
      running = false;
      if (runAgain) {
        runAgain = false;
        run();
      }
    }
  };
  var WATCHED = `${sels.card}, ${sels.marker}`;
  var touchesDestinations = (mutation) => {
    const target = mutation.target instanceof Element ? mutation.target : null;
    if (target?.closest(WATCHED))
      return true;
    return [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches(WATCHED) || !!node.querySelector(WATCHED)));
  };
  var main = () => {
    injectCSS(STYLE_ID, CSS);
    observeDomChanges(() => void run(), {
      debounceMs: 400,
      runImmediately: true,
      shouldRun: (mutations) => mutations.some(touchesDestinations)
    }).observe(document.body);
  };
  main();
})();
