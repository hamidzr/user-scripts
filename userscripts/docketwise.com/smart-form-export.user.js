// ==UserScript==
// @name                 Docketwise Smart Form Export
// @author               Zare
// @description          export smart form answers to markdown/pdf and prompt to autosave unsaved changes
// @downloadURL          https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/docketwise.com/smart-form-export.user.js
// @grant                none
// @match                https://app.docketwise.com/*/smart_forms/*/edit*
// @match                https://app.docketwise.com/smart_forms/*/edit*
// @namespace            https://latentbyte.com/products
// @run-at               document-idle
// @updateURL            https://raw.githubusercontent.com/hamidzr/user-scripts/refs/heads/master/userscripts/docketwise.com/smart-form-export.user.js
// @version              1.4.1
// ==/UserScript==

'use strict';
(() => {

  // src/docketwise.com/smart-form-export.css
  var smart_form_export_default = `.dw-sfe-wrap {
  position: relative;
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}

.dw-sfe-panel {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 1050;
  min-width: 210px;
  padding: 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  text-align: left;
}

.dw-sfe-panel.open {
  display: block;
}

.dw-sfe-opt {
  display: block;
  margin: 0 0 8px;
  font-weight: normal;
  white-space: nowrap;
  cursor: pointer;
}

.dw-sfe-scope {
  width: 100%;
  margin-bottom: 10px;
  padding: 3px 4px;
}

.dw-sfe-actions {
  display: flex;
  gap: 6px;
}

.dw-sfe-prompt {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: #0b3140;
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  font-size: 14px;
}

.dw-sfe-print-frame {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 0;
  height: 0;
  border: 0;
}
`;

  // src/lib/dom.ts
  var waitForEl = (selector, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el)
        return resolve(el);
      const endTime = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        } else if (Date.now() > endTime) {
          observer.disconnect();
          reject(new Error(`waitForEl("${selector}") timed out after ${timeoutMs}ms`));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el)
          resolve(el);
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

  // src/lib/download.ts
  var stringify = (val) => {
    if (typeof val === "string")
      return val;
    if (Array.isArray(val))
      return val.map(stringify).join(`
`);
    if (val instanceof HTMLElement)
      return val.innerText;
    return JSON.stringify(val);
  };
  var download = (filename, text) => {
    const content = stringify(text);
    const el = document.createElement("a");
    el.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    el.setAttribute("download", filename);
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

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

  // src/lib/text.ts
  var escapeHtml = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  var normalizeWhitespace = (value) => (value ?? "").replace(/\s+/g, " ").trim();

  // src/docketwise.com/smart-form-export.helpers.ts
  var SSN_PLACEHOLDER = "[SSN redacted]";
  var DASHED_SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
  var ssnVariants = (raw) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 9)
      return [];
    const [a, b, c] = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5)];
    return [digits, `${a}-${b}-${c}`, `${a} ${b} ${c}`];
  };
  var redactSsn = (text, known) => {
    let out = text;
    for (const variant of known.flatMap(ssnVariants))
      out = out.split(variant).join(SSN_PLACEHOLDER);
    return out.replace(DASHED_SSN_RE, SSN_PLACEHOLDER);
  };
  var prepareDocument = (doc, opts) => {
    const scrub = (s) => opts.ssn ? s : redactSsn(s, doc.ssnValues);
    const fields = (list) => list.filter((f) => opts.ssn || !f.ssn || !f.value).map((f) => ({ ...f, label: scrub(f.label), value: scrub(f.value) }));
    const ssnOnly = (b) => !opts.ssn && b.kind === "question" && b.fields.length > 0 && b.fields.every((f) => f.ssn && f.value);
    const block = (b) => b.kind === "heading" ? { ...b, text: scrub(b.text) } : {
      ...b,
      text: scrub(b.text),
      fields: fields(b.fields),
      entries: b.entries.map(fields).filter((e) => e.length),
      comments: opts.comments ? b.comments.map((c) => ({ ...c, author: scrub(c.author), text: scrub(c.text) })) : []
    };
    return {
      ...doc,
      title: scrub(doc.title),
      sections: doc.sections.map((s) => ({
        title: scrub(s.title),
        blocks: s.blocks.filter((b) => !ssnOnly(b)).map(block)
      })),
      ssnValues: []
    };
  };
  var escapeMd = (s) => s.replace(/([\\`*_[\]<>|])/g, "\\$1");
  var fieldMd = (f, indent = "") => `${indent}- ${f.label ? `${escapeMd(f.label)}: ` : ""}${f.value ? escapeMd(f.value) : "_(blank)_"}`;
  var questionMd = (q) => {
    const out = [`**${escapeMd(q.text)}**`, ""];
    if (!q.fields.length && !q.entries.length)
      out.push("_No answer_");
    out.push(...q.fields.map((f) => fieldMd(f)));
    q.entries.forEach((entry, i) => {
      out.push(`- Entry ${i + 1}`);
      out.push(...entry.map((f) => fieldMd(f, "  ")));
    });
    for (const c of q.comments) {
      out.push("");
      out.push(`> **${escapeMd(c.author)}** (${escapeMd(c.date)}):`);
      out.push(...c.text.split(`
`).map((line) => `> ${escapeMd(line)}`));
    }
    out.push("");
    return out;
  };
  var toMarkdown = (doc) => {
    const out = [`# ${escapeMd(doc.title)}`, "", `_Exported ${doc.exportedAt} from ${doc.url}_`, ""];
    for (const section of doc.sections) {
      out.push(`## ${escapeMd(section.title)}`, "");
      for (const b of section.blocks) {
        if (b.kind === "heading")
          out.push(`### ${escapeMd(b.text)}`, "");
        else
          out.push(...questionMd(b));
      }
    }
    return out.join(`
`).replace(/\n{3,}/g, `

`).trimEnd() + `
`;
  };
  var PRINT_CSS = `
  body { font: 11pt/1.45 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 18px; }
  h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 22px 0 10px; break-after: avoid; }
  h3 { font-size: 12pt; margin: 16px 0 8px; break-after: avoid; }
  .q { margin: 0 0 12px; break-inside: avoid; }
  .q-text { font-weight: 600; margin-bottom: 3px; }
  ul { margin: 2px 0; padding-left: 20px; }
  .label { color: #555; }
  .empty { color: #999; font-style: italic; }
  .entry { margin-top: 3px; }
  .comment { border-left: 3px solid #0099b2; background: #f3f9fa; padding: 4px 8px; margin: 6px 0 0 4px; font-size: 10pt; white-space: pre-wrap; }
  .comment b { font-weight: 600; }
  .comment .date { color: #666; }
  @page { margin: 16mm 14mm; }
`;
  var fieldHtml = (f) => `<li>${f.label ? `<span class="label">${escapeHtml(f.label)}:</span> ` : ""}${f.value ? escapeHtml(f.value) : '<span class="empty">(blank)</span>'}</li>`;
  var questionHtml = (q) => {
    const parts = [`<div class="q"><div class="q-text">${escapeHtml(q.text)}</div>`];
    if (!q.fields.length && !q.entries.length)
      parts.push('<div class="empty">No answer</div>');
    if (q.fields.length)
      parts.push(`<ul>${q.fields.map(fieldHtml).join("")}</ul>`);
    if (q.entries.length) {
      const items = q.entries.map((entry, i) => `<li class="entry">Entry ${i + 1}<ul>${entry.map(fieldHtml).join("")}</ul></li>`);
      parts.push(`<ul>${items.join("")}</ul>`);
    }
    for (const c of q.comments) {
      parts.push(`<div class="comment"><b>${escapeHtml(c.author)}</b> <span class="date">${escapeHtml(c.date)}</span>
${escapeHtml(c.text)}</div>`);
    }
    parts.push("</div>");
    return parts.join("");
  };
  var toHtml = (doc) => {
    const body = doc.sections.map((s) => {
      const blocks = s.blocks.map((b) => b.kind === "heading" ? `<h3>${escapeHtml(b.text)}</h3>` : questionHtml(b));
      return `<h2>${escapeHtml(s.title)}</h2>${blocks.join("")}`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${PRINT_CSS}</style></head><body><h1>${escapeHtml(doc.title)}</h1><div class="meta">Exported ${escapeHtml(doc.exportedAt)} from ${escapeHtml(doc.url)}</div>${body}</body></html>`;
  };
  var MAX_PART_LEN = 80;
  var fileSafe = (s) => s.replace(/[\\/:*?"<>|\x00-\x1f.\s]+/g, "-").replace(/-{2,}/g, "-").slice(0, MAX_PART_LEN).replace(/^-+|-+$/g, "");
  var localDate = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  var exportFileBase = (parts, date) => [
    fileSafe(parts.title) || "Smart-Form",
    parts.section && fileSafe(parts.section),
    parts.ssn && "with-SSN",
    localDate(date)
  ].filter(Boolean).join("_").toLowerCase();

  // src/docketwise.com/smart-form-extract.ts
  var sels = {
    pane: "#form-builder .tab-pane",
    question: ".question-container",
    questionWrap: ".question-and-comment-container",
    comment: ".dw-comment-container",
    entryRemove: "a.remove_nested_fields",
    fieldGroup: ".floating-label-input-group",
    fieldLabel: "label.floating-label"
  };
  var BUTTON_ROW = ".button-row-container";
  var ACTIVE_BUTTON = "button.easyguide-button.active";
  var getVm = () => window.smartFormBuilder?.form ?? null;
  var ownText = (el) => normalizeWhitespace([...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(" "));
  var promptText = (p) => {
    const clone = p.cloneNode(true);
    clone.querySelectorAll(".question-icons-div").forEach((el) => el.remove());
    return normalizeWhitespace(clone.textContent);
  };
  var isHiddenIn = (el, pane) => {
    if (el.closest(".modal"))
      return true;
    for (let e = el;e && e !== pane; e = e.parentElement) {
      if (getComputedStyle(e).display === "none")
        return true;
    }
    return false;
  };
  var fieldLabel = (el) => {
    const label = el.closest(sels.fieldGroup)?.querySelector(sels.fieldLabel);
    return label ? normalizeWhitespace(label.textContent) : "";
  };
  var selectLabel = (el) => {
    const label = fieldLabel(el);
    if (label)
      return label;
    if (el.classList.contains("addon-select"))
      return "Unit type";
    return el.options.length > 100 ? "Country" : "";
  };
  var DIGIT_PART_RE = /^(.*)_(hundreds|tens|ones)\]$/;
  var readDigitGroup = (el) => {
    const m = DIGIT_PART_RE.exec(el.name);
    if (!m || m[2] !== "hundreds")
      return null;
    const scope = el.closest(sels.question) ?? document;
    const part = (p) => scope.querySelector(`input[name="${m[1]}_${p}]"]`)?.value.trim() ?? "";
    const digits = `${el.value.trim()}${part("tens")}${part("ones")}`.replace(/^0+(?=\d)/, "");
    const unit = normalizeWhitespace(scope.querySelector(".input-group-addon")?.textContent);
    return { label: "", value: digits && unit ? `${digits} ${unit}` : digits };
  };
  var isSsnInput = (input) => /\[ssn\]$/.test(input.name) || /social security/i.test(fieldLabel(input));
  var buttonPrompt = (el, mainP) => {
    const prev = el.closest(BUTTON_ROW)?.previousElementSibling;
    if (!prev || prev === mainP || !prev.matches("p, label"))
      return "";
    return ownText(prev);
  };
  var isUnansweredRadioGroup = (el) => {
    if (!el.name)
      return false;
    const group = [
      ...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)
    ];
    return group[0] === el && !group.some((r) => r.checked);
  };
  var readField = (el, mainP) => {
    if (el.matches(BUTTON_ROW)) {
      if (!el.querySelector("button.easyguide-button") || el.querySelector(ACTIVE_BUTTON))
        return null;
      return { label: buttonPrompt(el, mainP), value: "" };
    }
    if (el instanceof HTMLButtonElement) {
      return { label: buttonPrompt(el, mainP), value: normalizeWhitespace(el.textContent) };
    }
    if (el instanceof HTMLSelectElement) {
      const opt = el.selectedOptions[0];
      const value = opt && opt.value !== "" ? normalizeWhitespace(opt.textContent) : "";
      return { label: selectLabel(el), value };
    }
    if (el instanceof HTMLTextAreaElement) {
      return { label: fieldLabel(el), value: el.value.trim() };
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") {
        if (!el.checked)
          return null;
        const value = normalizeWhitespace(el.closest("label")?.textContent);
        return value ? { label: "", value } : null;
      }
      if (el.type === "radio") {
        if (!el.checked)
          return isUnansweredRadioGroup(el) ? { label: "", value: "" } : null;
        const value = normalizeWhitespace(el.closest("label")?.textContent);
        return { label: "", value: value === "Blank" ? "" : value };
      }
      if (["hidden", "button", "submit", "file", "search"].includes(el.type))
        return null;
      if (DIGIT_PART_RE.test(el.name))
        return readDigitGroup(el);
      const raw = el.parentElement?.querySelector('input[type=hidden][name$="[ssn]"]');
      const ssn = !!raw || isSsnInput(el);
      const value = (raw?.value || el.value).trim();
      return { label: fieldLabel(el), value, ...ssn ? { ssn } : {} };
    }
    const value = ownText(el);
    return value ? { label: fieldLabel(el), value } : null;
  };
  var FIELD_SEL = `${BUTTON_ROW}, ${ACTIVE_BUTTON}, input, select, textarea, .populator-tag`;
  var readFields = (scope, pane, mainP, skip) => [...scope.querySelectorAll(FIELD_SEL)].filter((el) => !isHiddenIn(el, pane) && !skip.some((s) => s !== scope && s.contains(el))).map((el) => readField(el, mainP)).filter((f) => !!f);
  var readComments = (qc) => {
    const wrap = qc.closest(sels.questionWrap);
    if (!wrap)
      return [];
    return [...wrap.querySelectorAll(sels.comment)].filter((c) => !qc.contains(c)).map((c) => ({
      author: normalizeWhitespace(c.querySelector(".dw-comment__commenter")?.textContent),
      date: normalizeWhitespace(c.querySelector(".dw-comment__date")?.textContent),
      text: (c.querySelector(".dw-comment_content")?.textContent ?? "").trim()
    })).filter((c) => c.text);
  };
  var readQuestion = (qc, pane) => {
    if (qc.querySelector("input[name^=yes_to_all]"))
      return null;
    const mainP = qc.querySelector("p");
    const text = mainP ? promptText(mainP) : "";
    const entries = [...qc.querySelectorAll(sels.entryRemove)].map((a) => a.parentElement).filter((e) => !!e && !isHiddenIn(e, pane));
    return {
      kind: "question",
      text: text || "(untitled question)",
      fields: readFields(qc, pane, mainP, entries),
      entries: entries.map((e) => readFields(e, pane, mainP, [])).filter((f) => f.length),
      comments: readComments(qc)
    };
  };
  var readSection = (pane) => {
    const title = normalizeWhitespace(pane.querySelector("h4")?.textContent) || pane.id;
    const blocks = [...pane.querySelectorAll(`h3, ${sels.question}`)].filter((el) => !isHiddenIn(el, pane) && !el.parentElement?.closest(sels.question)).map((el) => el.matches(sels.question) ? readQuestion(el, pane) : { kind: "heading", text: normalizeWhitespace(el.textContent) }).filter((b) => !!b && (b.kind === "question" || !!b.text));
    return { title, blocks };
  };
  var readDocument = (scope) => {
    const panes = [...document.querySelectorAll(sels.pane)].filter((p) => scope === "all" || p.classList.contains("active"));
    const ssnValues = [...document.querySelectorAll('input[name$="[ssn]"]')].map((i) => i.value).filter(Boolean);
    return {
      title: getVm()?.name || document.title,
      url: location.href,
      exportedAt: new Date().toLocaleString(),
      sections: panes.map(readSection).filter((s) => s.blocks.length),
      ssnValues
    };
  };

  // src/docketwise.com/smart-form-export.user.ts
  var STYLE_ID = "dw-sfe-styles";
  var OPTS_KEY = "dw-smart-form-export:opts";
  var DIRTY_PROMPT_MS = 30000;
  var COUNTDOWN_S = 10;
  var TYPING_IDLE_MS = 1500;
  var sels2 = {
    titleBar: ".easyguide-page-title",
    btnGroup: ".easyguide-page-title .btn-group",
    loader: ".loader-wrapper"
  };
  var DEFAULT_OPTS = { comments: true, ssn: false, scope: "all" };
  var buildExport = (opts) => {
    const doc = prepareDocument(readDocument(opts.scope), opts);
    const section = opts.scope === "current" ? doc.sections[0]?.title : undefined;
    return { doc, base: exportFileBase({ title: doc.title, section, ssn: opts.ssn }, new Date) };
  };
  var exportMarkdown = (opts) => {
    const { doc, base } = buildExport(opts);
    download(`${base}.md`, toMarkdown(doc));
  };
  var exportPdf = (opts) => {
    const { doc, base } = buildExport(opts);
    const frame = createElement("iframe", { className: "dw-sfe-print-frame" });
    frame.srcdoc = toHtml({ ...doc, title: base });
    const prevTitle = document.title;
    const cleanup = () => {
      document.title = prevTitle;
      frame.remove();
    };
    frame.addEventListener("load", () => {
      const win = frame.contentWindow;
      if (!win)
        return cleanup();
      document.title = base;
      win.addEventListener("afterprint", () => setTimeout(cleanup, 500));
      win.focus();
      win.print();
    });
    document.body.appendChild(frame);
  };
  var checkbox = (label, checked, onChange) => {
    const input = createElement("input", { type: "checkbox", checked });
    input.addEventListener("change", () => onChange(input.checked));
    return createElement("label", { className: "dw-sfe-opt" }, [input, ` ${label}`]);
  };
  var buildPanel = () => {
    const opts = readJsonStore(OPTS_KEY, DEFAULT_OPTS);
    const save = () => writeJsonStore(OPTS_KEY, opts);
    const scopeSel = createElement("select", { className: "dw-sfe-scope" }, [
      createElement("option", { value: "all", textContent: "All sections" }),
      createElement("option", { value: "current", textContent: "Current section" })
    ]);
    scopeSel.value = opts.scope;
    scopeSel.addEventListener("change", () => {
      opts.scope = scopeSel.value === "current" ? "current" : "all";
      save();
    });
    const action = (label, fn) => {
      const btn = createElement("button", {
        type: "button",
        className: "btn btn-default btn-sm",
        textContent: label
      });
      btn.addEventListener("click", () => {
        try {
          fn();
        } catch (e) {
          console.error("[dw-sfe] export failed", e);
        }
        panel.classList.remove("open");
      });
      return btn;
    };
    const panel = createElement("div", { className: "dw-sfe-panel" }, [
      checkbox("Include comments", opts.comments, (v) => {
        opts.comments = v;
        save();
      }),
      checkbox("Include SSN", opts.ssn, (v) => {
        opts.ssn = v;
        save();
      }),
      scopeSel,
      createElement("div", { className: "dw-sfe-actions" }, [
        action("Markdown", () => exportMarkdown(opts)),
        action("PDF", () => exportPdf(opts))
      ])
    ]);
    const toggle = createElement("a", { className: "btn btn-default btn-sm", textContent: "EXPORT" });
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      panel.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target))
        panel.classList.remove("open");
    });
    const wrap = createElement("div", { className: "dw-sfe-wrap" }, [toggle, panel]);
    return wrap;
  };
  var ensurePanel = (panel) => {
    if (panel.isConnected)
      return;
    const group = document.querySelector(sels2.btnGroup);
    group?.parentElement?.insertBefore(panel, group);
  };
  var findSaveBtn = () => [...document.querySelectorAll(`${sels2.titleBar} a`)].find((a) => normalizeWhitespace(a.textContent).toUpperCase() === "SAVE FORM") ?? null;
  var isBusy = () => {
    const loader = document.querySelector(sels2.loader);
    return !!loader && getComputedStyle(loader).display !== "none";
  };
  var startAutosave = () => {
    let dirtySince = null;
    let countdown = null;
    let lastTypedAt = 0;
    let loop = null;
    const msg = createElement("span");
    const saveNow = createElement("button", {
      type: "button",
      className: "btn btn-primary btn-sm",
      textContent: "Save now"
    });
    const cancel = createElement("button", {
      type: "button",
      className: "btn btn-default btn-sm",
      textContent: "Cancel"
    });
    const prompt = createElement("div", { className: "dw-sfe-prompt" }, [
      msg,
      createElement("div", { className: "dw-sfe-actions" }, [saveNow, cancel])
    ]);
    const hide = () => {
      countdown = null;
      prompt.remove();
    };
    const trySave = () => {
      const btn = findSaveBtn();
      if (!btn || isBusy() || Date.now() - lastTypedAt < TYPING_IDLE_MS) {
        msg.textContent = "Unsaved changes. Saving when you pause typing...";
        return;
      }
      hide();
      dirtySince = Date.now();
      btn.click();
    };
    saveNow.addEventListener("click", () => {
      lastTypedAt = 0;
      trySave();
    });
    cancel.addEventListener("click", () => {
      hide();
      dirtySince = Date.now();
    });
    const tick = () => {
      const vm = getVm();
      const dirty = vm?.submit === true && vm.tabs?.active !== "settings";
      if (!dirty) {
        dirtySince = null;
        hide();
        if (loop !== null)
          window.clearInterval(loop);
        loop = null;
        return;
      }
      dirtySince ??= Date.now();
      if (countdown !== null) {
        countdown = Math.max(0, countdown - 1);
        if (countdown === 0)
          trySave();
        else
          msg.textContent = `Unsaved changes. Auto-saving in ${countdown}s`;
        return;
      }
      if (Date.now() - dirtySince >= DIRTY_PROMPT_MS && !isBusy()) {
        countdown = COUNTDOWN_S;
        msg.textContent = `Unsaved changes. Auto-saving in ${countdown}s`;
        document.body.appendChild(prompt);
      }
    };
    const wake = () => {
      loop ??= window.setInterval(tick, 1000);
    };
    document.addEventListener("keydown", () => {
      lastTypedAt = Date.now();
      wake();
    }, true);
    ["input", "change", "click"].forEach((type) => document.addEventListener(type, wake, true));
    wake();
  };
  var main = async () => {
    injectCSS(STYLE_ID, smart_form_export_default);
    await waitForEl(sels2.btnGroup, 20000);
    const panel = buildPanel();
    ensurePanel(panel);
    observeDomChanges(() => ensurePanel(panel), { shouldRun: () => !panel.isConnected }).observe(document.body);
    startAutosave();
  };
  main().catch((e) => console.warn("[dw-sfe]", e));
})();
