#!/usr/bin/env node

const { chromium } = require('playwright');

const DEFAULT_URL = 'https://www.hostelworld.com/pwa/s?q=Paris,%20Ile-de-France,%20France&country=Ile-de-France,%20France&city=Paris&type=city&id=14&from=2025-08-13&to=2025-08-16&guests=1&page=1&minRating=8&display=map';
const argv = process.argv.slice(2);
const URL = argv.find((a) => /^https?:/i.test(a)) || DEFAULT_URL;
const STAY_OPEN = argv.includes('--stay');
const STAY_MS = STAY_OPEN ? 60 * 60 * 1000 : 30 * 1000; // default 30s for quick run

// Utility to repeatedly run a function in the page context
async function exposeInterval(page, name, fn, ms) {
  await page.exposeFunction(name, fn);
  await page.addInitScript((name, ms) => {
    window[name] = (...args) => window[name + '_impl']?.(...args);
  }, name, ms);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  page.on('pageerror', (e) => console.error('Page error:', e));
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') console.error('[browser]', text);
    else if (type === 'warning' || type === 'warn') console.warn('[browser]', text);
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Wait for a stable UI element instead of networkidle (3p trackers never idle)
  try {
    await page.waitForSelector('.leaflet-container, [data-testid="map-container"], [class*="Map"]', { timeout: 45000 });
  } catch (_) {
    // continue anyway; our MutationObserver will upgrade anchors as they appear
  }

  // Inject script to make property links open in a new tab
  await page.addScriptTag({ content: `
    (function enableNewTabForHostels() {
      const TARGET_ATTR = '_blank';
      const REL_ATTR = 'noopener noreferrer';

      function upgradeAnchor(anchor) {
        if (!anchor) return;
        try {
          // Avoid modifying non-navigation anchors
          const href = anchor.getAttribute('href');
          if (!href) return;
          // Hostelworld property links typically contain '/p/' or '/hosteldetails'
          const isProperty = /\/p\/|hostel|property|hosteldetails/i.test(href);
          if (!isProperty) return;
          anchor.setAttribute('target', TARGET_ATTR);
          anchor.setAttribute('rel', REL_ATTR);
        } catch (_) {}
      }

      function upgradeAll(root = document) {
        root.querySelectorAll('a[href]')?.forEach(upgradeAnchor);
      }

      // Observe DOM changes since the app is client-rendered
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            m.addedNodes.forEach((n) => {
              if (n.nodeType === 1) {
                if (n.tagName === 'A') upgradeAnchor(n);
                else upgradeAll(n);
              }
            });
          } else if (m.type === 'attributes' && m.target?.tagName === 'A' && m.attributeName === 'href') {
            upgradeAnchor(m.target);
          }
        }
      });

      // Try to scope to map popups and list/cards if present
      const containers = [
        document.body,
        document.querySelector('[data-testid="map-container"], .leaflet-container, #map'),
        document.querySelector('[data-testid="property-list"], [class*="PropertyList"], [class*="CardList"]'),
      ].filter(Boolean);

      containers.forEach((c) => {
        upgradeAll(c);
        observer.observe(c, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
      });

      // Also intercept click on markers/popups that navigate programmatically
      window.addEventListener('click', (ev) => {
        const a = ev.target?.closest?.('a[href]');
        if (!a) return;
        if (a.target !== TARGET_ATTR) return; // already set by us
        // Let default happen which opens new tab
      }, true);

      // Add explicit "Open in new tab" links inside map popups when available
      const addOpenNewTabButtons = () => {
        document.querySelectorAll('.leaflet-popup-content, [class*="MapPopup"], [data-testid*="popup"]').forEach((popup) => {
          if (popup.querySelector('[data-open-new-tab]')) return;
          const link = popup.querySelector('a[href]');
          if (!link) return;
          const href = link.getAttribute('href');
          if (!href) return;
          const btn = document.createElement('a');
          btn.textContent = 'Open in new tab';
          btn.href = href;
          btn.setAttribute('target', TARGET_ATTR);
          btn.setAttribute('rel', REL_ATTR);
          btn.setAttribute('data-open-new-tab', '1');
          btn.style.display = 'inline-block';
          btn.style.marginTop = '8px';
          btn.style.color = '#0969da';
          btn.style.cursor = 'pointer';
          popup.appendChild(btn);
        });
      };

      setInterval(addOpenNewTabButtons, 800);
    })();
  `});

  console.log('Page loaded. Hostel links should now open in a new tab.');

  // Keep the browser open for interaction
  await page.waitForTimeout(STAY_MS);
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
