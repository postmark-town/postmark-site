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
  return {
    ok: true,
    id,
    title: plain(raw.title, LIMITS.title) || id,
    author: plain(raw.author, 60) || null,
    line: plain(raw.line, LIMITS.line),
    html: h.html,
    css: c.css,
    segments: segmentsOf(h.html),
    slots: h.slots,
    problems: [...h.problems, ...c.problems],
  };
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
