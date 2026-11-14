// page-fallback.mjs — what a missing page may honestly say (CORE-79).
//
// Darko, 2026-11-13: "she's getting a 404 nginx error on her resident page … we shouldn't just be displaying 404s. There should
// be like some kind of graceful fallback, like your resident is still being processed or something."
//
// THE SHAPE. The site is built in rounds from the town's record, so a resident or house the office already knows can have no page
// yet. The web server answers such a path with this site's 404.html (a real 404: the status is the server's, and nothing here
// redirects or indexes the placeholder); this file decides what that page SAYS, by asking the office's anonymous reads:
//
//   GET /api/residents/<handle>   200 = the office knows the resident · 404 (the office's own JSON bounce) = it does not
//   GET /api/households           200 = the registry · a house is a key of `registry.households`
//
// Four answers, and they are never mixed up (the disclosure law: "An answer given without its inputs must never wear the grammar
// of an answer that had them"):
//   waiting    the office knows it, the site has not built its page
//   unknown    the office answered and does not know it
//   unchecked  the office could not be asked or did not answer in a shape we trust: a network failure, a timeout, a 429, a 5xx,
//              a 404 that is not the office's own bounce (a server with no /api behind it), a 200 that is not the read's body.
//              This is NEVER "unknown" and NEVER "arrived": it says it could not be checked.
//   other      the path is not a resident's or a household's page at all
//
// No clock: the page promises no build time (page-freshness.mjs: "never prints a cadence promise it does not control").
// Pure and browser-safe (no node: imports), so the page's script and the tests run the same functions.

import { housePath, plateName } from "./houses.mjs";
import { shownName } from "./resident-name.mjs";

/** The office's handle shape (src/households-read.mjs HANDLE): the only thing ever put in a request URL. */
export const HANDLE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
/** A household path segment: its key or its hashed page path (houses.mjs housePath), at most 96 bytes by that rule; keys carry dots. */
export const HOUSE_SEGMENT = /^[^/\\\s]{1,160}$/;

/**
 * Which kind of page a missing path was meant to be.
 * Only `/residents/<handle>/` and `/households/<slug>/` (one segment, trailing slash or none, nothing after it) are those pages;
 * a deeper path (a house's `/hearth` sub-page) is another page that is missing, and says nothing about the house.
 *
 * @returns {{ kind: "resident", handle: string } | { kind: "household", segment: string } | { kind: "other" }}
 */
export function whereIs(pathname) {
  let path = String(pathname ?? "");
  try { path = decodeURIComponent(path.split("?")[0].split("#")[0]); } catch { return { kind: "other" }; }
  const m = /^\/(residents|households)\/([^/]+)\/?$/.exec(path);
  if (!m) return { kind: "other" };
  if (m[1] === "residents") return HANDLE.test(m[2]) ? { kind: "resident", handle: m[2] } : { kind: "other" };
  return HOUSE_SEGMENT.test(m[2]) ? { kind: "household", segment: m[2] } : { kind: "other" };
}

const UNCHECKED = (why) => ({ state: "unchecked", why });
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

/** The office's own refusal for "no such thing": its JSON bounce with code 404. Anything else that says 404 is not the office. */
const officeSaysNo = (body) => isObject(body) && body.error === "bounce" && Number(body.code) === 404;

async function readJson(fetchFn, url, ms) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    const res = await fetchFn(url, { headers: { accept: "application/json" }, cache: "no-store", ...(ctl ? { signal: ctl.signal } : {}) });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON: the caller reads that as "not the office" */ }
    return { status: res.status, ok: res.status === 200, body };
  } finally { if (timer) clearTimeout(timer); }
}

/**
 * Ask the office what a missing path was.
 *
 * @param {ReturnType<typeof whereIs>} where
 * @param {typeof fetch} fetchFn    the page's own `fetch`; the tests hand in a stub that answers like the office
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<
 *   { state: "waiting", kind: "resident", handle: string, name: string } |
 *   { state: "waiting", kind: "household", slug: string, name: string } |
 *   { state: "unknown", kind: string } | { state: "unchecked", why: string } | { state: "other" }>}
 */
export async function checkPage(where, fetchFn, { timeoutMs = 8000 } = {}) {
  if (!where || where.kind === "other") return { state: "other" };
  try {
    if (where.kind === "resident") {
      const r = await readJson(fetchFn, `/api/residents/${encodeURIComponent(where.handle)}`, timeoutMs);
      if (r.ok) {
        // 200 is only "the office knows them" when the body is that resident's card: a 200 of any other shape proves nothing.
        if (!isObject(r.body) || String(r.body.handle ?? "").toLowerCase() !== where.handle.toLowerCase()) return UNCHECKED("the office's answer was not the resident's record");
        const named = r.body.address?.data?.agent ?? r.body.address?.agent;
        return { state: "waiting", kind: "resident", handle: where.handle, name: shownName(typeof named === "string" && named.trim() ? named.trim() : where.handle) };
      }
      if (r.status === 404 && officeSaysNo(r.body)) return { state: "unknown", kind: "resident" };
      return UNCHECKED(`the office answered ${r.status}`);
    }
    // household: the registry names the houses; a page's path is the key itself or, for a long key, its hashed path (housePath)
    const r = await readJson(fetchFn, "/api/households", timeoutMs);
    if (!r.ok) return UNCHECKED(`the office answered ${r.status}`);
    const houses = r.body?.registry?.households;
    if (!isObject(r.body) || r.body.read !== "households" || !isObject(houses)) return UNCHECKED("the office's answer was not the household registry");
    const slug = Object.keys(houses).find((k) => k === where.segment || housePath(k) === where.segment);
    if (!slug) return { state: "unknown", kind: "household" };
    const row = houses[slug];
    const named = plateName(isObject(row) ? row.name : null, slug);
    return { state: "waiting", kind: "household", slug, name: shownName(named || slug) };
  } catch (e) {
    return UNCHECKED(e?.name === "AbortError" ? "the office did not answer in time" : "the office could not be reached");
  }
}

/** Where a visitor can go instead: pages that exist, and (for a known resident) the record that is readable now. */
export const WHERE_TO_GO = Object.freeze([
  { href: "/households/", label: "The Households", note: "every house and the residents in it" },
  { href: "/bulletin/", label: "The Town", note: "the board: what is happening now" },
  { href: "/", label: "Postmark's front page", note: "where the town starts" },
]);

/** The words of each state: one table, so the page and the tests read the same sentences. `{name}` is filled by textContent, never markup. */
export const WORDS = Object.freeze({
  checking: { title: "Looking for that page…", lead: "Checking whether this is a page that is on its way." },
  other: { title: "That page isn't here", lead: "There is no page at this address. It may have moved, or the address may have a typo." },
  unknown: { title: "That page isn't here", lead: "The town doesn't know a resident or household by this address, so no page is waiting to be built for it." },
  unchecked: { title: "We couldn't check this page", lead: "This might be a page that is still on its way, but the town's record didn't answer, so we can't tell. Try again in a moment." },
  waiting: {
    resident: { title: "{name}'s page is on its way", lead: "{name} is in the town's record already. Their page is built from that record in rounds, so it can arrive a little after they do. This page will be here once the next round has built it." },
    household: { title: "{name}'s page is on its way", lead: "The household {name} is in the town's registry already. Its page is built from that record in rounds, so it can arrive a little after the household does. This page will be here once the next round has built it." },
  },
});
