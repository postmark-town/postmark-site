// entries.mjs — the registered Hearth entries, sanitized (POS-959).
//
// The town repo is the source of truth and the approval gate, as for the resident
// renditions: an entry that stands on main in `PROJECTS/household-hearths/<id>/`
// was reviewed and merged, and tools/sync-hearths.mjs copies it into
// src/data/postmark/hearths.json (raw: id, title, author, line, html, css). THIS
// module reads that file and makes each entry safe: sanitizeHtml and sanitizeCss
// (the only road from a template to a page), then cuts the markup at its slot
// markers so the page can draw each slot with the site's own part.
//
// An entry is never an arbitrary URL or arbitrary HTML someone typed: it is a
// folder in the town repo, registered by merge, resolved by id here.

import { sanitizeHtml } from "./sanitize-html.mjs";
import { sanitizeCss } from "./sanitize-css.mjs";
import { ENTRY_ID, DEFAULT_ENTRY, LIMITS } from "./slots.mjs";

const SLOT_MARK = /<div data-hearth-slot="([a-z-]+)"><\/div>/g;

const plain = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** The markup cut at its slot markers: [{ html } | { slot }], in order. */
export function segmentsOf(html) {
  const out = [];
  let last = 0;
  for (const m of html.matchAll(SLOT_MARK)) {
    if (m.index > last) out.push({ html: html.slice(last, m.index) });
    out.push({ slot: m[1] });
    last = m.index + m[0].length;
  }
  if (last < html.length) out.push({ html: html.slice(last) });
  return out;
}

/**
 * One raw entry, made safe. Never throws: a bad entry comes back `ok: false` with why,
 * so one bad folder cannot take the others' Hearths down with it.
 */
export function prepareEntry(raw) {
  const id = String(raw?.id ?? "");
  if (!ENTRY_ID.test(id)) return { ok: false, id, error: "an entry's id is its folder name: lowercase letters, digits and hyphens, at most 40" };
  const h = sanitizeHtml(raw.html);
  const c = sanitizeCss(raw.css ?? "", id);
  if (!h.html.trim()) return { ok: false, id, error: "the template has no markup after sanitizing", problems: h.problems };
  // THE HOUSE'S OWN SCRIPT (v2, POS-1024/a): `hearth.js`, raw. It is code, reviewed by hand at the town PR, never sanitized here (there is nothing a
  // sanitizer could keep of a script); it is served from the site's own origin (town/pages/hearths/[id].js.js) and run on the page (script.mjs).
  // Only its fingerprint rides the entry, so the page's JSON never carries code. Over the size cap it is not served, and that is said.
  const problems = [...h.problems, ...c.problems];
  let script = null;
  if (typeof raw.js === "string" && raw.js.trim()) {
    if (raw.js.length > LIMITS.script) problems.push("script:size-limit");
    else script = { hash: fingerprint(raw.js), bytes: raw.js.length };
  }
  return {
    ok: true,
    id,
    script,
    title: plain(raw.title, LIMITS.title) || id,
    author: plain(raw.author, 60) || null,
    line: plain(raw.line, LIMITS.line),
    html: h.html,
    css: c.css,
    segments: segmentsOf(h.html),
    slots: h.slots,
    problems,
  };
}

/** A content fingerprint (two FNV-1a passes, 16 hex): it versions the script's address, so a merged change is never read from a stale cache. Not a security check. */
export function fingerprint(text) {
  const s = String(text ?? "");
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** All the entries: the default first, then by title. A rejected one is listed, never dropped silently. */
export function prepareEntries(rows) {
  const entries = [];
  const rejected = [];
  const seen = new Set();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const e = prepareEntry(raw);
    if (!e.ok) { rejected.push(e); continue; }
    if (seen.has(e.id)) { rejected.push({ ok: false, id: e.id, error: "two entries with one id" }); continue; }
    seen.add(e.id);
    entries.push(e);
  }
  entries.sort((a, b) => (b.id === DEFAULT_ENTRY) - (a.id === DEFAULT_ENTRY) || a.title.localeCompare(b.title));
  return { entries, rejected };
}

/** The entry named, or the default, or the first there is. `null` only when none is registered at all. */
export function pickEntry(entries, id) {
  return entries.find((e) => e.id === id) ?? entries.find((e) => e.id === DEFAULT_ENTRY) ?? entries[0] ?? null;
}
