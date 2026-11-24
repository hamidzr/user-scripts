// ==UserScript==
// @name         Add to Roamline
// @namespace    https://roamline.lbyte.app
// @version      1.0.1795496583
// @description  Send a place open in Google Maps to a Roamline trip or route.
// @match        https://www.google.com/maps/*
// @match        https://google.com/maps/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      roamline.lbyte.app
// @run-at       document-idle
// @noframes
// @license      MIT
// @homepageURL  https://roamline.lbyte.app
// @downloadURL  https://roamline.lbyte.app/add-to-roamline.user.js
// @updateURL    https://roamline.lbyte.app/add-to-roamline.user.js
// ==/UserScript==

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
  var __returnValue = (v) => v;
  function __exportSetter(name, newValue) {
    this[name] = __returnValue.bind(null, newValue);
  }
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: __exportSetter.bind(all, name)
      });
  };

  // src/userscript/add-to-roamline.ts
  var exports_add_to_roamline = {};
  __export(exports_add_to_roamline, {
    BASE_URL: () => BASE_URL,
    managerEnv: () => managerEnv,
    mountAddToRoamline: () => mountAddToRoamline,
    readMapsPlace: () => readMapsPlace,
    stopBody: () => stopBody
  });
  var BASE_URL = "https://roamline.lbyte.app";
  var STOP_NAME_MAX = 120;
  var FEATURE_ID = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i;
  var PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
  var VIEW = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
  function inRange(lat, lon) {
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }
  function cleanText(text) {
    const trimmed = text?.replace(/\s+/g, " ").trim();
    return trimmed ? trimmed.slice(0, 200) : null;
  }
  function readMapsPlace(href, doc) {
    const url = new URL(href);
    const path = decodeURIComponent(url.pathname);
    const placePath = path.match(/\/maps\/place\/([^/]+)/);
    if (!placePath)
      return null;
    const feature = path.match(FEATURE_ID);
    if (!feature?.[1])
      return null;
    const afterFeature = path.slice((feature.index ?? 0) + feature[0].length);
    const pin = afterFeature.match(PIN) ?? path.match(VIEW);
    if (!pin)
      return null;
    const lat = Number(pin[1]);
    const lon = Number(pin[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inRange(lat, lon))
      return null;
    const mains = [...doc.querySelectorAll('[role="main"]')].reverse();
    const main = mains.find((region) => region.hasAttribute("aria-label")) ?? mains[0];
    const name = cleanText(main?.querySelector("h1")?.textContent) ?? cleanText(main?.getAttribute("aria-label")) ?? cleanText((placePath[1] ?? "").replace(/\+/g, " "));
    if (!name)
      return null;
    const category = cleanText(main?.querySelector('button[jsaction*=".category"]')?.textContent);
    return {
      name,
      sourceId: feature[1].toLowerCase(),
      category: category?.slice(0, 80) ?? null,
      lat,
      lon
    };
  }
  function stopBody(place) {
    return {
      name: place.name.slice(0, STOP_NAME_MAX).trim(),
      poi: {
        source: "google",
        sourceId: place.sourceId,
        name: place.name,
        categories: place.category ? [place.category] : [],
        lat: place.lat,
        lon: place.lon
      }
    };
  }
  var KEYS = { token: "roamline.token", pick: "roamline.lastPick", spot: "roamline.panelSpot" };
  function lastPick(env) {
    try {
      const value = JSON.parse(env.get(KEYS.pick) ?? "null");
      return value && typeof value.tripId === "string" ? value : null;
    } catch {
      return null;
    }
  }
  function errorText(response) {
    const code = response.body?.error;
    if (response.status === 401)
      return "Roamline did not accept the token. Paste a new one.";
    if (response.status === 404)
      return "That trip or route is gone. Pick another.";
    if (code === "already-on-route")
      return "That place is already on this route.";
    if (response.status === 429)
      return "Too many adds at once. Try again in a minute.";
    return `Roamline said ${response.status}${code ? ` (${code})` : ""}.`;
  }
  var STYLE = `
  :host { all: initial; }
  /* .panel sets display, which would beat the hidden attribute's own display: none */
  [hidden] { display: none !important; }
  .btn { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 2147483000;
    font: 600 14px/1 system-ui, sans-serif; color: #fff; background: #0f766e; border: 0;
    border-radius: 999px; padding: 12px 18px; box-shadow: 0 2px 10px rgb(0 0 0 / 0.3); cursor: pointer; }
  .panel { position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%); z-index: 2147483000;
    width: min(360px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px; border-radius: 12px;
    background: #fff; color: #1f2937; font: 14px/1.4 system-ui, sans-serif;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.3); display: grid; gap: 8px; }
  .bar { display: flex; align-items: center; justify-content: space-between; margin: -6px -6px 0;
    padding: 2px 2px 2px 6px; font-weight: 700; color: #0f766e; cursor: move; user-select: none; touch-action: none; }
  .body { display: grid; gap: 8px; }
  .note { color: #92400e; }
  label { display: grid; gap: 4px; font-weight: 600; }
  input, select { font: inherit; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  button.go { background: #0f766e; color: #fff; border: 0; border-radius: 6px; padding: 8px 12px; font: inherit; cursor: pointer; }
  button.plain { background: none; border: 0; color: #0f766e; font: inherit; cursor: pointer; }
  .msg { margin: 0; }
  .err { color: #b91c1c; }
  a { color: #0f766e; }
`;
  function mountAddToRoamline(doc, env, location, watch) {
    const host = doc.createElement("div");
    host.id = "add-to-roamline";
    doc.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = STYLE;
    const button = doc.createElement("button");
    button.className = "btn";
    button.type = "button";
    button.textContent = "Add to Roamline";
    button.hidden = true;
    const panel = doc.createElement("div");
    panel.className = "panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Add to Roamline");
    const bar = doc.createElement("div");
    bar.className = "bar";
    bar.textContent = "Add to Roamline";
    bar.title = "Drag to move";
    const shut = doc.createElement("button");
    shut.className = "plain";
    shut.type = "button";
    shut.textContent = "×";
    shut.setAttribute("aria-label", "Close");
    shut.addEventListener("click", () => {
      panel.hidden = true;
    });
    bar.append(shut);
    const body = doc.createElement("div");
    body.className = "body";
    panel.append(bar, body);
    root.append(style, button, panel);
    const restoreSpot = makeMovable();
    let picker = null;
    let shownId = null;
    const api = (method, path, body) => env.request(method, `${BASE_URL}${path}`, env.get(KEYS.token) ?? "", body);
    function el(tag, props = {}) {
      const node = doc.createElement(tag);
      Object.assign(node, props);
      return node;
    }
    function message(text, isError = false) {
      const p = el("p", { className: isError ? "msg err" : "msg", textContent: text });
      p.setAttribute("role", isError ? "alert" : "status");
      return p;
    }
    function makeMovable() {
      const view = doc.defaultView;
      const place = (left, top) => {
        const maxLeft = Math.max(0, (view?.innerWidth ?? 0) - panel.offsetWidth);
        const maxTop = Math.max(0, (view?.innerHeight ?? 0) - panel.offsetHeight);
        const spot = {
          left: Math.round(Math.min(Math.max(0, left), maxLeft)),
          top: Math.round(Math.min(Math.max(0, top), maxTop))
        };
        Object.assign(panel.style, {
          left: `${spot.left}px`,
          top: `${spot.top}px`,
          bottom: "auto",
          transform: "none"
        });
        return spot;
      };
      let grab = null;
      bar.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target !== bar)
          return;
        const box = panel.getBoundingClientRect();
        grab = { x: event.clientX - box.left, y: event.clientY - box.top };
        bar.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      bar.addEventListener("pointermove", (event) => {
        if (grab)
          place(event.clientX - grab.x, event.clientY - grab.y);
      });
      const drop = (event) => {
        if (!grab)
          return;
        const spot = place(event.clientX - grab.x, event.clientY - grab.y);
        grab = null;
        env.set(KEYS.spot, JSON.stringify(spot));
      };
      bar.addEventListener("pointerup", drop);
      bar.addEventListener("pointercancel", drop);
      return () => {
        try {
          const spot = JSON.parse(env.get(KEYS.spot) ?? "null");
          if (spot && Number.isFinite(spot.left) && Number.isFinite(spot.top))
            place(spot.left, spot.top);
        } catch {}
      };
    }
    function showTokenForm(note) {
      picker = null;
      const token = el("input", { type: "password", autocomplete: "off", value: "" });
      const tokenLabel = el("label", { textContent: "Roamline token" });
      tokenLabel.append(token);
      const help = el("p", { className: "msg" });
      const link = el("a", {
        href: `${BASE_URL}/app/agents`,
        target: "_blank",
        rel: "noopener",
        textContent: "Agent access"
      });
      help.append("Make a token under ", link, " in Roamline and paste it here.");
      const save = el("button", { className: "go", type: "button", textContent: "Save" });
      save.addEventListener("click", () => {
        if (!token.value.trim())
          return;
        env.set(KEYS.token, token.value.trim());
        showPicker();
      });
      const row = el("div", { className: "row" });
      row.append(save);
      body.replaceChildren(...note ? [message(note, true)] : [], help, tokenLabel, row);
    }
    async function loadTrip(tripId) {
      const response = await api("GET", `/api/trips/${encodeURIComponent(tripId)}`);
      if (response.status !== 200)
        return response;
      const detail = response.body;
      const routes = (detail.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        isSelected: v.isSelected
      }));
      const added = new Map;
      for (const stop of detail.stops ?? []) {
        if (stop.poi?.source !== "google")
          continue;
        const on = (detail.variants ?? []).filter((v) => v.stops.some((s) => s.stopId === stop.id)).map((v) => ({ id: v.id, name: v.name }));
        added.set(stop.poi.sourceId, [
          ...added.get(stop.poi.sourceId) ?? [],
          { stopId: stop.id, routes: on }
        ]);
      }
      return { routes, added };
    }
    async function showPicker() {
      picker = null;
      const opened = readMapsPlace(location.href, doc);
      if (!opened) {
        body.replaceChildren(message("Open one place in Maps first.", true));
        return;
      }
      if (!env.get(KEYS.token)) {
        showTokenForm();
        return;
      }
      body.replaceChildren(message("Loading your trips..."));
      const tripsResponse = await api("GET", "/api/trips");
      if (tripsResponse.status === 401) {
        showTokenForm(errorText(tripsResponse));
        return;
      }
      if (tripsResponse.status !== 200) {
        body.replaceChildren(message(errorText(tripsResponse), true));
        return;
      }
      const trips = tripsResponse.body.filter((t) => !t.isSomeday);
      if (trips.length === 0) {
        body.replaceChildren(message("Make a trip in Roamline first.", true));
        return;
      }
      const remembered = lastPick(env);
      let place = opened;
      let added = new Map;
      const name = el("input", { value: stopBody(opened).name, maxLength: STOP_NAME_MAX });
      const tripSelect = el("select");
      for (const trip of trips)
        tripSelect.append(el("option", { value: trip.id, textContent: trip.name }));
      tripSelect.value = trips.some((t) => t.id === remembered?.tripId) ? remembered?.tripId : trips[0].id;
      const routeSelect = el("select");
      const status = el("div");
      const already = el("p", { className: "msg note" });
      async function fillRoutes(preferred) {
        const tripId = tripSelect.value;
        routeSelect.replaceChildren(el("option", { value: "", textContent: "Pool only, no route" }));
        added = new Map;
        markAdded();
        const trip = await loadTrip(tripId);
        if (tripSelect.value !== tripId)
          return;
        if (!("routes" in trip)) {
          status.replaceChildren(message(errorText(trip), true));
          return;
        }
        const { routes } = trip;
        added = trip.added;
        markAdded();
        routeSelect.replaceChildren(el("option", { value: "", textContent: "Pool only, no route" }));
        for (const route of routes) {
          routeSelect.append(el("option", { value: route.id, textContent: `End of ${route.name}` }));
        }
        const known = preferred === "" || routes.some((r) => r.id === preferred);
        routeSelect.value = known ? preferred : routes.find((r) => r.isSelected)?.id ?? "";
      }
      tripSelect.addEventListener("change", () => void fillRoutes(null));
      routeSelect.addEventListener("change", () => markAdded());
      const nameLabel = el("label", { textContent: "Stop name" });
      nameLabel.append(name);
      const tripLabel = el("label", { textContent: "Trip" });
      tripLabel.append(tripSelect);
      const routeLabel = el("label", { textContent: "Add to" });
      routeLabel.append(routeSelect);
      const add = el("button", { className: "go", type: "button", textContent: "Add" });
      const tokenButton = el("button", { className: "plain", type: "button", textContent: "Token" });
      tokenButton.addEventListener("click", () => showTokenForm());
      const row = el("div", { className: "row" });
      row.append(tokenButton, add);
      function plan() {
        const stops = place ? added.get(place.sourceId) ?? [] : [];
        if (stops.length === 0)
          return { reuse: null, blocked: null };
        const routeId = routeSelect.value;
        if (!routeId)
          return { reuse: null, blocked: "In the pool" };
        if (stops.some((stop) => stop.routes.some((r) => r.id === routeId))) {
          return { reuse: null, blocked: "On this route" };
        }
        return { reuse: stops[0], blocked: null };
      }
      function markAdded() {
        const stops = place ? added.get(place.sourceId) ?? [] : [];
        const routes = [...new Set(stops.flatMap((stop) => stop.routes.map((r) => r.name)))];
        already.textContent = stops.length ? `Already on this trip: ${routes.length ? routes.join(", ") : "pool only"}.` : "";
        already.hidden = stops.length === 0;
        const { reuse, blocked } = plan();
        add.textContent = blocked ?? (reuse ? "Add to route" : "Add");
        add.disabled = !place || blocked !== null;
      }
      function show(next) {
        place = next;
        shownId = next?.sourceId ?? null;
        status.replaceChildren(...next ? [] : [message("Open a place in Maps to add it.")]);
        name.value = next ? stopBody(next).name : "";
        name.disabled = !next;
        markAdded();
      }
      add.addEventListener("click", async () => {
        const current = readMapsPlace(location.href, doc);
        if (current?.sourceId !== place?.sourceId) {
          show(current);
          if (current)
            status.replaceChildren(message("The place changed. Check it, then Add."));
          return;
        }
        const { reuse, blocked } = plan();
        if (!place || blocked)
          return;
        const stop = { ...stopBody(place), name: name.value.trim().slice(0, STOP_NAME_MAX) };
        if (!stop.name)
          return;
        const sent = place;
        const tripId = tripSelect.value;
        const variantId = routeSelect.value || null;
        const routeName = ([...routeSelect.options].find((o) => o.value === variantId)?.textContent ?? "").replace(/^End of /, "");
        add.disabled = true;
        const response = await api("POST", variantId ? `/api/variants/${encodeURIComponent(variantId)}/stops` : `/api/trips/${encodeURIComponent(tripId)}/stops`, reuse ? { stopId: reuse.stopId } : stop);
        if (response.status !== 201) {
          markAdded();
          status.replaceChildren(message(errorText(response), true));
          return;
        }
        env.set(KEYS.pick, JSON.stringify({ tripId, variantId }));
        if (tripSelect.value === tripId) {
          const onRoute = variantId ? [{ id: variantId, name: routeName }] : [];
          const answer = response.body;
          const stops = added.get(sent.sourceId) ?? [];
          if (reuse)
            reuse.routes.push(...onRoute);
          else
            stops.push({ stopId: answer.stop?.id ?? answer.id ?? "", routes: onRoute });
          added.set(sent.sourceId, stops);
        }
        markAdded();
        const done = message(reuse ? `Put ${stop.name} on ${routeName}. ` : `Added ${stop.name}. `);
        done.append(el("a", {
          href: `${BASE_URL}/app/trips/${encodeURIComponent(tripId)}`,
          target: "_blank",
          rel: "noopener",
          textContent: "Open the trip"
        }));
        status.replaceChildren(done);
      });
      body.replaceChildren(nameLabel, already, tripLabel, routeLabel, status, row);
      show(opened);
      picker = { show };
      await fillRoutes(remembered?.tripId === tripSelect.value ? remembered.variantId ?? "" : null);
    }
    function refresh() {
      const place = readMapsPlace(location.href, doc);
      button.hidden = place === null;
      if (!panel.hidden && picker && (place?.sourceId ?? null) !== shownId)
        picker.show(place);
    }
    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (panel.hidden)
        return;
      restoreSpot();
      showPicker();
    });
    watch(refresh);
    refresh();
    return { refresh, root };
  }
  function managerEnv() {
    return {
      request: (method, url, token, body) => new Promise((resolve) => {
        const failed = () => resolve({ status: 0, body: { error: "network" } });
        GM_xmlhttpRequest?.({
          method,
          url,
          headers: {
            authorization: `Bearer ${token}`,
            ...body === undefined ? {} : { "content-type": "application/json" }
          },
          ...body === undefined ? {} : { data: JSON.stringify(body) },
          anonymous: true,
          timeout: 15000,
          onload: (response) => {
            let parsed = null;
            try {
              parsed = JSON.parse(response.responseText);
            } catch {}
            resolve({ status: response.status, body: parsed });
          },
          onerror: failed,
          ontimeout: failed
        });
      }),
      get: (key) => GM_getValue(key, null),
      set: (key, value) => GM_setValue(key, value)
    };
  }
  function watchMaps(onChange) {
    let later = [];
    const changed = () => {
      onChange();
      for (const timer of later)
        clearTimeout(timer);
      later = [700, 2000, 4500].map((ms) => setTimeout(onChange, ms));
    };
    const title = document.querySelector("title");
    if (title)
      new MutationObserver(changed).observe(title, { childList: true });
    window.addEventListener("popstate", changed);
  }
  if (typeof GM_xmlhttpRequest !== "undefined") {
    mountAddToRoamline(document, managerEnv(), window.location, watchMaps);
  }
})();
