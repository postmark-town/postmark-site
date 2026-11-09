// sanitize-html.mjs — a Hearth template's HTML, made safe at BUILD (POS-959).
//
// Darko, 2026-11-01 15:54 EST (POS-684): "HTML and CSS in the page", not an
// iframe; scripts and event handlers stripped. This is how: the template is
// TOKENIZED, built into a tree, and WRITTEN BACK OUT from the tree, so nothing a
// template says reaches the page except through three allowlists:
//
//   tags         the structural and text elements below. An element not on the
//                list is unwrapped (its children stay); a script-like one is
//                dropped WITH its children.
//   attributes   per tag, the names below, each value re-checked. Event handlers,
//                `style`, `id`, `srcdoc`, `formaction` and anything else is never
//                copied: it is not that they are searched for, it is that only
//                the listed names are ever written.
//   urls         `a href`: https only, or a site path; `img src`: a site media
//                path or a small data image. `javascript:`, `data:text/html` and
//                a scheme split by a control character have no way through.
//
// Every text node and every attribute value is escaped on the way out, and tag
// and attribute NAMES come from the lists, never from the template, so there is
// no byte a template can write that closes our markup early. Nothing here is a
// regular expression over the whole document: a tolerant tokenizer reads it, and
// whatever it misreads is escaped as text.
//
// The site's own parts are `<hearth-residents>`-style markers (slots.mjs): each
// becomes `<div data-hearth-slot="residents"></div>`, once, children ignored.
// The template's class names are namespaced `u-` here and in its CSS
// (sanitize-css.mjs), so a template cannot land on, or be styled by, the site's.

import { SLOT_TAGS, BEHAVIOR_NAMES, LIMITS } from "./slots.mjs";

export const CLASS_PREFIX = "u-";

const TAGS = new Set([
  "div", "span", "p", "a", "ul", "ol", "li", "dl", "dt", "dd",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "aside", "header", "footer", "nav", "main",
  "figure", "figcaption", "blockquote", "pre", "code", "kbd", "samp", "em", "strong", "small", "b", "i", "u", "s",
  "mark", "sub", "sup", "br", "hr", "abbr", "cite", "q", "time", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "caption", "details", "summary", "img", "wbr", "address", "bdi",
]);
export const ALLOWED_TAGS = TAGS;
const VOID = new Set(["br", "hr", "img", "wbr", "input", "meta", "link", "base", "source", "track", "embed", "col", "area", "param"]);
// their children are dropped with them: script-like, foreign, or form-like things
const DROP = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "template", "noscript", "svg", "math",
  "head", "title", "meta", "link", "base", "textarea", "select", "option", "optgroup", "noembed", "noframes", "xmp",
  "plaintext", "audio", "video", "canvas", "source", "track", "portal", "dialog", "input", "button", "form", "datalist",
  "slot", "param", "map", "area",
]);
// their content is raw text to the browser: skip to the closing tag, markup and all
const RAW = new Set(["script", "style", "textarea", "title", "iframe", "xmp", "noembed", "noframes", "plaintext", "noscript"]);

const GLOBAL_ATTRS = new Set(["class", "title", "lang", "dir", "aria-label", "aria-hidden"]);
const TAG_ATTRS = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "width", "height"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  ol: new Set(["start", "reversed"]),
  details: new Set(["open"]),
  time: new Set(["datetime"]),
  abbr: new Set([]),
};
const SORT_KEY = /^[a-z][a-z0-9-]{0,15}$/;

const IMG_PATH = /^\/(?:media|thumbs|hero|works)\/(?!.*(?:\.\.|%2e|%2f|%5c|\/\/))[A-Za-z0-9_./%-]{1,200}$/i;
const IMG_DATA = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]{1,20000}={0,2}$/;
const HTTPS = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s"'<>`\\]*)?$/;
const SITE_PATH = /^\/(?!\/)[A-Za-z0-9_./%?#=&+~-]{0,300}$/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e) => {
  if (e[0] === "#") {
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});
// control characters, and the bidi overrides that make text read other than it is
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩﻿]/g;
const clean = (s) => s.replace(BAD_CHARS, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── the tokenizer ───────────────────────────────────────────────────────────

function tokenize(src, out) {
  const n = src.length;
  let i = 0;
  const NAME_START = /[A-Za-z]/;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) { out.push({ t: "text", v: src.slice(i) }); break; }
    if (lt > i) out.push({ t: "text", v: src.slice(i, lt) });
    i = lt;
    if (src.startsWith("<!--", i)) {                       // a comment: dropped
      const end = src.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src[i + 1] === "!" || src[i + 1] === "?") {        // doctype, CDATA, processing instruction: dropped
      const end = src.indexOf(">", i + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (src[i + 1] === "/" && NAME_START.test(src[i + 2] ?? "")) {   // an end tag
      let j = i + 2;
      while (j < n && /[A-Za-z0-9:-]/.test(src[j])) j++;
      const name = src.slice(i + 2, j).toLowerCase();
      const end = src.indexOf(">", j);
      out.push({ t: "end", name });
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (NAME_START.test(src[i + 1] ?? "")) {               // a start tag
      let j = i + 1;
      while (j < n && /[A-Za-z0-9:-]/.test(src[j])) j++;
      const name = src.slice(i + 1, j).toLowerCase();
      const attrs = [];
      let selfClose = false;
      while (j < n) {
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === ">") { j++; break; }
        if (src[j] === "/") { if (src[j + 1] === ">") { selfClose = true; j += 2; break; } j++; continue; }
        if (j >= n) break;
        let k = j;
        while (k < n && !/[\s/>=]/.test(src[k])) k++;
        if (k === j) { j++; continue; }                    // a stray "=" or quote: skip it
        const aname = src.slice(j, k).toLowerCase();
        j = k;
        while (j < n && /\s/.test(src[j])) j++;
        let value = "";
        if (src[j] === "=") {
          j++;
          while (j < n && /\s/.test(src[j])) j++;
          const q = src[j];
          if (q === '"' || q === "'") {
            const e = src.indexOf(q, j + 1);
            value = src.slice(j + 1, e === -1 ? n : e);
            j = e === -1 ? n : e + 1;
          } else {
            let e = j;
            while (e < n && !/[\s>]/.test(src[e])) e++;
            value = src.slice(j, e);
            j = e;
          }
        }
        if (attrs.length < 40 && !attrs.some((a) => a.name === aname)) attrs.push({ name: aname, value });
      }
      out.push({ t: "start", name, attrs, selfClose });
      i = j;
      if (RAW.has(name) && !selfClose) {                   // the browser reads this body as text: skip it whole
        const close = new RegExp("</" + name + "(?=[\\s/>])", "i");
        const rest = src.slice(i);
        const m = close.exec(rest);
        if (!m) { i = n; } else {
          const end = rest.indexOf(">", m.index);
          out.push({ t: "end", name });
          i += end === -1 ? rest.length : end + 1;
        }
      }
      continue;
    }
    out.push({ t: "text", v: "<" });                       // a lone "<" is text
    i++;
  }
}

// ── the tree ────────────────────────────────────────────────────────────────

function build(tokens, problems) {
  const root = { name: "#root", children: [] };
  const stack = [root];
  let nodes = 0;
  for (const tk of tokens) {
    const top = stack[stack.length - 1];
    if (tk.t === "text") {
      if (++nodes > LIMITS.nodes) { problems.add("node-limit"); break; }
      top.children.push({ text: tk.v });
    } else if (tk.t === "start") {
      if (++nodes > LIMITS.nodes) { problems.add("node-limit"); break; }
      const el = { name: tk.name, attrs: tk.attrs, children: [] };
      top.children.push(el);
      if (VOID.has(tk.name) || SLOT_TAGS[tk.name] || tk.selfClose) continue;   // a void element, a slot (it has no body) or <x/>: it closes at once
      if (stack.length >= LIMITS.depth) { problems.add("depth-limit"); el.deep = true; continue; }
      stack.push(el);
    } else {
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === tk.name) { stack.length = k; break; }
      }
    }
  }
  return root;
}

// ── the attributes ──────────────────────────────────────────────────────────

function keepAttr(tag, a, problems) {
  const { name } = a;
  const value = clean(decode(a.value)).trim();
  if (name === "class") {
    const toks = value.split(/\s+/).filter((t) => /^[A-Za-z_][A-Za-z0-9_-]{0,39}$/.test(t)).slice(0, 12);
    return toks.length ? ["class", toks.map((t) => CLASS_PREFIX + t).join(" ")] : null;
  }
  if (name === "data-hearth-behavior") {
    if (BEHAVIOR_NAMES.includes(value)) return [name, value];
    problems.add("attr:data-hearth-behavior=" + value.slice(0, 20));
    return null;
  }
  if (name === "data-tab" || name === "data-panel") return value && value.length <= 60 ? [name, value] : null;
  if (name === "data-single") return [name, ""];
  if (name === "data-sort-keys") {
    const keys = value.split(",").map((k) => k.trim()).filter((k) => SORT_KEY.test(k)).slice(0, 6);
    return keys.length ? [name, keys.join(",")] : null;
  }
  if (name.startsWith("data-sort-") && SORT_KEY.test(name.slice(10))) return value.length <= 80 ? [name, value] : null;
  if (!GLOBAL_ATTRS.has(name) && !TAG_ATTRS[tag]?.has(name)) {
    problems.add("attr:" + name.slice(0, 30));
    return null;
  }
  switch (name) {
    case "title": case "aria-label": case "alt": return value.length <= 200 ? [name, value] : [name, value.slice(0, 200)];
    case "lang": return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(value) ? [name, value] : null;
    case "dir": return value === "ltr" || value === "rtl" ? [name, value] : null;
    case "aria-hidden": return value === "true" ? [name, "true"] : null;
    case "href":
      if (HTTPS.test(value) && value.length <= 300) return [name, value];
      if (SITE_PATH.test(value)) return [name, value];
      problems.add("url:href");
      return null;
    case "src":
      if (IMG_PATH.test(value) || IMG_DATA.test(value)) return [name, value];
      problems.add("url:src");
      return null;
    case "width": case "height": return /^\d{1,4}$/.test(value) ? [name, value] : null;
    case "colspan": case "rowspan": case "start": return /^\d{1,3}$/.test(value) ? [name, value] : null;
    case "scope": return /^(row|col|rowgroup|colgroup)$/.test(value) ? [name, value] : null;
    case "reversed": case "open": return [name, ""];
    case "datetime": return /^[0-9TZ:+.\- ]{4,40}$/.test(value) ? [name, value] : null;
    default: return null;
  }
}

// ── the writing out ─────────────────────────────────────────────────────────

/**
 * @param {string} source  the template's HTML (a fragment; html/head/body wrappers are dropped)
 * @returns {{ html: string, slots: string[], problems: string[] }}
 *   `problems` names what was stripped (a tag, an attribute, a url), for the build's warning and the PR's reviewer;
 *   a clean template has none.
 */
export function sanitizeHtml(source) {
  const problems = new Set();
  let src = String(source ?? "");
  if (src.length > LIMITS.html) { problems.add("size-limit"); src = src.slice(0, LIMITS.html); }
  const tokens = [];
  tokenize(clean(src), tokens);
  const tree = build(tokens, problems);
  const slots = [];
  let out = "";

  const write = (node) => {
    if (node.text !== undefined) { out += esc(clean(decode(node.text))); return; }
    const { name } = node;
    if (node.deep) return;
    const slot = SLOT_TAGS[name];
    if (slot) {
      if (slots.includes(slot)) { problems.add("duplicate-slot:" + slot); return; }
      slots.push(slot);
      out += `<div data-hearth-slot="${slot}"></div>`;
      return;
    }
    if (name === "html" || name === "body") { node.children.forEach(write); return; }
    if (DROP.has(name)) { problems.add("tag:" + name); return; }
    if (!TAGS.has(name)) {
      if (name.startsWith("hearth-")) problems.add("slot:" + name);
      else problems.add("tag:" + name);
      node.children.forEach(write);
      return;
    }
    const attrs = [];
    for (const a of node.attrs ?? []) {
      const k = keepAttr(name, a, problems);
      if (k) attrs.push(k);
    }
    if (name === "a") attrs.push(["rel", "noopener noreferrer nofollow ugc"]);
    if (name === "img") { attrs.push(["loading", "lazy"]); attrs.push(["decoding", "async"]); if (!attrs.some(([k]) => k === "alt")) attrs.push(["alt", ""]); }
    let open = "<" + name;
    for (const [k, v] of attrs) open += v === "" && (k === "open" || k === "reversed" || k === "data-single") ? " " + k : ` ${k}="${esc(v)}"`;
    open += ">";
    if (name === "img" && !attrs.some(([k]) => k === "src")) return;     // an image with no allowed source is nothing
    out += open;
    if (!VOID.has(name)) {
      node.children.forEach(write);
      out += `</${name}>`;
    }
  };
  tree.children.forEach(write);
  return { html: out, slots, problems: [...problems].sort() };
}
