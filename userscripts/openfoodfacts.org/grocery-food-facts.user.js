// ==UserScript==
// @name                 Grocery Food Facts
// @author               Zare
// @connect              world.openfoodfacts.org
// @description          show Open Food Facts scores, allergens, additives, and nutrition on Walmart and H-E-B product pages, compare Walmart products per 100 g, and flag listings that contradict their ingredients
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/openfoodfacts.org/grocery-food-facts.user.js
// @grant                GM_xmlhttpRequest
// @license              MIT
// @match                https://www.walmart.com/*
// @match                https://www.heb.com/*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/openfoodfacts.org/grocery-food-facts.user.js
// @version              1.4.1
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
  var createElement = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "className") {
          el.className = value;
        } else {
          el[key] = value;
        }
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === "string") {
          el.appendChild(document.createTextNode(child));
        } else {
          el.appendChild(child);
        }
      }
    }
    return el;
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

  // src/openfoodfacts.org/grocery-claims.helpers.ts
  var LIST = "(?:[a-z]+(?:, or |, and |, | or | and ))*";
  var CLAIM_RULES = [
    { term: "high[- ]fructose corn syrups?|hfcs", found: /high[- ]fructose corn syrup|\bhfcs\b/i },
    { term: "corn syrups?", found: /(?:high[- ]fructose )?corn syrup/i },
    { term: "palm(?: kernel)? oils?", found: /palm(?: kernel| fruit)? oil/i },
    { term: `artificial ${LIST}flavou?rs?`, found: /artificial(?:ly)? flavou?r(?:s|ed|ing)?/i },
    {
      term: `artificial ${LIST}(?:colou?rs?|dyes?)`,
      found: /artificial colou?rs?|fd&c \w+(?: no\.?)? ?\d*|\b(?:red|yellow|blue) (?:no\.? ?)?\d+\b/i
    },
    {
      term: `artificial ${LIST}sweeteners?`,
      found: /aspartame|sucralose|acesulfame(?: potassium| k)?|saccharin|neotame/i
    },
    { term: "hydrogenated (?:oils?|fats?)", found: /hydrogenated/i },
    { term: "msg|monosodium glutamate", found: /monosodium glutamate|\bmsg\b/i }
  ];
  var buildClaimPattern = (term) => `\\b(?:no|without|free (?:of|from))[\\s-]+(?:added\\s+)?(?:${term})\\b|` + `(?<!(?:fructose|partially|fully)[- ])\\b(?:${term})[- ]free\\b`;
  var findClaimConflicts = (claims, ingredients) => {
    if (!ingredients)
      return [];
    const conflicts = new Map;
    for (const { term, found } of CLAIM_RULES) {
      const pattern = buildClaimPattern(term);
      const claim = claims.match(new RegExp(pattern, "i"))?.[0];
      if (!claim)
        continue;
      const listed = ingredients.replace(new RegExp(pattern, "gi"), " ").match(found)?.[0];
      if (!listed)
        continue;
      const ingredient = normalizeWhitespace(listed).toLowerCase();
      if (!conflicts.has(ingredient)) {
        conflicts.set(ingredient, { claim: normalizeWhitespace(claim), ingredient });
      }
    }
    return [...conflicts.values()];
  };
  var formatClaimConflict = ({ claim, ingredient }) => `Listing says "${claim}", but the ingredients list ${ingredient}.`;

  // src/lib/store.ts
  var LOCAL_STORAGE_ADAPTER = {
    name: "localStorage",
    readText: (key) => {
      return localStorage.getItem(key);
    },
    writeText: (key, value) => {
      localStorage.setItem(key, value);
    }
  };
  var getAdapters = (adapters) => {
    return adapters?.length ? adapters : [LOCAL_STORAGE_ADAPTER];
  };
  var reportError = (opts, error, ctx) => {
    opts?.onError?.(error, ctx);
  };
  var readRawStore = (key, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        return adapter.readText(key);
      } catch (error) {
        reportError(opts, error, {
          action: "read",
          adapterName: adapter.name,
          key
        });
      }
    }
    return null;
  };
  var writeTextStore = (key, value, opts) => {
    for (const adapter of getAdapters(opts?.adapters)) {
      try {
        adapter.writeText(key, value);
        return true;
      } catch (error) {
        reportError(opts, error, {
          action: "write",
          adapterName: adapter.name,
          key
        });
      }
    }
    return false;
  };
  var readJsonStore = (key, fallback, opts) => {
    const raw = readRawStore(key, opts);
    if (raw === null)
      return fallback;
    try {
      const parsed = JSON.parse(raw);
      return opts?.parse ? opts.parse(parsed) : parsed;
    } catch (error) {
      reportError(opts, error, { action: "parse", key });
      return fallback;
    }
  };
  var writeJsonStore = (key, value, opts) => {
    try {
      return writeTextStore(key, JSON.stringify(value), opts);
    } catch (error) {
      reportError(opts, error, { action: "stringify", key });
      return false;
    }
  };

  // src/openfoodfacts.org/grocery-compare.helpers.ts
  var MAX_COMPARE_ITEMS = 6;
  var NUTRIENT_ROWS = [
    { key: "calories", label: "Calories", unit: "kcal", better: null, minGap: 40 },
    { key: "protein", label: "Protein", unit: "g", better: "high", minGap: 2 },
    { key: "fiber", label: "Fiber", unit: "g", better: "high", minGap: 2 },
    { key: "sugars", label: "Total sugars", unit: "g", better: "low", minGap: 2 },
    { key: "addedSugars", label: "Added sugars", unit: "g", better: "low", minGap: 2 },
    { key: "fat", label: "Total fat", unit: "g", better: null, minGap: 2 },
    { key: "satFat", label: "Saturated fat", unit: "g", better: "low", minGap: 2 },
    { key: "carbs", label: "Carbohydrates", unit: "g", better: null, minGap: 5 },
    { key: "sodium", label: "Sodium", unit: "mg", better: "low", minGap: 50 }
  ];
  var NUTRIENT_NAMES = [
    [/added sugar/, "addedSugars"],
    [/saturated fat/, "satFat"],
    [/^(total )?fat$/, "fat"],
    [/^(total )?carbohydrates?$/, "carbs"],
    [/^(dietary )?fiber$/, "fiber"],
    [/^(total )?sugars?$/, "sugars"],
    [/^proteins?$/, "protein"],
    [/^sodium$/, "sodium"]
  ];
  var UNIT_SIZES = {
    oz: 28.3495,
    "fl oz": 29.5735,
    lb: 453.592,
    g: 1,
    kg: 1000,
    ml: 1,
    l: 1000
  };
  var OZ_IN_GRAMS = UNIT_SIZES.oz;
  var CONFLICT_RATIO = 0.3;
  var parseAmount = (amount, unit) => {
    const match = amount?.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)?/i);
    if (!match)
      return null;
    const value = Number(match[1]);
    const given = match[2]?.toLowerCase() ?? unit;
    if (given === unit)
      return value;
    if (given === "mg")
      return value / 1000;
    if (given === "g")
      return value * 1000;
    return null;
  };
  var parseServingGrams = (serving) => {
    const metric = serving?.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i);
    if (metric)
      return Number(metric[1]);
    const ounces = serving?.match(/(\d+(?:\.\d+)?)\s*(?:fl\.? )?oz\b/i);
    return ounces ? Number(ounces[1]) * OZ_IN_GRAMS : null;
  };
  var parsePricePer100 = (price, label) => {
    const unit = label?.split("/").pop()?.trim().toLowerCase() ?? "";
    const size = UNIT_SIZES[unit];
    return price && size ? price / size * 100 : null;
  };
  var flattenNutrients = (nutrients) => nutrients.flatMap((nutrient) => [nutrient, ...flattenNutrients(nutrient.childNutrients ?? [])]);
  var readLabel = (data) => {
    const facts = data.props?.pageProps?.initialData?.data?.idml?.nutritionFacts;
    const groups = facts?.keyNutrients?.values ?? [];
    const nutrients = flattenNutrients(groups.flatMap((group) => [
      ...group.mainNutrient ? [group.mainNutrient] : [],
      ...group.childNutrients ?? []
    ]));
    const label = {};
    const calories = parseAmount(facts?.calorieInfo?.mainNutrient?.amount, "g");
    if (calories !== null)
      label.calories = calories;
    for (const { name, amount } of nutrients) {
      const normalized = name?.trim().toLowerCase() ?? "";
      const key = NUTRIENT_NAMES.find(([pattern]) => pattern.test(normalized))?.[1];
      const value = key ? parseAmount(amount, key === "sodium" ? "mg" : "g") : null;
      if (key && value !== null)
        label[key] = value;
    }
    return label;
  };
  var stripHtml = (html) => html.replace(/<[^>]+>/g, ". ").replace(/&[a-z]+;/g, " ");
  var readClaims = (data) => {
    const init = data.props?.pageProps?.initialData?.data;
    const summary = init?.idml?.genAiDetails?.genAiConciseSummary?.items ?? [];
    return [
      init?.product?.name,
      init?.product?.shortDescription,
      init?.idml?.shortDescription,
      stripHtml(init?.idml?.longDescription ?? ""),
      ...summary.map(({ title, description }) => `${title}: ${description}`)
    ].filter(Boolean).join(". ");
  };
  var readWalmartListing = (data, productId) => {
    const init = data?.props?.pageProps?.initialData?.data;
    const product = init?.product;
    if (!data || product?.usItemId !== productId)
      return null;
    const servings = init?.idml?.nutritionFacts?.servingInfo?.values ?? [];
    const servingLabel = servings.find(({ name }) => name === "Serving Size")?.value ?? null;
    const { unitPrice, currentPrice } = product.priceInfo ?? {};
    const allergens = (init?.idml?.warnings ?? []).filter(({ name, value }) => name === "Warning Text" && /contains/i.test(value ?? "")).map(({ value }) => value?.replace(/^contains:?\s*/i, "").replace(/\.$/, "").toLowerCase() ?? "");
    return {
      id: productId,
      name: product.name ?? `Item ${productId}`,
      upc: product.upc ?? null,
      image: product.imageInfo?.thumbnailUrl ?? null,
      price: currentPrice?.priceString ?? null,
      pricePer100: parsePricePer100(unitPrice?.price, unitPrice?.priceString),
      servingLabel,
      servingGrams: parseServingGrams(servingLabel),
      label: readLabel(data),
      allergens,
      ingredients: init?.idml?.ingredients?.ingredients?.value?.trim() || null,
      claims: readClaims(data)
    };
  };
  var findListingConflicts = (listing, facts) => findClaimConflicts(listing.claims, listing.ingredients ?? facts?.ingredients ?? null);
  var buildCompareItem = (listing, facts) => ({
    id: listing.id,
    name: listing.name,
    image: listing.image,
    price: listing.price,
    pricePer100: listing.pricePer100,
    servingLabel: listing.servingLabel,
    servingGrams: listing.servingGrams ?? facts?.servingGrams ?? null,
    label: listing.label,
    off: facts?.per100 ?? {},
    scores: facts?.scores ?? [],
    allergens: listing.allergens.length ? listing.allergens : facts?.allergens ?? [],
    ingredients: listing.ingredients ?? facts?.ingredients ?? null,
    claimConflicts: findListingConflicts(listing, facts)
  });
  var toggleItem = (items, item) => items.some(({ id }) => id === item.id) ? items.filter(({ id }) => id !== item.id) : [...items, item].slice(-MAX_COMPARE_ITEMS);
  var disagree = (a, b, minGap) => {
    const gap = Math.abs(a - b);
    return gap >= minGap && gap >= Math.max(a, b) * CONFLICT_RATIO;
  };
  var getCell = (item, row, basis) => {
    const grams = item.servingGrams;
    const labelValue = item.label[row.key] ?? null;
    const labelPer100 = labelValue !== null && grams ? labelValue / grams * 100 : null;
    const offPer100 = item.off[row.key] ?? null;
    const fromOff = () => {
      if (offPer100 === null)
        return null;
      if (basis === "per100")
        return offPer100;
      return grams ? offPer100 * grams / 100 : null;
    };
    const value = basis === "per100" ? labelPer100 ?? offPer100 : labelValue ?? fromOff();
    const conflict = labelPer100 !== null && offPer100 !== null && disagree(labelPer100, offPer100, row.minGap);
    return { value, other: conflict ? fromOff() : null };
  };
  var getBestColumns = (cells, better) => {
    const values = cells.map(({ value }) => value).filter((value) => value !== null);
    if (!better || values.length < 2 || cells.some(({ other }) => other !== null))
      return new Set;
    const best = better === "high" ? Math.max(...values) : Math.min(...values);
    if (values.every((value) => value === best))
      return new Set;
    return new Set(cells.flatMap(({ value }, i) => value === best ? [i] : []));
  };
  var formatValue = (value, unit) => {
    if (value === null)
      return "-";
    const rounded = unit === "g" ? Math.round(value * 10) / 10 : Math.round(value);
    return unit === "kcal" ? String(rounded) : `${rounded} ${unit}`;
  };

  // src/openfoodfacts.org/grocery-food-facts.helpers.ts
  var OFF_ORIGIN = "https://world.openfoodfacts.org";
  var DONATE_URL = `${OFF_ORIGIN}/donate-to-open-food-facts`;
  var ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";
  var ADD_PRODUCT_URL = `${OFF_ORIGIN}/cgi/product.pl?type=search_or_add&action=display`;
  var OFF_FIELDS = [
    "code",
    "product_name",
    "brands",
    "quantity",
    "nutriscore_grade",
    "nova_group",
    "ecoscore_grade",
    "nutrient_levels",
    "allergens_tags",
    "traces_tags",
    "additives_tags",
    "ingredients_analysis_tags",
    "labels_tags",
    "ingredients_text",
    "nutriments",
    "serving_quantity",
    "states_tags"
  ];
  var NOVA_LABELS = {
    1: "Unprocessed",
    2: "Culinary ingredient",
    3: "Processed",
    4: "Ultra-processed"
  };
  var NOVA_TONES = { 1: "a", 2: "b", 3: "d", 4: "e" };
  var NUTRIENT_LEVEL_LABELS = {
    fat: "Fat",
    "saturated-fat": "Saturated fat",
    sugars: "Sugars",
    salt: "Salt"
  };
  var NUTRITION_ROWS = [
    { key: "energy-kcal", label: "Energy", unit: "kcal" },
    { key: "fat", label: "Fat", unit: "g" },
    { key: "saturated-fat", label: "Saturated fat", unit: "g" },
    { key: "carbohydrates", label: "Carbohydrates", unit: "g" },
    { key: "sugars", label: "Sugars", unit: "g" },
    { key: "fiber", label: "Fiber", unit: "g" },
    { key: "proteins", label: "Protein", unit: "g" },
    { key: "salt", label: "Salt", unit: "g" }
  ];
  var NUTRIENT_FIELDS = [
    ["calories", "energy-kcal_100g", 1],
    ["fat", "fat_100g", 1],
    ["satFat", "saturated-fat_100g", 1],
    ["carbs", "carbohydrates_100g", 1],
    ["fiber", "fiber_100g", 1],
    ["sugars", "sugars_100g", 1],
    ["addedSugars", "added-sugars_100g", 1],
    ["protein", "proteins_100g", 1],
    ["sodium", "sodium_100g", 1000]
  ];
  var getTrailingId = (pathname, prefix) => {
    if (!pathname.startsWith(prefix))
      return null;
    const last = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return /^\d+$/.test(last) ? last : null;
  };
  var getWalmartProductId = (pathname) => getTrailingId(pathname, "/ip/");
  var getHebProductId = (pathname) => getTrailingId(pathname, "/product-detail/");
  var readHebProduct = (data, productId) => {
    const product = data?.props?.pageProps?.product;
    if (product?.id !== productId)
      return null;
    return {
      upc: product.SKUs?.[0]?.twelveDigitUPC ?? null,
      name: product.fullDisplayName ?? null
    };
  };
  var readWalmartProduct = (data, productId) => {
    const product = data?.props?.pageProps?.initialData?.data?.product;
    if (product?.usItemId !== productId)
      return null;
    return { upc: product.upc ?? null, name: product.name ?? null };
  };
  var isLookupBarcode = (code) => /^\d{8,14}$/.test(code) && !code.startsWith("00000") && !/^2\d{11}$/.test(code);
  var formatTag = (tag) => tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
  var capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  var formatAdditive = (tag) => capitalize(formatTag(tag));
  var formatGrade = (grade) => {
    const normalized = grade?.toLowerCase() ?? "";
    if (normalized === "a-plus")
      return { value: "A+", tone: "a" };
    if (/^[a-e]$/.test(normalized)) {
      return { value: normalized.toUpperCase(), tone: normalized };
    }
    return { value: "unknown", tone: "unknown" };
  };
  var formatNova = (group) => {
    if (!group || !NOVA_LABELS[group])
      return { value: "unknown", tone: "unknown" };
    return { value: `${group} ${NOVA_LABELS[group]}`, tone: NOVA_TONES[group] ?? "unknown" };
  };
  var formatNutrientLevels = (levels) => Object.entries(NUTRIENT_LEVEL_LABELS).flatMap(([key, label]) => {
    const level = levels?.[key];
    return level ? [`${label} ${level}`] : [];
  });
  var formatAmount = (amount) => String(Math.round(amount * 10) / 10);
  var formatNutrition = (nutriments) => NUTRITION_ROWS.flatMap(({ key, label, unit }) => {
    const amount = Number(nutriments?.[`${key}_100g`] ?? NaN);
    return Number.isFinite(amount) ? [{ label, value: `${formatAmount(amount)} ${unit}` }] : [];
  });
  var readNumber = (value) => {
    const parsed = Number(value ?? NaN);
    return Number.isFinite(parsed) ? parsed : null;
  };
  var readPer100 = (nutriments) => {
    const per100 = {};
    for (const [key, field, scale] of NUTRIENT_FIELDS) {
      const amount = readNumber(nutriments?.[field]);
      if (amount !== null)
        per100[key] = amount * scale;
    }
    return per100;
  };
  var formatDiet = (tags) => (tags ?? []).filter((tag) => !tag.endsWith("-unknown")).map((tag) => capitalize(formatTag(tag)));
  var buildTitle = (product) => {
    const parts = [product.brands, product.product_name, product.quantity].map((part) => part?.trim() ?? "").filter(Boolean);
    const seen = parts.map((part) => part.toLowerCase());
    return parts.filter((part, i) => seen.indexOf(part.toLowerCase()) === i).join(" · ");
  };
  var buildProductUrl = (code) => `${OFF_ORIGIN}/product/${code}`;
  var toSearchTerms = (name) => normalizeWhitespace(name.replace(/\([^)]*\)/g, " ").split(",")[0]);
  var buildSearchUrl = (name) => {
    const params = new URLSearchParams({
      search_terms: toSearchTerms(name),
      search_simple: "1",
      action: "process"
    });
    return `${OFF_ORIGIN}/cgi/search.pl?${params}`;
  };
  var summarizeProduct = (product, fallbackCode) => {
    const code = product.code ?? fallbackCode;
    return {
      code,
      url: buildProductUrl(code),
      title: buildTitle(product),
      scores: [
        { name: "Nutri-Score", ...formatGrade(product.nutriscore_grade) },
        { name: "NOVA", ...formatNova(product.nova_group) },
        { name: "Green-Score", ...formatGrade(product.ecoscore_grade) }
      ],
      nutrientLevels: formatNutrientLevels(product.nutrient_levels),
      allergens: (product.allergens_tags ?? []).map(formatTag),
      traces: (product.traces_tags ?? []).map(formatTag),
      additives: (product.additives_tags ?? []).map(formatAdditive),
      diet: formatDiet(product.ingredients_analysis_tags),
      labels: (product.labels_tags ?? []).map(formatTag),
      ingredients: product.ingredients_text?.trim() || null,
      nutrition: formatNutrition(product.nutriments),
      per100: readPer100(product.nutriments),
      servingGrams: readNumber(product.serving_quantity) || null
    };
  };
  var parseOffResponse = (body, code) => {
    const parsed = JSON.parse(body);
    if (parsed.result?.id === "product_not_found" || !parsed.product)
      return null;
    if (parsed.product.states_tags?.includes("en:empty"))
      return null;
    return summarizeProduct(parsed.product, code);
  };

  // src/openfoodfacts.org/grocery-compare.css
  var grocery_compare_default = `.vm-off-compare-tile {
  position: absolute;
  z-index: 5;
  top: 8px;
  left: 8px;
  padding: 3px 9px;
  border: 1px solid #5c6670;
  border-radius: 999px;
  background: #fff;
  color: #2e3338;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
  opacity: 0;
}
[data-dca-ctx='itemTile']:hover .vm-off-compare-tile,
.vm-off-compare-tile:focus-visible,
.vm-off-compare-tile.vm-off-added {
  opacity: 1;
}
@media (hover: none) {
  .vm-off-compare-tile {
    opacity: 1;
  }
}
.vm-off-compare-btn {
  padding: 2px 10px;
  border: 1px solid #5c6670;
  border-radius: 999px;
  background: #fff;
  color: #2e3338;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.vm-off-compare-tile.vm-off-added,
.vm-off-compare-btn.vm-off-added {
  border-color: #038141;
  background: #038141;
  color: #fff;
}
#vm-off-compare-tray {
  position: fixed;
  z-index: 2147483000;
  right: 20px;
  bottom: 20px;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  background: #038141;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
#vm-off-compare {
  position: fixed;
  z-index: 2147483001;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  color: #2e3338;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
}
#vm-off-compare a {
  color: inherit;
  text-decoration: underline;
}
#vm-off-compare button {
  cursor: pointer;
}
.vm-off-compare-dialog {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 100%;
  max-height: 100%;
  padding: 14px 16px;
  border-radius: 10px;
  background: #fff;
}
.vm-off-compare-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 16px;
}
.vm-off-compare-basis {
  display: flex;
  overflow: hidden;
  border: 1px solid #5c6670;
  border-radius: 999px;
}
.vm-off-compare-basis button {
  padding: 3px 12px;
  border: 0;
  background: #fff;
  color: #2e3338;
  font-size: 13px;
}
.vm-off-compare-basis button[aria-pressed='true'] {
  background: #2e3338;
  color: #fff;
}
.vm-off-compare-actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}
.vm-off-compare-actions button,
.vm-off-compare-remove {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 13px;
  text-decoration: underline;
}
.vm-off-compare-scroll {
  overflow: auto;
  min-height: 0;
}
.vm-off-compare-scroll table {
  border-collapse: separate;
  border-spacing: 0;
}
.vm-off-compare-scroll th,
.vm-off-compare-scroll td {
  box-sizing: border-box;
  min-width: 150px;
  max-width: 190px;
  padding: 6px 10px;
  border-bottom: 1px solid #e7eaec;
  background: #fff;
  font-weight: 400;
  text-align: left;
  vertical-align: top;
}
.vm-off-compare-scroll thead th {
  position: sticky;
  z-index: 2;
  top: 0;
}
.vm-off-compare-scroll tbody th,
.vm-off-compare-scroll thead th:first-child {
  position: sticky;
  z-index: 1;
  left: 0;
  min-width: 120px;
  font-weight: 700;
}
.vm-off-compare-scroll thead th:first-child {
  z-index: 3;
}
.vm-off-compare-scroll img {
  display: block;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  object-fit: contain;
}
.vm-off-compare-scroll small {
  display: block;
  font-size: 11px;
  font-weight: 400;
}
.vm-off-compare-name {
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 2px;
  font-size: 13px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.vm-off-compare-ingredients {
  font-size: 12px;
}
.vm-off-compare-scroll td.vm-off-best {
  background: #dff3e6;
  font-weight: 700;
}
.vm-off-compare-scroll td.vm-off-conflict {
  background: #fff0d6;
}
.vm-off-compare-notes {
  margin: 8px 0 0;
  color: #5c6670;
  font-size: 12px;
}
`;

  // src/openfoodfacts.org/grocery-compare.ts
  var STYLE_ID = "vm-off-compare-style";
  var STORE_KEY = "vm-off-compare-v1";
  var OVERLAY_ID = "vm-off-compare";
  var TRAY_ID = "vm-off-compare-tray";
  var TILE_BUTTON_CLASS = "vm-off-compare-tile";
  var BUTTON_CLASS = "vm-off-compare-btn";
  var STATUS_RESET_MS = 2500;
  var SCAN_THROTTLE_MS = 300;
  var THUMBNAIL_QUERY = "?odnHeight=128&odnWidth=128&odnBg=FFFFFF";
  var sels = {
    tile: '[data-dca-ctx="itemTile"][data-dca-id]'
  };
  var buildCellLink = (href, text) => createElement("a", { href, target: "_blank", rel: "noopener noreferrer" }, [text]);
  var initCompare = ({ fetchFacts, readNextData }) => {
    let items = readJsonStore(STORE_KEY, []);
    let basis = "per100";
    let overlay = null;
    const pending = new Set;
    const loadListing = async (productId) => {
      const current = readWalmartListing(readNextData(document), productId);
      if (current)
        return current;
      const res = await fetch(`/ip/${productId}`);
      if (!res.ok)
        throw new Error(`product page request failed with status ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const listing = readWalmartListing(readNextData(doc), productId);
      if (!listing)
        throw new Error(`no product data for ${productId}`);
      return listing;
    };
    const loadFacts = async (code) => {
      if (!code || !isLookupBarcode(code))
        return null;
      try {
        return await fetchFacts(code);
      } catch (err) {
        console.warn("[Grocery Food Facts] compare lookup failed", err);
        return null;
      }
    };
    const save = (next) => {
      items = next;
      writeJsonStore(STORE_KEY, items);
      refresh();
    };
    const syncButton = (btn) => {
      if (btn.dataset.vmOffStatus)
        return;
      const productId = btn.dataset.vmOffId ?? "";
      const added = items.some(({ id }) => id === productId);
      btn.textContent = pending.has(productId) ? "Adding..." : added ? "Added" : "Compare";
      btn.setAttribute("aria-pressed", String(added));
      btn.classList.toggle("vm-off-added", added);
    };
    const showStatus = (btn, status) => {
      btn.dataset.vmOffStatus = status;
      btn.textContent = status;
      window.setTimeout(() => {
        delete btn.dataset.vmOffStatus;
        syncButton(btn);
      }, STATUS_RESET_MS);
    };
    const handleToggle = async (btn) => {
      const productId = btn.dataset.vmOffId ?? "";
      if (pending.has(productId))
        return;
      const existing = items.find(({ id }) => id === productId);
      if (existing) {
        save(toggleItem(items, existing));
        return;
      }
      if (items.length >= MAX_COMPARE_ITEMS) {
        showStatus(btn, `${MAX_COMPARE_ITEMS} max`);
        return;
      }
      pending.add(productId);
      refresh();
      try {
        const listing = await loadListing(productId);
        const facts = await loadFacts(listing.upc);
        pending.delete(productId);
        save(toggleItem(items, buildCompareItem(listing, facts)));
      } catch (err) {
        pending.delete(productId);
        console.warn("[Grocery Food Facts] could not add to compare", err);
        refresh();
        showStatus(btn, "Failed");
      }
    };
    const buildButton = (productId, className = BUTTON_CLASS) => {
      const btn = createElement("button", { type: "button", className });
      btn.dataset.vmOffId = productId;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleToggle(btn);
      });
      syncButton(btn);
      return btn;
    };
    const buildHeaderCell = (item) => {
      const remove = createElement("button", {
        type: "button",
        className: "vm-off-compare-remove",
        ariaLabel: `Remove ${item.name}`,
        textContent: "Remove",
        onclick: () => save(items.filter(({ id }) => id !== item.id))
      });
      const image = item.image ? [createElement("img", { src: `${item.image.split("?")[0]}${THUMBNAIL_QUERY}`, alt: "" })] : [];
      return createElement("th", { scope: "col" }, [
        ...image,
        createElement("div", { className: "vm-off-compare-name" }, [
          buildCellLink(`/ip/${item.id}`, item.name)
        ]),
        remove
      ]);
    };
    const buildRow = (label, cells, note) => {
      const heading = createElement("th", { scope: "row" }, [label]);
      if (note)
        heading.append(createElement("small", {}, [note]));
      return createElement("tr", {}, [heading].concat(cells.map((cell) => typeof cell === "string" ? createElement("td", {}, [cell]) : cell)));
    };
    const buildNutrientRows = () => NUTRIENT_ROWS.map((row) => {
      const cells = items.map((item) => getCell(item, row, basis));
      const best = basis === "per100" ? getBestColumns(cells, row.better) : new Set;
      return buildRow(row.label, cells.map(({ value, other }, i) => {
        const td = createElement("td", {}, [formatValue(value, row.unit)]);
        td.classList.toggle("vm-off-best", best.has(i));
        if (other !== null) {
          td.classList.add("vm-off-conflict");
          td.append(createElement("small", {}, [`Open Food Facts: ${formatValue(other, row.unit)}`]));
        }
        return td;
      }));
    });
    const buildPriceRow = () => {
      const cells = items.map(({ pricePer100 }) => ({ value: pricePer100, other: null }));
      const best = getBestColumns(cells, "low");
      return buildRow("Price per 100 g", cells.map(({ value }, i) => {
        const text = value === null ? "-" : `$${value.toFixed(2)}`;
        const td = createElement("td", {}, [text]);
        td.classList.toggle("vm-off-best", best.has(i));
        return td;
      }));
    };
    const buildScoreRow = (name) => buildRow(name, items.map(({ scores }) => {
      const score = scores.find((candidate) => candidate.name === name);
      if (!score)
        return "-";
      const pill = createElement("span", { className: `vm-off-score vm-off-tone-${score.tone}` }, [score.value]);
      return createElement("td", {}, [pill]);
    }));
    const buildClaimsRow = () => {
      if (!items.some(({ claimConflicts }) => claimConflicts?.length))
        return [];
      return [
        buildRow("Listing claims", items.map(({ claimConflicts }) => {
          if (!claimConflicts?.length)
            return "-";
          const text = claimConflicts.map(formatClaimConflict).join(" ");
          return createElement("td", { className: "vm-off-conflict" }, [text]);
        }))
      ];
    };
    const buildIngredientsRow = () => buildRow("Ingredients", items.map(({ ingredients }) => {
      if (!ingredients)
        return "-";
      return createElement("td", {}, [
        createElement("details", {}, [
          createElement("summary", {}, ["Show"]),
          createElement("div", { className: "vm-off-compare-ingredients" }, [ingredients])
        ])
      ]);
    }));
    const buildTable = () => {
      const head = createElement("thead", {}, [
        createElement("tr", {}, [
          createElement("th", { scope: "col" }, [""]),
          ...items.map(buildHeaderCell)
        ])
      ]);
      const body = createElement("tbody", {}, [
        buildRow("Price", items.map(({ price }) => price ?? "-")),
        buildPriceRow(),
        buildRow("Serving size", items.map(({ servingLabel }) => servingLabel ?? "-")),
        ...buildNutrientRows(),
        buildRow("Contains", items.map(({ allergens }) => allergens.length ? allergens.join(", ") : "Not listed"), "check the package"),
        ...buildClaimsRow(),
        ...["Nutri-Score", "NOVA", "Green-Score"].map(buildScoreRow),
        buildIngredientsRow()
      ]);
      return createElement("div", { className: "vm-off-compare-scroll" }, [
        createElement("table", {}, [head, body])
      ]);
    };
    const buildBasisToggle = () => {
      const options = [
        ["per100", "Per 100 g"],
        ["serving", "Per serving"]
      ];
      return createElement("div", { className: "vm-off-compare-basis", role: "group", ariaLabel: "Nutrition basis" }, options.map(([value, text]) => {
        const btn = createElement("button", { type: "button", textContent: text });
        btn.setAttribute("aria-pressed", String(basis === value));
        btn.addEventListener("click", () => {
          basis = value;
          renderOverlay();
        });
        return btn;
      }));
    };
    const buildNotes = () => createElement("p", { className: "vm-off-compare-notes" }, [
      "Green marks the best per 100 g value. Amber marks a conflict between the Walmart listing and ",
      buildCellLink(OFF_ORIGIN, "Open Food Facts"),
      ", or inside the listing itself, so check the package. Food data from Open Food Facts under the ",
      buildCellLink(ODBL_URL, "Open Database License"),
      "."
    ]);
    const closeOverlay = () => {
      overlay?.remove();
      overlay = null;
      document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape")
        closeOverlay();
    };
    const renderOverlay = () => {
      if (!overlay)
        return;
      if (!items.length) {
        closeOverlay();
        return;
      }
      const close = createElement("button", {
        type: "button",
        textContent: "Close",
        onclick: closeOverlay
      });
      const clear = createElement("button", {
        type: "button",
        textContent: "Clear all",
        onclick: () => save([])
      });
      const dialog = createElement("div", { className: "vm-off-compare-dialog", role: "dialog", ariaLabel: "Compare products" }, [
        createElement("div", { className: "vm-off-compare-bar" }, [
          createElement("strong", {}, ["Compare products"]),
          buildBasisToggle(),
          createElement("div", { className: "vm-off-compare-actions" }, [clear, close])
        ]),
        buildTable(),
        buildNotes()
      ]);
      dialog.setAttribute("aria-modal", "true");
      overlay.replaceChildren(dialog);
    };
    const openOverlay = () => {
      if (overlay)
        return;
      overlay = createElement("div", { id: OVERLAY_ID });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay)
          closeOverlay();
      });
      document.addEventListener("keydown", handleKeydown);
      document.body.append(overlay);
      renderOverlay();
    };
    const renderTray = () => {
      const existing = document.getElementById(TRAY_ID);
      if (!items.length) {
        existing?.remove();
        return;
      }
      const tray = existing ?? createElement("button", { id: TRAY_ID, type: "button", onclick: openOverlay }, []);
      tray.textContent = `Compare ${items.length}`;
      if (!tray.isConnected)
        document.body.append(tray);
    };
    const refresh = () => {
      renderTray();
      renderOverlay();
      document.querySelectorAll(`.${BUTTON_CLASS}, .${TILE_BUTTON_CLASS}`).forEach(syncButton);
    };
    const scanTiles = () => {
      document.querySelectorAll(sels.tile).forEach((tile) => {
        const productId = tile.dataset.dcaId ?? "";
        if (!/^\d+$/.test(productId))
          return;
        const btn = tile.querySelector(`:scope > .${TILE_BUTTON_CLASS}`);
        if (!btn) {
          tile.append(buildButton(productId, TILE_BUTTON_CLASS));
        } else if (btn.dataset.vmOffId !== productId) {
          btn.dataset.vmOffId = productId;
          syncButton(btn);
        }
      });
    };
    let scanQueued = false;
    const queueScan = () => {
      if (scanQueued)
        return;
      scanQueued = true;
      window.setTimeout(() => {
        scanQueued = false;
        scanTiles();
      }, SCAN_THROTTLE_MS);
    };
    injectCSS(STYLE_ID, grocery_compare_default);
    renderTray();
    scanTiles();
    new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", (event) => {
      if (event.key !== STORE_KEY)
        return;
      items = readJsonStore(STORE_KEY, []);
      refresh();
    });
    return { buildButton: (productId) => buildButton(productId) };
  };

  // src/openfoodfacts.org/grocery-food-facts.css
  var grocery_food_facts_default = `#vm-off-panel {
  box-sizing: border-box;
  max-width: 100%;
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px solid #d5d9dd;
  border-radius: 8px;
  background: #fff;
  color: #2e3338;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
}
#vm-off-panel a {
  color: inherit;
  text-decoration: underline;
}
#vm-off-panel .vm-off-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  align-items: baseline;
  justify-content: space-between;
}
#vm-off-panel .vm-off-brand {
  font-weight: 700;
}
#vm-off-panel .vm-off-title {
  color: #5c6670;
  font-size: 12px;
}
#vm-off-panel .vm-off-scores {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
.vm-off-score {
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.vm-off-tone-a {
  background: #038141;
}
.vm-off-tone-b {
  background: #5f8f12;
}
.vm-off-tone-c {
  background: #fecb02;
  color: #2e3338;
}
.vm-off-tone-d {
  background: #c96a00;
}
.vm-off-tone-e {
  background: #d3360d;
}
.vm-off-tone-unknown {
  background: #e7eaec;
  color: #4a535c;
}
#vm-off-panel .vm-off-row {
  margin: 3px 0;
}
#vm-off-panel .vm-off-claim {
  padding: 4px 8px;
  border-radius: 6px;
  background: #fff0d6;
}
#vm-off-panel .vm-off-source {
  margin-top: 6px;
  color: #5c6670;
  font-size: 12px;
}
#vm-off-panel .vm-off-label {
  font-weight: 700;
}
#vm-off-panel details {
  margin: 4px 0;
}
#vm-off-panel summary {
  cursor: pointer;
  font-weight: 700;
}
#vm-off-panel table {
  width: 100%;
  margin: 4px 0;
  border-collapse: collapse;
}
#vm-off-panel td {
  padding: 2px 0;
  border: 0;
  border-bottom: 1px solid #e7eaec;
}
#vm-off-panel td:last-child {
  text-align: right;
}
#vm-off-panel .vm-off-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  justify-content: space-between;
  margin-top: 8px;
  color: #5c6670;
  font-size: 12px;
}
#vm-off-panel .vm-off-credit {
  margin-top: 2px;
  color: #5c6670;
  font-size: 11px;
}
`;

  // src/openfoodfacts.org/grocery-food-facts.user.ts
  var STYLE_ID2 = "vm-off-style";
  var PANEL_ID = "vm-off-panel";
  var USER_AGENT = "GroceryFoodFacts/1.4 (https://latentbyte.com/products/grocery-food-facts-userscripts)";
  var sels2 = {
    nextData: "#__NEXT_DATA__"
  };
  var WALMART = {
    getProductId: getWalmartProductId,
    readProduct: (nextData, id) => readWalmartProduct(nextData, id),
    readListing: (nextData, id) => readWalmartListing(nextData, id),
    anchors: ["section:has(> h1#main-title)"]
  };
  var HEB = {
    getProductId: getHebProductId,
    readProduct: (nextData, id) => readHebProduct(nextData, id),
    readListing: () => null,
    anchors: [
      '[data-qe-id="productDetails"] [data-qe-id="productPrice"] + div',
      '[data-qe-id="productDetails"] [data-qe-id="productPrice"]',
      '[data-qe-id="productDetails"] h1'
    ]
  };
  var site = window.location.hostname.endsWith("walmart.com") ? WALMART : HEB;
  var factsByCode = new Map;
  var activeId = null;
  var panel = null;
  var compare = null;
  var readNextData = (doc) => {
    const text = doc.querySelector(sels2.nextData)?.textContent;
    return text ? JSON.parse(text) : null;
  };
  var readProductPage = (doc, productId) => {
    const nextData = readNextData(doc);
    const product = site.readProduct(nextData, productId);
    return product && { ...product, listing: site.readListing(nextData, productId) };
  };
  var resolveProduct = async (productId) => {
    const current = readProductPage(document, productId);
    if (current)
      return current;
    const res = await fetch(window.location.href);
    if (!res.ok)
      throw new Error(`product page request failed with status ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    return readProductPage(doc, productId);
  };
  var requestFacts = (code) => new Promise((resolve, reject) => {
    const params = new URLSearchParams({ fields: OFF_FIELDS.join(",") });
    GM_xmlhttpRequest({
      method: "GET",
      url: `${OFF_ORIGIN}/api/v3/product/${code}.json?${params}`,
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
      onload: ({ responseText }) => {
        try {
          resolve(parseOffResponse(responseText, code));
        } catch (err) {
          reject(err);
        }
      },
      onerror: (err) => reject(new Error(err.error ?? err.statusText ?? "request failed")),
      ontimeout: () => reject(new Error("request timed out"))
    });
  });
  var fetchFacts = (code) => {
    const known = factsByCode.get(code);
    if (known)
      return known;
    const request = requestFacts(code);
    factsByCode.set(code, request);
    request.catch(() => factsByCode.delete(code));
    return request;
  };
  var buildLink = (href, text) => createElement("a", { href, target: "_blank", rel: "noopener noreferrer" }, [text]);
  var buildRow = (label, items) => {
    if (!items.length)
      return [];
    return [
      createElement("div", { className: "vm-off-row" }, [
        createElement("span", { className: "vm-off-label" }, [`${label}: `]),
        items.join(", ")
      ])
    ];
  };
  var buildDetails = (summary, content, open = false) => createElement("details", { open }, [createElement("summary", {}, [summary]), content]);
  var buildNutrition = (facts) => {
    if (!facts.nutrition.length)
      return [];
    const rows = facts.nutrition.map(({ label, value }) => createElement("tr", {}, [createElement("td", {}, [label]), createElement("td", {}, [value])]));
    const body = createElement("tbody", {}, rows);
    return [buildDetails("Nutrition per 100 g", createElement("table", {}, [body]))];
  };
  var buildIngredients = (ingredients, summary = "Ingredients", open = false) => {
    if (!ingredients)
      return [];
    return [buildDetails(summary, createElement("div", {}, [ingredients]), open)];
  };
  var buildClaimRows = (conflicts) => conflicts.map((conflict) => createElement("div", { className: "vm-off-row vm-off-claim" }, [formatClaimConflict(conflict)]));
  var buildListingRows = (listing) => {
    if (!listing?.ingredients && !listing?.allergens.length)
      return [];
    return [
      createElement("div", { className: "vm-off-source" }, ["From the Walmart listing"]),
      ...buildRow("Contains", listing.allergens),
      ...buildIngredients(listing.ingredients, "Ingredients", true)
    ];
  };
  var buildHeader = () => createElement("div", { className: "vm-off-header" }, [
    createElement("span", { className: "vm-off-brand" }, ["Open Food Facts"])
  ]);
  var buildFooter = (url, linkText) => createElement("div", { className: "vm-off-footer" }, [
    buildLink(url, linkText),
    ...compare && activeId ? [compare.buildButton(activeId)] : [],
    buildLink(DONATE_URL, "Donate to Open Food Facts")
  ]);
  var buildCredit = (url) => createElement("div", { className: "vm-off-credit" }, [
    "Data from ",
    buildLink(url, "Open Food Facts"),
    " under the ",
    buildLink(ODBL_URL, "Open Database License")
  ]);
  var buildNotice = (message, url, linkText, listing) => createElement("section", { id: PANEL_ID }, [
    buildHeader(),
    createElement("div", { className: "vm-off-row" }, [message]),
    ...buildClaimRows(listing ? findListingConflicts(listing, null) : []),
    ...buildListingRows(listing),
    buildFooter(url, linkText)
  ]);
  var buildFactsPanel = (facts, listing) => {
    const header = buildHeader();
    if (facts.title) {
      header.append(createElement("span", { className: "vm-off-title" }, [facts.title]));
    }
    const scores = facts.scores.map(({ name, value, tone }) => createElement("span", { className: `vm-off-score vm-off-tone-${tone}` }, [`${name} ${value}`]));
    return createElement("section", { id: PANEL_ID }, [
      header,
      createElement("div", { className: "vm-off-scores" }, scores),
      ...buildClaimRows(listing ? findListingConflicts(listing, facts) : []),
      ...facts.allergens.length ? buildRow("Contains", facts.allergens) : buildRow("Contains (Walmart listing)", listing?.allergens ?? []),
      ...buildRow("May contain", facts.traces),
      ...buildRow("Additives", facts.additives),
      ...buildRow("Levels per 100 g", facts.nutrientLevels),
      ...buildRow("Diet", facts.diet),
      ...buildRow("Labels", facts.labels),
      ...facts.ingredients ? buildIngredients(facts.ingredients) : buildIngredients(listing?.ingredients, "Ingredients (Walmart listing)"),
      ...buildNutrition(facts),
      buildFooter(facts.url, "View or fix this product"),
      buildCredit(facts.url)
    ]);
  };
  var placePanel = () => {
    if (!panel || panel.isConnected)
      return;
    const anchor = site.anchors.map((sel) => document.querySelector(sel)).find(Boolean);
    anchor?.after(panel);
  };
  var showPanel = (next) => {
    panel?.remove();
    panel = next;
    placePanel();
  };
  var loadPanel = async (productId) => {
    const product = await resolveProduct(productId);
    if (productId !== activeId || !product)
      return;
    const { upc: code, name, listing } = product;
    if (!code || !isLookupBarcode(code)) {
      if (name) {
        showPanel(buildNotice("No barcode on this listing.", buildSearchUrl(name), "Search by name", listing));
      }
      return;
    }
    try {
      const facts = await fetchFacts(code);
      if (productId !== activeId)
        return;
      showPanel(facts ? buildFactsPanel(facts, listing) : buildNotice(`No details for barcode ${code} yet.`, ADD_PRODUCT_URL, "Add it", listing));
    } catch (err) {
      if (productId !== activeId)
        return;
      console.warn("[Grocery Food Facts] lookup failed", err);
      showPanel(buildNotice("Could not reach Open Food Facts.", buildProductUrl(code), "Open product page", listing));
    }
  };
  var refresh = () => {
    const productId = site.getProductId(window.location.pathname);
    if (productId === activeId)
      return;
    activeId = productId;
    panel?.remove();
    panel = null;
    if (!productId)
      return;
    loadPanel(productId).catch((err) => {
      console.warn("[Grocery Food Facts] could not read the product", err);
    });
  };
  injectCSS(STYLE_ID2, grocery_food_facts_default);
  if (site === WALMART)
    compare = initCompare({ fetchFacts, readNextData });
  refresh();
  observeDomChanges(() => {
    refresh();
    placePanel();
  }, {
    shouldRun: () => {
      const productId = site.getProductId(window.location.pathname);
      return productId !== activeId || panel !== null && !panel.isConnected;
    }
  }).observe(document.body);
})();
