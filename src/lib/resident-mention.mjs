// resident-mention.mjs — THE ONE WAY THE SITE NAMES A RESIDENT (CORE-178).
//
// Darko, 2026-11-24 08:43 EST: "There's like a certain way that we format residents now in like profile icon and then name, all using like their
// favorite color with an underscore. That's kind of just the standard way that we do things, and we should definitely standardize that for the
// site so that every implementation of like residents being mentioned across the site looks the same."
//
// So every place the Site itself names a resident draws this one form: the resident's PICTURE (their profile picture, else their initial), then
// their NAME in their favourite colour, underlined in it. It grew out of the household page's `who` (household-dashboard/paint.mjs, POS-260),
// which already drew the picture, the ring and the underline, but left the name's ink the page's own.
//
// ONE IMPLEMENTATION, ITS ADAPTERS. `mentionModel` decides everything (the name, the link, the colour, the picture, the fallbacks); `mentionTree`
// turns a model into the one markup tree. Every adapter only draws that tree: ResidentMention.astro walks it at build time through Astro's own
// escaping; `mentionNode` builds it as DOM for a page's live half (paint.mjs and the Hearth's painters); `mentionHtml` serialises it, escaped,
// for a build step that writes HTML strings (the mail pages). test/resident-mention.test.mjs holds mentionNode and mentionHtml to the same
// bytes, so the server's mention and the browser's cannot drift into two formats.
//
// THE COLOUR: READABLE DARKNESS ON ITS ACTUAL SURFACE (Darko, 2026-11-24 12:25 EST, a: "get everything to readable darkness"; Wright's
// authenticated 17:29 reading, relayed in Facet's ruling of 17:38Z: "every coloured part — name, underline and ring — uses the favourite hue at
// readable darkness on its actual surface, including authored light-glass surfaces. No exact-colour exception."). So the mention has ONE ink, and
// the name, its underline and the face's ring all wear it (resident-mention.css paints the underline and ring in currentColor). The ink is the
// favourite colour itself when it already reads at WCAG AA (4.5:1) on the surface; when it does not, only its lightness moves (same hue, same
// saturation) until it does. Until 2026-11-24 17:38Z the ring and underline wore the raw colour; the ruling retired that.
// THE SURFACES. The site's own two, the harbor night and the letter paper (postmark.css), are known at build time: each mention carries its ink
// for both (`--rm-ink-n`, `--rm-ink-p`), measured against each surface's LIGHTEST night and DARKEST paper, and resident-mention.css picks the paper
// one inside `.pm-paper`, `[data-rm-surface="paper"]` or `.on-paper`. A surface the site does not know at build time (a Hearth design's own glass
// and paper, set by its template) is measured where it is: resident-mention-surface.mjs reads the real background under each mention in the
// browser and writes the ink for THAT colour (`--rm-ink`, `.on-ink`); `inkOn` takes any background hex for it.
//
// THE FALLBACKS (faces.mjs's rule, kept): a resident who set no colour gets a quiet mention in the neutral hairline, never an invented colour;
// a resident with no picture wears their initial. A handle with no resident page prints as plain text (resident-link.mjs's rule). A house's
// human (`human-of-*`) is a human, never a resident: plain text, with no picture and no colour, linked or not.
//
// TEXT IS TEXT. Every resident-written string (a name, a handle) is escaped by `mentionHtml` and set through textContent by `mentionNode`. A
// colour is admitted only as a plain hex, a picture only as a same-site path or an https address with no quote or space in it.
//
// Pure, and it imports only resident-name.mjs (pure too), so the browser bundles stay small and a test can run it whole.

import { shownName } from "./resident-name.mjs";

/** The contrast every mention's name keeps against its surface (WCAG 2.x AA, normal text). */
export const MIN_CONTRAST = 4.5;

/** The two surfaces a mention sits on, at the shade of each that is hardest for the ink (postmark.css: --pm-harbor-2 and --pm-paper-deep). */
export const SURFACES = Object.freeze({ night: "#1c2c4f", paper: "#efe3c8" });

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A plain hex colour, lower-cased and six digits long, or null. */
export function hexOf(c) {
  const s = typeof c === "string" ? c.trim() : "";
  if (!HEX.test(s)) return null;
  const h = s.slice(1).toLowerCase();
  return "#" + (h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h);
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const channel = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio of two hex colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hslOf(hex) {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hexOfHsl(h, s, l) {
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rgb;
  if (s === 0) rgb = [l, l, l];
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  }
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * The ink a favourite colour is written in on a surface: the colour itself when it reads at MIN_CONTRAST there, else the same hue and
 * saturation at the nearest lightness that does (lighter on the night, darker on the paper). Null for no colour.
 */
export function inkOn(colour, surface = "night") {
  const c = hexOf(colour);
  // a named site surface, or the hex of the actual background under the mention (an authored Hearth glass, measured in the browser)
  const bg = Object.hasOwn(SURFACES, surface) ? SURFACES[surface] : hexOf(surface);
  if (!c || !bg) return null;
  if (contrast(c, bg) >= MIN_CONTRAST) return c;
  // a light background darkens the ink, a dark one lightens it: whichever end of the lightness scale reads better on it
  const darken = contrast("#000000", bg) >= contrast("#ffffff", bg);
  const [h, s, l] = hslOf(c);
  const step = darken ? -0.005 : 0.005;
  for (let x = l + step; x >= 0 && x <= 1; x += step) {
    const ink = hexOfHsl(h, s, x);
    if (contrast(ink, bg) >= MIN_CONTRAST) return ink;
  }
  return darken ? "#000000" : "#ffffff";
}

/** A house's human, by handle: never drawn as a resident. */
export const isHuman = (handle) => /^human-of-./.test(String(handle ?? ""));

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));

/** The initial a face without a picture wears: the name's first reader-character (a leading "the " skipped), upper-cased. */
export function monogramOf(name) {
  const first = graphemes(String(name ?? "").trim().replace(/^the\s+/i, ""))[0];
  return first ? first.toLocaleUpperCase() : "?";
}

// A picture lands in an attribute: a same-site path (never `//host`) or an https address, with nothing that could leave the attribute.
const PICTURE = /^(?:\/(?!\/)|https:\/\/)[^\s"'<>`\\]*$/;
export const pictureOf = (src) => (typeof src === "string" && src.length <= 2048 && PICTURE.test(src) ? src : null);

/**
 * Everything about one mention, decided once.
 *
 * @param {object} o
 * @param {string} o.handle     the handle the record wrote
 * @param {object|null} [o.face] the resident's face: faces.mjs residentFace's answer, or the same fields from a page's faces.json
 *                              ({ name, accent, avatar, monogram }). Null when the build has no resident behind the handle.
 * @param {string|null} [o.href] where the mention links: the resident's page (resident-link.mjs, renames followed), or null for no link
 * @param {string} [o.label]    words to show instead of the resident's name (rare: a record that must print its own words)
 * @returns {{kind: "resident", handle: string, name: string, title: string, href: string|null, accent: string|null,
 *            inkNight: string|null, inkPaper: string|null, avatar: string|null, monogram: string}
 *          | {kind: "text", handle: string, text: string}}
 */
export function mentionModel({ handle, face = null, href = null, label } = {}) {
  const h = String(handle ?? "");
  const words = typeof label === "string" && label.trim() ? label.trim() : null;
  // a house's human is a human: their words, never a resident's picture or colour, and no resident page
  if (isHuman(h)) return { kind: "text", handle: h, text: words ?? h };
  // a handle with no resident behind it and no page to go to is only a word on the record
  if (!face && !href) return { kind: "text", handle: h, text: words ?? h };
  const whole = words ?? ((typeof face?.name === "string" && face.name.trim()) || h);
  const accent = hexOf(face?.accent);
  return {
    kind: "resident",
    handle: h,
    name: shownName(whole),
    title: whole,
    href: typeof href === "string" && href ? href : null,
    accent,
    inkNight: inkOn(accent, "night"),
    inkPaper: inkOn(accent, "paper"),
    avatar: pictureOf(face?.avatar),
    monogram: (typeof face?.monogram === "string" && face.monogram.trim()) ? graphemes(face.monogram.trim())[0] : monogramOf(whole),
  };
}

/**
 * The one markup tree of a mention: `{ tag, attrs, children }` nodes and plain strings (text).
 *
 * @param {ReturnType<typeof mentionModel>} m
 * @param {object} [opts]
 * @param {boolean} [opts.link=true]   false draws the mention as a span (inside a card or chip that is already a link)
 * @param {string} [opts.cls]          extra classes on the root, kept as hooks (the Hearth's `hx-who`, the dashboard's `hd-who`)
 * @param {"night"|"paper"|string} [opts.surface] "paper" marks a mention on the letter paper outside a `.pm-paper` box; a hex is the solid
 *                                   background the page puts under it (a plate of its own, known at build time): the ink for THAT colour is written
 *                                   as `--rm-ink` with `on-ink`, the same contract resident-mention-surface.mjs writes for a surface measured in the
 *                                   browser
 * @param {boolean} [opts.face=true]   false: the name's styling only, for a card or chip whose own portrait is the resident's picture
 * @param {boolean} [opts.whole=false] true: the whole name, never shortened (the resident's own page keeps its name whole, however long;
 *                                   everywhere else the shown name is resident-name.mjs's shortened one, with the whole as its title)
 */
export function mentionTree(m, { link = true, cls = "", surface, face: withFace = true, whole = false } = {}) {
  if (!m || m.kind !== "resident") return [String(m?.text ?? "")];
  const plate = m.accent && !Object.hasOwn(SURFACES, surface ?? "") ? hexOf(surface) : null;
  const plateInk = plate ? inkOn(m.accent, plate) : null;
  const classes = ["rm", m.accent ? null : "is-neutral", surface === "paper" ? "on-paper" : null, plateInk ? "on-ink" : null, ...String(cls).split(/\s+/)].filter(Boolean);
  const attrs = { class: classes.join(" ") };
  const anchor = link && m.href;
  if (anchor) attrs.href = m.href;
  attrs["data-rm"] = m.handle;
  const shown = whole ? m.title : m.name;
  if (m.title !== shown) attrs.title = m.title;
  if (m.accent) attrs.style = `--rm-c: ${m.accent}; --rm-ink-n: ${m.inkNight}; --rm-ink-p: ${m.inkPaper}` + (plateInk ? `; --rm-ink: ${plateInk}` : "");
  const face = { tag: "span", attrs: { class: "rm-face", "aria-hidden": "true" }, children: m.avatar
    ? [{ tag: "img", attrs: { src: m.avatar, alt: "", loading: "lazy" }, children: [] }]
    : [m.monogram] };
  const name = { tag: "span", attrs: { class: "rm-name" }, children: [shown] };
  // `face: false` (Darko, 12:25 EST, b: "Card portrait counts as the picture"): a card or chip that already shows the resident's picture takes the
  // name's styling only, so each resident wears ONE face
  return [{ tag: anchor ? "a" : "span", attrs, children: withFace ? [face, name] : [name] }];
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const VOID = new Set(["img"]);

function html(n) {
  if (typeof n === "string") return escapeHtml(n);
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${escapeHtml(v)}"`).join("");
  return VOID.has(n.tag) ? `<${n.tag}${attrs}>` : `<${n.tag}${attrs}>${n.children.map(html).join("")}</${n.tag}>`;
}

/** The build's adapter: a mention as escaped HTML (ResidentMention.astro sets it; a page that builds HTML strings can splice it). */
export const mentionHtml = (m, opts) => mentionTree(m, opts).map(html).join("");

function dom(doc, n) {
  if (typeof n === "string") return doc.createTextNode(n);
  const e = doc.createElement(n.tag);
  for (const [k, v] of Object.entries(n.attrs)) e.setAttribute(k, v);
  for (const c of n.children) e.appendChild(dom(doc, c));
  return e;
}

/** The live half's adapter: the same tree as DOM, built with createElement / setAttribute / createTextNode only (never innerHTML). */
export function mentionNode(doc, m, opts) {
  const [root] = mentionTree(m, opts);
  return dom(doc, root);
}
