// sanitize-css.mjs — a Hearth template's CSS, made safe and SCOPED at build (POS-959).
//
// The template's stylesheet is parsed into rules and written back out from an
// ALLOWLIST, as sanitize-html.mjs does for markup:
//
//   scope        every selector is rewritten under the entry's stage,
//                `.hearth-stage[data-hearth-entry="<id>"] <selector>`, so a rule
//                reaches nothing outside the template; `:root`, `html` and `body`
//                mean the stage itself. The stage is `contain: layout paint`, so
//                even absolute and fixed boxes stay inside it.
//   selectors    tags from the markup allowlist and the slot markers, `.class`
//                (namespaced `u-`, as in the markup), a few attributes, a few
//                pseudo-classes and pseudo-elements, the four combinators. An id,
//                a namespace, a selector this list does not know: the rule's
//                selector is dropped.
//   at-rules     `@media` and `@keyframes` only. `@import`, `@font-face`, `@page`
//                and the rest are skipped whole.
//   properties   a list of presentational ones, and `--custom` ones. No `behavior`,
//                `-moz-binding`, `-webkit-*` loaders, no `src`.
//   values       no `url(`, `image-set(`, `expression(`, `@`, `\`, `<`, `{`, no
//                function off the list, no `position: fixed`, no `!important`.
//
// A template cannot load anything, cannot reach the site's own boxes, and cannot
// hide the site's chrome: the stage clips its children, and the host's frame around the stage
// (Hearth.astro, `.hearth-frame { contain: paint }`) clips the stage itself, which a rooted
// rule (:root, html, body) lands on and where margin and transform are allowed (POS-984).

import { ALLOWED_TAGS, CLASS_PREFIX } from "./sanitize-html.mjs";
import { SLOT_TAGS, LIMITS } from "./slots.mjs";

export const STAGE = ".hearth-stage";
export const stageFor = (id) => `${STAGE}[data-hearth-entry="${id}"]`;

const PROPS = new Set((
  "color background background-color background-image background-position background-size background-repeat background-clip background-origin background-attachment background-blend-mode " +
  "border border-top border-right border-bottom border-left border-color border-style border-width border-radius " +
  "border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius " +
  "border-top-color border-right-color border-bottom-color border-left-color border-top-style border-right-style border-bottom-style border-left-style " +
  "border-top-width border-right-width border-bottom-width border-left-width border-collapse border-spacing " +
  "outline outline-color outline-style outline-width outline-offset box-shadow text-shadow opacity " +
  "margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left " +
  "width height min-width max-width min-height max-height aspect-ratio box-sizing display visibility overflow overflow-x overflow-y " +
  "position top right bottom left z-index float clear " +
  "flex flex-direction flex-wrap flex-flow flex-grow flex-shrink flex-basis justify-content justify-items justify-self align-items align-content align-self order gap row-gap column-gap place-items place-content place-self " +
  "grid grid-template grid-template-columns grid-template-rows grid-template-areas grid-area grid-column grid-row grid-column-start grid-column-end grid-row-start grid-row-end grid-auto-flow grid-auto-columns grid-auto-rows " +
  "font font-family font-size font-weight font-style font-variant font-variant-numeric font-stretch line-height letter-spacing word-spacing text-align text-decoration text-decoration-color text-decoration-line text-decoration-style text-decoration-thickness text-underline-offset text-transform text-indent text-overflow white-space word-break overflow-wrap hyphens vertical-align list-style list-style-type list-style-position columns column-count column-gap column-rule " +
  "transform transform-origin transition transition-property transition-duration transition-timing-function transition-delay " +
  "animation animation-name animation-duration animation-timing-function animation-delay animation-iteration-count animation-direction animation-fill-mode animation-play-state " +
  "filter backdrop-filter mix-blend-mode object-fit object-position cursor pointer-events user-select scroll-behavior content quotes counter-reset counter-increment table-layout caption-side empty-cells writing-mode direction text-wrap"
).split(/\s+/));

const FUNCS = new Set((
  "rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix calc min max clamp var env " +
  "linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient " +
  "translate translatex translatey translatez translate3d rotate rotatex rotatey rotatez rotate3d scale scalex scaley scalez scale3d skew skewx skewy matrix matrix3d perspective " +
  "cubic-bezier steps minmax repeat fit-content blur brightness contrast grayscale hue-rotate invert opacity saturate sepia drop-shadow " +
  "counter counters attr"
).split(/\s+/));

const PSEUDO_CLASS = new Set(["hover", "focus", "focus-visible", "focus-within", "active", "first-child", "last-child", "only-child",
  "first-of-type", "last-of-type", "only-of-type", "empty", "target"]);
const PSEUDO_ELEMENT = new Set(["before", "after", "first-line", "first-letter", "marker", "selection"]);
const ATTRS = new Set(["data-tab", "data-panel", "data-hearth-behavior", "data-hearth-slot", "data-hearth-state", "data-single", "lang", "open", "aria-expanded", "aria-selected", "aria-hidden"]);

const strip = (s) => s.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ");

// split at a top-level separator, outside (), [] and strings
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, q = "", cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q) q = ""; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    if (c === sep && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

// the index of the "}" that closes the "{" at `open`, strings respected; -1 if none
function matchBrace(s, open) {
  let depth = 0, q = "";
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = ""; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

const ATTR = /^\[\s*([a-z][a-z0-9-]*)\s*(?:([~|^$*]?=)\s*(?:"([A-Za-z0-9 _.:-]{0,60})"|'([A-Za-z0-9 _.:-]{0,60})'|([A-Za-z0-9_.:-]{1,60})))?\s*\]/;

// ── selectors ───────────────────────────────────────────────────────────────

/** One selector, validated and rewritten (classes namespaced, slot tags to their attribute); null when anything is off the list. */
function selectorOf(raw, stage) {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s || s.length > 200) return null;
  let out = "";
  let i = 0;
  let compoundStart = true;
  let rooted = false;
  const m = (re) => { re.lastIndex = i; const r = re.exec(s); return r && r.index === i ? r[0] : null; };
  while (i < s.length) {
    let t;
    if (s[i] === " " || s[i] === ">" || s[i] === "+" || s[i] === "~") {
      let j = i;
      while (s[j] === " ") j++;
      const comb = ">+~".includes(s[j]) ? s[j] : " ";
      if (comb !== " ") j++;
      while (s[j] === " ") j++;
      if (compoundStart || j >= s.length) return null;
      out += comb === " " ? " " : ` ${comb} `;
      i = j;
      compoundStart = true;
      continue;
    }
    if ((t = m(/:root(?![\w-])/y)) || (t = m(/(?:html|body)(?![\w-])/y))) {
      if (!compoundStart || out) return null;               // the root only leads a selector
      rooted = true;
      i += t.length;
      compoundStart = false;
      continue;
    }
    if ((t = m(/\*/y))) { out += "*"; i += 1; compoundStart = false; continue; }
    if ((t = m(/[a-zA-Z][a-zA-Z0-9-]*/y))) {
      if (!compoundStart) return null;
      const tag = t.toLowerCase();
      if (SLOT_TAGS[tag]) out += `[data-hearth-slot="${SLOT_TAGS[tag]}"]`;
      else if (ALLOWED_TAGS.has(tag)) out += tag;
      else return null;
      i += t.length;
      compoundStart = false;
      continue;
    }
    if ((t = m(/\.[A-Za-z_][A-Za-z0-9_-]{0,39}/y))) { out += "." + CLASS_PREFIX + t.slice(1); i += t.length; compoundStart = false; continue; }
    if (s[i] === "[") {
      const am = ATTR.exec(s.slice(i));
      if (!am) return null;
      const [whole, name, op, dq, sq, bare] = am;
      if (!ATTRS.has(name) && !/^data-sort-[a-z][a-z0-9-]{0,15}$/.test(name)) return null;
      out += op ? `[${name}${op}"${dq ?? sq ?? bare}"]` : `[${name}]`;
      i += whole.length;
      compoundStart = false;
      continue;
    }
    if ((t = m(/::[a-z-]+/y))) {
      if (!PSEUDO_ELEMENT.has(t.slice(2))) return null;
      out += t; i += t.length; compoundStart = false; continue;
    }
    if ((t = m(/:(?:nth-child|nth-of-type|nth-last-child)\(\s*(?:odd|even|[+-]?\d*n?\s*(?:[+-]\s*\d+)?)\s*\)/y))) {
      out += t.replace(/\s+/g, ""); i += t.length; compoundStart = false; continue;
    }
    if ((t = m(/:[a-z-]+/y))) {
      if (!PSEUDO_CLASS.has(t.slice(1))) return null;
      out += t; i += t.length; compoundStart = false; continue;
    }
    return null;
  }
  if (compoundStart && out) return null;                    // ended on a combinator
  if (!out && !rooted) return null;
  // the root, alone or leading, is the stage; anything else is a descendant of it
  if (rooted) return stage + out;
  return stage + " " + out;
}

// ── values ──────────────────────────────────────────────────────────────────

function valueOk(prop, value) {
  if (value.length > 400 || /[\\@<{}]|\/\*|\*\//.test(value)) return false;
  if (/url\s*\(|image-set\s*\(|expression\s*\(|javascript:|-moz-binding|behavior/i.test(value)) return false;
  if (/!\s*important/i.test(value)) return false;
  for (const fn of value.matchAll(/([a-zA-Z-]+)\s*\(/g)) if (!FUNCS.has(fn[1].toLowerCase())) return false;
  if (prop === "position" && !/^(static|relative|absolute|sticky)$/i.test(value.trim())) return false;
  if (prop === "content" && !/^(none|normal|"[^"\\]{0,80}"|'[^'\\]{0,80}')$/i.test(value.trim())) return false;
  if (prop === "cursor" && /url/i.test(value)) return false;
  return true;
}

function declarationsOf(body, problems, keyframeNames) {
  const decls = [];
  for (const part of splitTop(body, ";")) {
    const at = part.indexOf(":");
    if (at <= 0) { if (part.trim()) problems.add("css:declaration"); continue; }
    const prop = part.slice(0, at).trim().toLowerCase();
    let value = part.slice(at + 1).trim().replace(/\s+/g, " ");
    const custom = /^--[a-z0-9-]{1,40}$/.test(prop);
    if (!custom && !PROPS.has(prop)) { problems.add("css:property:" + prop.slice(0, 30)); continue; }
    if (!valueOk(prop, value)) { problems.add("css:value:" + prop.slice(0, 30)); continue; }
    if ((prop === "animation" || prop === "animation-name") && keyframeNames.size) {
      value = value.replace(/[A-Za-z_][A-Za-z0-9_-]*/g, (w) => (keyframeNames.has(w) ? CLASS_PREFIX + w : w));
    }
    decls.push(`${prop}:${value}`);
  }
  return decls.join(";");
}

// ── the sheet ───────────────────────────────────────────────────────────────

/**
 * @param {string} source the template's CSS
 * @param {string} id     the entry's id (it names the stage)
 * @returns {{ css: string, problems: string[] }}
 */
export function sanitizeCss(source, id) {
  const problems = new Set();
  let src = String(source ?? "");
  if (src.length > LIMITS.css) { problems.add("css:size-limit"); src = src.slice(0, LIMITS.css); }
  src = strip(src).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
  const stage = stageFor(id);
  const keyframeNames = new Set([...src.matchAll(/@keyframes\s+([A-Za-z_][A-Za-z0-9_-]{0,39})\s*\{/g)].map((m) => m[1]));
  let rules = 0;

  const block = (text, inMedia) => {
    let out = "";
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length) break;
      if (rules > LIMITS.rules) { problems.add("css:rule-limit"); break; }
      const open = text.indexOf("{", i);
      const semi = text.indexOf(";", i);
      if (text[i] === "@") {
        const name = /^@[a-zA-Z-]+/.exec(text.slice(i))?.[0].toLowerCase() ?? "@";
        if (open === -1 || (semi !== -1 && semi < open)) {          // a statement at-rule: @import, @charset, @namespace
          problems.add("css:at:" + name.slice(1)); i = semi === -1 ? text.length : semi + 1; continue;
        }
        const close = matchBrace(text, open);
        const end = close === -1 ? text.length : close;
        const prelude = text.slice(i + name.length, open).trim();
        const inner = text.slice(open + 1, end);
        i = close === -1 ? text.length : close + 1;
        if (name === "@media" && !inMedia && /^[A-Za-z0-9\s:(),.<>=/-]{1,160}$/.test(prelude) && !/url|expression/i.test(prelude)) {
          const body = block(inner, true);
          if (body) out += `@media ${prelude.replace(/\s+/g, " ")}{${body}}`;
          rules++;
        } else if (name === "@keyframes" && /^[A-Za-z_][A-Za-z0-9_-]{0,39}$/.test(prelude) && !inMedia) {
          let frames = "";
          for (let f = 0; f < inner.length;) {
            const fo = inner.indexOf("{", f);
            if (fo === -1) break;
            const fc = matchBrace(inner, fo);
            const sel = inner.slice(f, fo).trim();
            const fb = inner.slice(fo + 1, fc === -1 ? inner.length : fc);
            f = fc === -1 ? inner.length : fc + 1;
            if (!/^(from|to|\d{1,3}%)(\s*,\s*(from|to|\d{1,3}%))*$/.test(sel)) { problems.add("css:keyframe"); continue; }
            const d = declarationsOf(fb, problems, keyframeNames);
            if (d) frames += `${sel.replace(/\s+/g, "")}{${d}}`;
          }
          if (frames) out += `@keyframes ${CLASS_PREFIX}${prelude}{${frames}}`;
          rules++;
        } else problems.add("css:at:" + name.slice(1));
        continue;
      }
      if (open === -1) { problems.add("css:stray"); break; }
      const close = matchBrace(text, open);
      const end = close === -1 ? text.length : close;
      const prelude = text.slice(i, open);
      const body = text.slice(open + 1, end);
      i = close === -1 ? text.length : close + 1;
      const selectors = [];
      for (const raw of splitTop(prelude, ",")) {
        const sel = selectorOf(raw, stage);
        if (sel) selectors.push(sel); else problems.add("css:selector:" + raw.trim().slice(0, 40));
      }
      if (!selectors.length) continue;
      const decls = declarationsOf(body, problems, keyframeNames);
      if (decls) { out += `${selectors.join(",")}{${decls}}`; rules++; }
    }
    return out;
  };
  return { css: block(src, false), problems: [...problems].sort() };
}
