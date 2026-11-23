// ballot-panel.mjs — the open ballots in the Civic Quarter's Ballot House panel, read live from the office (POS-1060).
//
// Darko, 2026-11-15 (the Ballot House): "the ballot house ... to be the main place where you see the ballots ... right now that portion
// is just kind of a redirect, unlike the quest guild or think tank." Wright's go: the open ballots in the civic panel, read live; /votes/
// is the full view.
//
// WHAT THIS IS. `GET <office>/votes` (public, the same read /votes/ makes) fetched in the browser and drawn compactly: each OPEN ballot's
// name, its window as the office wrote it, and each design's stamps and backing households as the office counted them. Nothing is baked
// into the page: a second answer changes the panel WITHOUT a site rebuild, which is the whole reason it is read here and not at build time.
// The page's static shell holds the heading, one sentence and the door to the Ballot Box; everything below them came from the answer.
//
// THE RULES THIS FILE HOLDS (each is a falsifier in test/ballot-panel.test.mjs):
//   · an answer that cannot be read (no reply, a refusal, not JSON, no `topics` list) is UNREADABLE, which is a different sentence from
//     "no open ballots": a panel that said "none" about a box it could not open would be telling the reader nothing is being decided;
//   · only an OPEN ballot belongs here: the office's lifecycle is submissions -> staking -> closed, and `submissions` (taking designs)
//     and `staking` (open for backing) are open; `closed` is past and stays in the full view;
//   · a status this file does not know is never drawn as open and never counted as past: when nothing else is open, the panel says some of
//     what the office sent could not be sorted, rather than "none";
//   · a figure that is not a number is shown as unreadable, never as 0; a design the office lists at 0 is shown at 0;
//   · every word the office sends goes in as escaped text (esc, from votes-render.mjs); the office's links are never drawn here. The ONE
//     link is POS-1066 A's: a Hearth ballot design's "see it", its live preview on its author's own house, from the map the BUILD wrote
//     (hearth/ballot-links.mjs § seeItHref), never an address the office sent.
//
// NO FORM, NO SIGN-IN, NO WRITE. Staking lives at /votes/ (src/lib/ballot-stake.mjs) and at the connector door; this panel only reads.

import { officeBase } from "./auth.mjs";
import { esc } from "./votes-render.mjs";
import { seeItHref } from "./hearth/ballot-links.mjs";
import { captionOf } from "./hearth/ballot-caption.mjs";

/** The office's ballot lifecycle: submissions -> staking -> closed (postmark-office src/votes.mjs). */
export const STATUS_SUBMISSIONS = "submissions";
export const STATUS_STAKING = "staking";
export const STATUS_CLOSED = "closed";
/** The statuses that are OPEN, with the site's words for each (the office sends the status, not these words). */
export const OPEN_STATUSES = Object.freeze({ [STATUS_STAKING]: "open for backing", [STATUS_SUBMISSIONS]: "taking designs" });
/** Designs drawn per ballot before the rest are counted and left to the Ballot Box. */
export const MAX_DESIGNS = 6;

/** A topic slug in a reader's words (the same fallback /votes/ uses for a heading): dashes breathed out, nothing re-cased. */
const words = (slug) => String(slug ?? "").replace(/-/g, " ").trim() || String(slug ?? "");

/** A staked figure as the office gave it: a finite non-negative number, else null (unreadable, never zero). */
export function stakedOf(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;     // a digit string long enough to be Infinity is unreadable, never a bar
  }
  return null;
}

/**
 * What the office's GET /votes answer says, sorted for this panel.
 *   `{ state: "unreadable" }`                         the answer could not be read as a ballot list
 *   `{ state: "none", past, unsorted }`               readable, and no ballot is open (`unsorted`: entries that could not be sorted)
 *   `{ state: "open", open: [...], past, unsorted }`  at least one open ballot
 */
export function readBallots(data) {
  if (data == null || typeof data !== "object" || !Array.isArray(data.topics)) return { state: "unreadable" };
  const open = [];
  let past = 0, unsorted = 0;
  for (const t of data.topics) {
    if (t == null || typeof t !== "object" || typeof t.topic !== "string" || t.topic === "" || typeof t.status !== "string") { unsorted += 1; continue; }
    if (t.status === STATUS_CLOSED) { past += 1; continue; }
    if (!Object.hasOwn(OPEN_STATUSES, t.status)) { unsorted += 1; continue; }   // own keys only: "constructor" and "toString" are not statuses
    const list = Array.isArray(t.candidates) ? t.candidates : null;
    const designs = (list ?? []).filter((c) => c != null && typeof c === "object" && typeof c.candidate === "string" && c.candidate !== "")
      .map((c) => ({ name: c.candidate, credit: typeof c.credit === "string" && c.credit.trim() !== "" ? c.credit : null, staked: stakedOf(c.staked), households: Number.isInteger(c.backing_households) && c.backing_households >= 0 ? c.backing_households : null }));
    open.push({
      topic: t.topic,
      title: typeof t.title === "string" && t.title.trim() !== "" ? t.title : words(t.topic),
      status: t.status,
      window: typeof t.window === "string" && t.window.trim() !== "" ? t.window : null,     // the office's prose: shown, never parsed as a clock
      designs,
      designsUnreadable: list === null,          // a list that is missing or not a list is not the office saying there are no designs
      designsMalformed: list !== null && designs.length !== list.length,
    });
  }
  return open.length ? { state: "open", open, past, unsorted } : { state: "none", past, unsorted };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function designHtml(d, see, caption = null) {
  const n = d.staked == null ? '<span class="bp-n is-unreadable">not readable</span>' : `<span class="bp-n">${esc(plural(d.staked, "stamp", "stamps"))}</span>`;
  const h = d.households == null ? "" : `<span class="bp-houses">${esc(plural(d.households, "household", "households"))} backing</span>`;
  // POS-1066 A: a Hearth design's live preview, beside its name (inside the name's cell, so the row's columns are the panel's own)
  const link = see ? ` <a class="bp-see" href="${esc(see)}" data-hearth-preview="${esc(d.name)}">see it →</a>` : "";
  // CORE-126: a Hearth design reads "<title>, by <household>"; the id stays in `data-hearth-preview` (and is what an unknown design shows)
  return `<li class="bp-design"><span class="bp-name">${esc(caption || d.name)}${link}</span>${n}${h}</li>`;
}

function ballotHtml(b, previews, titles) {
  const shown = b.designs.slice(0, MAX_DESIGNS);
  const rest = b.designs.length - shown.length;
  let body;
  // a list that is missing, or that has rows but not one this page can read (`[{}]`), is unreadable: only a true `[]` is "no designs"
  if (b.designsUnreadable || (!b.designs.length && b.designsMalformed)) body = '<p class="bp-warn">This ballot\'s designs could not be read, so none are shown. That does not mean it has none.</p>';
  else if (!b.designs.length) body = `<p class="bp-quiet">${b.status === STATUS_SUBMISSIONS ? "No design has been put forward yet." : "The office lists no designs on this ballot yet."}</p>`;
  else body = `<ul class="bp-designs">${shown.map((d) => designHtml(d, seeItHref(previews, b.topic, d.name), captionOf(titles, b.topic, d.name, d.credit))).join("")}</ul>` +
    (rest > 0 ? `<p class="bp-quiet">+ ${esc(plural(rest, "more design", "more designs"))} in the Ballot Box</p>` : "") +
    (b.designsMalformed ? '<p class="bp-warn">Some of this ballot\'s designs could not be read.</p>' : "");
  return `<li class="bp-ballot" data-ballot="${esc(b.topic)}" data-status="${esc(b.status)}">` +
    `<div class="bp-head"><h3 class="bp-title">${esc(b.title)}</h3><span class="bp-chip bp-${esc(b.status)}">${esc(OPEN_STATUSES[b.status])}</span></div>` +
    (b.window ? `<p class="bp-window">${esc(b.window)}</p>` : "") +
    body + "</li>";
}

/**
 * The panel's markup for an answer (or null for "could not be reached"): the open ballots, or the one sentence that says why there are none.
 * `previews` is the build's Hearth map (hearth/ballot-links.mjs § readPreviews): on the Hearth ballot, a design it holds is linked to its preview.
 */
export function panelHtml(data, { previews = null, titles = null } = {}) {
  const r = readBallots(data);
  if (r.state === "unreadable")
    return '<p class="bp-note is-warn" data-ballot-state="unreadable"><b>The ballot box could not be read.</b> The office did not give an answer this page could use, so nothing is shown here. That does not mean no ballot is open: try again, or open the Ballot Box.</p>';
  if (r.state === "none") {
    const unsorted = r.unsorted > 0;
    const past = r.past > 0 ? ` ${plural(r.past, "past ballot is", "past ballots are")} in the Ballot Box.` : " Past ballots are in the Ballot Box.";
    return unsorted
      ? '<p class="bp-note is-warn" data-ballot-state="none"><b>No ballot is shown as open here.</b> Some of what the office sent could not be sorted, so this is not a promise that none is open: the Ballot Box has the whole answer.</p>'
      : `<p class="bp-note" data-ballot-state="none"><b>No open ballots right now.</b> The box waits for the next vote.${esc(past)}</p>`;
  }
  const warn = r.unsorted > 0 ? '<p class="bp-warn">Some of what the office sent could not be sorted, so another ballot may be open: the Ballot Box has the whole answer.</p>' : "";
  return `<ul class="bp-list" data-ballot-state="open">${r.open.map((b) => ballotHtml(b, previews, titles)).join("")}</ul>${warn}`;
}

/**
 * Fill `host` with the open ballots and keep them current. Returns `{ ready, refresh }`: `ready` settles once the first read has drawn;
 * `refresh({ force })` reads again (not within `minAge` ms of the last good draw unless forced, and always at once after an unreadable one).
 * Only the LATEST read draws: an answer that arrives after a newer one is dropped, so a slow reply cannot put an old tally back.
 * A refresh that cannot read the box says so; it never leaves the last good tally standing as if it were current.
 */
export function mountBallotPanel(host, { fetchImpl = globalThis.fetch, base, storage, minAge = 20_000, now = () => Date.now(), win = globalThis.window, hash = "#ballot-house", previews = null, titles = null } = {}) {
  if (!host) return { ready: Promise.resolve(), refresh: async () => {} };
  let seq = 0, lastDraw = 0, lastState = null;

  async function read() {
    try {
      const res = await fetchImpl(`${base ?? officeBase(storage)}/votes`, { headers: { accept: "application/json" } });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  async function load() {
    const mine = ++seq;
    const data = await read();
    if (mine !== seq) return;                  // a newer read is in flight or has drawn
    host.innerHTML = panelHtml(data, { previews, titles });
    host.setAttribute?.("aria-busy", "false");
    lastState = readBallots(data).state;
    lastDraw = now();
  }

  const ready = load();
  async function refresh({ force = false } = {}) {
    await ready;
    if (!force && lastState !== "unreadable" && now() - lastDraw < minAge) return;
    await load();
  }
  // The panel is switched by the URL's fragment (CSS only, in the page), so it is re-read when the reader opens it: the fragment becoming
  // `hash`. This listener scrolls nothing and touches no other panel; a page left open does not show an old tally.
  win?.addEventListener?.("hashchange", () => { if (win.location?.hash === hash) refresh(); });
  return { ready, refresh };
}
