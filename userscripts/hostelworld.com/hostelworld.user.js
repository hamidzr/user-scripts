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
  var getNameAndCity = () => {
    const m = window.location.pathname.match(/hosteldetails\.php\/([^/]+)\/([^/]+)\/\d+/);
    if (!m)
      return { name: "", city: "" };
    return {
      name: decodeURIComponent(m[1]).replace(/-/g, " "),
      city: decodeURIComponent(m[2]).replace(/-/g, " ")
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
  var buildSuperUrl = (destination, query, name, city, country) => {
    const params = new URLSearchParams({
      destination,
      super_lookup: "1",
      super_query: query,
      super_name: name,
      super_city: city,
      super_country: country,
      num_adults: window.location.search ? new URLSearchParams(window.location.search).get("guests") || "1" : "1",
      children: "[]",
      expand_params: "false"
    });
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get("from");
    const to = urlParams.get("to");
    if (from)
      params.set("checkin_at", from);
    if (to)
      params.set("checkout_at", to);
    return `https://www.super.com/home/travel?${params.toString()}`;
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
    const { name, city } = getNameAndCity();
    if (!name)
      return;
    const country = getCountry(city);
    const destination = city || [name, city].filter(Boolean).join(" ");
    const superQuery = [name, city].filter(Boolean).join(" ");
    const q = encodeURIComponent(destination);
    const qTa = encodeURIComponent(`${name} hostel ${city}`.trim());
    const links = [
      {
        cls: "hw-sb-btn-google",
        icon: "G",
        label: "Google",
        href: `https://www.google.com/search?q=${q}`
      },
      {
        cls: "hw-sb-btn-maps",
        icon: "M",
        label: "Maps",
        href: `https://www.google.com/maps/search/${q}`
      },
      {
        cls: "hw-sb-btn-booking",
        icon: "B",
        label: "Booking",
        href: `https://www.booking.com/searchresults.html?ss=${q}`
      },
      {
        cls: "hw-sb-btn-super",
        icon: "S",
        label: "Super",
        href: buildSuperUrl(destination, superQuery, name, city, country)
      },
      {
        cls: "hw-sb-btn-tripadv",
        icon: "T",
        label: "TripAdvisor",
        href: `https://www.tripadvisor.com/Search?q=${qTa}`
      }
    ];
    const bar = document.createElement("div");
    bar.id = SEARCH_BAR_ID;
    links.forEach(({ cls, icon, label, href }) => {
      const a = document.createElement("a");
      a.className = `hw-sb-btn ${cls}`;
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = `${label}: ${name}, ${city}`;
      a.innerHTML = `<span>${icon}</span>${label}`;
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
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
  var watchSPA = () => {
    let lastUrl = location.href;
    const onNav = () => {
      const url = location.href;
      if (url === lastUrl)
        return;
      lastUrl = url;
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(SEARCH_BAR_ID)?.remove();
      setTimeout(hwInit, 600);
    };
    for (const fn of ["pushState", "replaceState"]) {
      const orig = history[fn].bind(history);
      history[fn] = function(...args) {
        orig(...args);
        onNav();
      };
    }
    window.addEventListener("popstate", onNav);
  };
  var hwBootstrap = () => {
    watchSPA();
    hwInit();
  };
  if (document.body) {
    hwBootstrap();
  } else {
    document.addEventListener("DOMContentLoaded", hwBootstrap);
  }
})();
