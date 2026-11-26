// join-berth.mjs — A NEW HOUSE'S WAY IN, UNDER THE RULED FALLBACK (CORE-188): board a berth, begin under it, and the human co-signs on the office's
// own page. Pure: it shapes the requests and reads the answers; town/pages/join/move-in.astro makes them, and test/join-berth.test.mjs holds them.
//
// WHY THIS ROAD. Darko, 2026-11-25: "Fallback, only if that proves hard: the office co-sign page, styled to match the flow." The site's own sign-in
// (generic PKCE) spends its consent before the form, and the office's human-only writer (the town name, short line, pronouns and likeness, POS-1237)
// lives on the berth co-sign alone (Rivet's source disposition, POS-1237). So Facet applied the fallback (2026-11-25 21:11Z) through the office's
// existing doors, no new one:
//   1. POST /berth { slug }  — keyless, rate-limited (Office f22c069a src/server.mjs § POST /berth); answers a berth key, shown once
//   2. POST /household { do: "begin", args }  with that key as the bearer (src/household-apex.mjs § doBegin): parks the declaration and answers
//      `cosign_url` (/oauth/berth-cosign?slug=…&b=…)
//   3. the human opens that link: GitHub sign-in, then the office's own co-sign page, which asks their profile and the likeness under its own
//      GitHub-bound pair, and runs the parked declaration (src/oauth.mjs § the berth co-sign)
//   4. the berth key now acts as the household ("same key, grown standing"): GET /me with it names the handle, and the page finishes what the
//      card did not carry through the resident's own doors (join-after.mjs)
//
// THE KEY IS THE PAGE'S, FOR THIS SEND ONLY. It is minted on the reader's deliberate Send, never while typing; held in the page's memory, never in
// storage, the address bar or the page; never put in the office prototype's key slot (the reader's own sign-in stays theirs); and reused, not
// re-minted, when the same send is tried again in this tab. A tab closed between the berth and the co-sign leaves the berth to sunset on the
// office's own clock (fourteen crossings, seven days), and the co-sign link, which carries no key, still works until then.
//
// THE BERTH'S NAME IS THE HANDLE, FOR NOW. The co-sign on today's Office runs the declaration with `handle: <the berth's slug>`, so the handle
// must pass BOTH rules: the berth's (Office src/oauth.mjs § BERTH_SLUG, 2–31 characters, starting with a letter or digit; no the- or berth-
// prefix; not one of the town's own names) and the handle's (residency's, 2–40 characters, lowercase letters, digits and single hyphens). The
// narrower one is said out loud. Wright (CORE-188, 2026-11-26): "keep the accepted 2–40 characters … co-sign declares the chosen handle, not
// pending.slug". Rivet's receiver (Office #1237 candidate c1bd858b, NOT yet accepted or merged) parks begin's `handle` apart from the berth's slug,
// answers `{ handle: <the resident it will declare>, berth: <the slug> }`, and the co-sign declares that handle. So this file already sends the
// chosen handle on begin, reads the resident from the office's answer, and checks admission against THAT resident (residentOf, admittedBy); an
// office before the receiver takes the field and ignores it (DECLARE_SCHEMA, the handle exempt) and answers the slug, which on this road is the
// same name while the 31 rule stands. The rule widens to 40 only on the receiver's actual train merge.

import { siteWriteHeaders } from "./office-write.mjs";

/** The office's berth name rule (Office f22c069a src/oauth.mjs § BERTH_SLUG): 2–31 characters. */
export const BERTH_SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;
export const BERTH_SLUG_MAX = 31;
/** The handle's own rule (Office src/declare.mjs § DECLARE_BOUNCES): lowercase letters, digits and single hyphens, 2–40 characters. */
export const HANDLE_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The town's own names, which neither a berth nor a handle may wear (Office src/residency.mjs § RESERVED, as declare's bounce list names them). */
export const TOWN_NAMES = Object.freeze(["template", "index", "office", "postmaster", "ferry", "the-town"]);

/** What the handle box says on this road, where the berth's name becomes the handle. */
export const BERTH_HANDLE_WORDS = "Where letters find them, and their page's address. On the way in a new house takes, this name first boards your agent's berth, so it follows the berth's rule too: 2–31 lowercase letters, digits and single hyphens, not starting with the- or berth-.";

/** Why a handle can't board and become the handle, in words, or null when it can. */
export function berthSlugProblem(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s !== s.toLowerCase()) return "A handle is lowercase: letters, digits and single hyphens.";
  if (!HANDLE_RULE.test(s)) return "A handle is lowercase letters, digits and single hyphens, with no hyphen at either end.";
  if ([...s].length < 2) return "A handle is at least 2 characters.";
  if (!BERTH_SLUG.test(s)) return `A handle on this way in is at most ${BERTH_SLUG_MAX} characters: it first boards your agent's berth, and a berth's name is ${BERTH_SLUG_MAX} at most.`;
  if (s.startsWith("the-") || s.startsWith("berth-")) return "A handle can't start with the- or berth-: those are the town's own prefixes.";
  if (TOWN_NAMES.includes(s)) return `"${s}" is one of the town's own names. Pick another.`;
  return null;
}

/** Step 1: board. Keyless: the reader's own sign-in never rides it. */
export function boardRequest(base, slug) {
  return { url: `${base}/berth`, init: { method: "POST", headers: siteWriteHeaders(null), body: JSON.stringify({ slug: String(slug).trim() }) } };
}

/** The berth out of the board's answer: `{slug, key}`, or null when the answer is not a berth. The key is never logged or shown. */
export function berthOf(answer, slug) {
  if (!answer || typeof answer !== "object" || typeof answer.key !== "string" || !answer.key) return null;
  if (String(answer.berth ?? "") !== String(slug)) return null;
  return { slug: answer.berth, key: answer.key, expires: answer.expires_at ?? null };
}

/** A board refusal in plain words: the office's own when it gave them, and what a taken name means for this reader. */
export function boardRefusal(status, data) {
  const told = data && typeof data.defect === "string" ? data.defect + (typeof data.hint === "string" && data.hint ? " — " + data.hint : "") : null;
  if (status === 0) return "Couldn't reach the office to take a berth. Nothing was sent; try again.";
  if (status === 409) return `${told ?? "That name is already held"}. If it's a berth you took on an earlier try from another tab, it frees itself after seven days; pick another handle to go on now.`;
  if (status === 429) return `${told ?? "The gangplank is busy"}. Wait a few minutes and send again; nothing was sent.`;
  return told ?? `The office wouldn't give a berth (${status}). Nothing was sent.`;
}

/**
 * Step 2: begin under the berth, carrying the chosen resident's handle with what the card takes (and nothing it doesn't). The receiver parks it
 * apart from the berth's slug; an office before it takes the field and ignores it, declaring the slug (the same name under the 31 rule).
 */
export function beginBody(args) {
  return { do: "begin", args: { ...(args ?? {}) } };
}

/**
 * Who the co-sign will admit, by the office's own answer to begin: `{resident, berth, receiver}`. `resident` is the answer's `handle` when it is
 * a handle, else the berth's slug (what an office before the receiver declares); `receiver` is whether the answer names the berth apart
 * (`berth`, the receiver's mark), never a guess from the page's side.
 */
export function residentOf(answer, slug) {
  const named = answer && typeof answer.handle === "string" && HANDLE_RULE.test(answer.handle.trim()) ? answer.handle.trim() : null;
  return { resident: named ?? String(slug), berth: String(slug), receiver: Boolean(answer && typeof answer.berth === "string" && answer.berth === slug) };
}

/** What the co-sign screen says when the office will admit another name than the one asked for, in its terms; null when they agree. */
export function residentWords(asked, resident) {
  const a = String(asked ?? "").trim();
  if (!a || a === resident) return null;
  return `The office answered that your agent will be admitted as ${resident}, not ${a}. That's the name the co-sign declares.`;
}

/** The berth key as the shape the site's write helpers take (sheet-upload.mjs § tokenIsFresh reads `obtained` and `expires_in`). */
export function berthToken(berth, now = Date.now()) {
  const expiresIn = berth?.expires ? Math.max(60, Math.round((Date.parse(berth.expires) - now) / 1000)) : 7 * 24 * 3600;
  return { access_token: berth.key, obtained: now, expires_in: Number.isFinite(expiresIn) ? expiresIn : 7 * 24 * 3600 };
}

/**
 * The co-sign link out of begin's answer, or null. Only the office's own berth co-sign door for THIS berth counts: the link is opened in the
 * reader's browser, so an answer that names any other place is not followed. `origins` are the office's (the page's own, and postmark.town).
 */
export function cosignOf(answer, slug, origins) {
  const raw = answer && typeof answer.cosign_url === "string" ? answer.cosign_url : null;
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!origins.includes(u.origin) || !/\/oauth\/berth-cosign$/.test(u.pathname) || u.searchParams.get("slug") !== slug) return null;
  if (u.protocol !== "https:" && u.hostname !== "127.0.0.1" && u.hostname !== "localhost") return null;
  return u.href;
}

/**
 * Whether the office has admitted the berth's resident: /me, asked with the berth key, names THAT resident (residentOf's, the chosen handle on the
 * receiver; the berth's slug before it) among its handles (sheet-upload.mjs § ownsResident). The finishing writes then target the same name.
 */
export function admittedBy(me, resident) {
  return Boolean(me && Array.isArray(me.handles) && me.handles.includes(resident));
}
