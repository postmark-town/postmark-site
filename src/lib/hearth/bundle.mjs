// bundle.mjs — the office's public Hearth bundle, and what each v2 slot draws from it (POS-1024, POS-1028).
//
// THE READ (POS-1027, settled by Rivet on 2026-11-13): `household { read: "hearth", args: { household: "<slug>" } }`, through the household
// door and its web twin. Public for every caller, the owner included. The site reads it once per page, signed out
// (`GET /household?read=hearth&household=<key>`: the twin hands its query to the apex as the read's args), and its slots and a house's own
// script (script.mjs) draw from the same answer.
//
// THIS FILE IS THE ONE PLACE THAT KNOWS THE OFFICE'S ROW SHAPES. Everything else (the slots' painter, paint-v2.mjs; a house's script, through
// hearth.parts) takes the FOLDS below, whose shapes are the site's own and are documented in the town README's rule 7.
//
// THE ENVELOPE (POS-1027, Rivet's words): "The response is `{ read: "hearth", household: "<canonical slug>", parts }`." "Each part is
// `{ via: { door, read, args }, data }`: `via` is the exact standalone public call, and `data` is that call's answer, with its own paging,
// cursors, unavailable markers and source dates intact." The keys the site reads:
//
//   parts.closer  { via, data }   household closer: data.rows [{ with, of, letters, milestones: [{ by, rung, day }], stamps_between, last_at }]
//                                 (the house's correspondents outside it; a housemate is never one)
//   parts.pairs   [{ via, data }] town pair, one per (resident a, correspondent b) on the ties page: data { a, b, first,
//                                 letters: { a_to_b, b_to_a }, latest: { a_to_b, b_to_a } (each null or { id, date, delivered_at, href, line }),
//                                 milestones }. `line` is the literal first body line: the quote, by rule (POS-1024/c).
//   parts.went    { via, data }   household stamps, view "went": data.rows [{ at, date, from, to, stamps, for?, via?, kind? }]
//   parts.happened { via, data }  household happened: data.rows [{ at, hand, for, verb, object, place, by? }]
//   parts.feed    { via, data }   town feed: data.rows [{ id, kind, at, href, title, by?, backing?, distance? }]
//   parts.days    [{ via, data }] household day, one per ashore member, in the house's order: data { handle, date, sentences, counts }
//   (parts.house and parts.posts are carried too; the site draws those slots from its own reads, as before.)
//
// "If a missing house/ties source prevents determining a collection's scope, return its named unavailability rather than inventing an empty
// `days` or `pairs` collection": a collection that is not an array, or a part with no `data`, folds to null here, so its slot draws nothing.
// A part that answered with no rows is an honest none, and the slot says so.

const asArray = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (v) => { const t = typeof v === "number" ? v : Date.parse(str(v)); return Number.isFinite(t) ? t : null; };
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** The read's address for a named house: the household door's web twin, signed out. */
export function bundleUrl(api, key) {
  return `${api}/household?read=hearth&household=${encodeURIComponent(key)}`;
}

/**
 * The answer, if it is the Hearth bundle's envelope: `{ read: "hearth", household, parts }`. Anything else (an error, a refusal, another read,
 * an answer with no `parts`) is null: no bundle, and every bundle part stays hidden.
 */
export function bundleFrom(answer) {
  if (!isObj(answer) || answer.error || answer.defect) return null;
  if (answer.read !== "hearth" || typeof answer.household !== "string" || !isObj(answer.parts)) return null;
  return answer;
}

/**
 * An answer the office could not read: its own marker, `unavailable: "<why>"`, carried beside whatever it holds (often `rows: []`; office
 * house-bundle.mjs: `{ rows: [], unavailable: "… unknown, not none" }`). Such an answer is MISSING, never empty: Rivet, POS-1027, "unavailable
 * history must not masquerade as a quiet day", and "Unknown time/distance is not fabricated" (review of #420 at 40993488).
 */
export const unavailable = (data) => isObj(data) && data.unavailable != null && data.unavailable !== false && data.unavailable !== "";

/** One part's `data` (the standalone read's own answer), or null when the part is absent, has no data, the office marked it unavailable, or the bundle did not come. */
export function dataOf(bundle, key) {
  const p = isObj(bundle?.parts) ? bundle.parts[key] : null;
  return isObj(p) && isObj(p.data) && !unavailable(p.data) ? p.data : null;
}

/**
 * A collection part's data, one per member: an array of `data`, or null when the collection is a named unavailability (not an array). A member
 * whose own data is marked unavailable is left out, so it reads as not read (a resident's day: "not read."), never as a quiet one.
 */
export function collectionOf(bundle, key) {
  const c = isObj(bundle?.parts) ? bundle.parts[key] : null;
  if (!Array.isArray(c)) return null;
  return c.filter((p) => isObj(p) && isObj(p.data) && !unavailable(p.data)).map((p) => p.data);
}

const quote = (latest) => (isObj(latest) ? str(latest.line).slice(0, 200) || null : null);

/**
 * The pairs: one row per (resident of the house, correspondent), from the `pairs` collection. Letters each way, and the quote each way by rule.
 * null when the collection did not come. This is what a house's script draws ties from (hearth.parts.pairs).
 */
export function pairsOf(bundle, handles = []) {
  const all = collectionOf(bundle, "pairs");
  if (!all) return null;
  const house = new Set(handles);
  const rows = [];
  for (const d of all) {
    const handle = str(d.a), other = str(d.b);
    if (!handle || !other || (house.size && !house.has(handle)) || house.has(other)) continue;
    const out = num(d.letters?.a_to_b) ?? 0, back = num(d.letters?.b_to_a) ?? 0;
    const latestAt = [d.latest?.a_to_b, d.latest?.b_to_a].map((l) => time(l?.delivered_at ?? l?.date)).filter((t) => t != null).sort((a, b) => b - a)[0] ?? null;
    rows.push({ handle, with: other, out, in: back, letters: out + back, latest: latestAt, quoteOut: quote(d.latest?.a_to_b), quoteIn: quote(d.latest?.b_to_a) });
  }
  rows.sort((a, b) => b.letters - a.letters || (b.latest ?? 0) - (a.latest ?? 0) || a.handle.localeCompare(b.handle) || a.with.localeCompare(b.with));
  return rows;
}

// eight ties, and the quotes on the first three only: Darko, 2026-11-11, on small text ("there's a certain point at which … the words
// themselves don't mean anything to you anymore")
const TIES_SHOWN = 8;
const QUOTED = 3;
/**
 * The ties slot: one row per correspondent of the house (the `closer` page), most letters first, each joined to the resident who writes them
 * most (its strongest pair) for the letters each way and the quotes. A correspondent with no pair on the page is the house's, with its total.
 * null when the closer part did not come.
 */
export function tiesOf(bundle, handles = []) {
  const closer = dataOf(bundle, "closer");
  if (!closer) return null;
  const house = new Set(handles);
  const best = new Map();
  for (const p of pairsOf(bundle, handles) ?? []) if (!best.has(p.with)) best.set(p.with, p);   // pairsOf is sorted, so the first is the strongest
  const rows = [];
  const seen = new Set();
  for (const r of asArray(closer.rows)) {
    const other = str(r.with);
    // a housemate is never a correspondent (office household-read-v2 § closerRows); and a correspondent is one row, however the page lists it
    if (!other || house.has(other) || seen.has(other)) continue;
    seen.add(other);
    const p = best.get(other) ?? null;
    rows.push({
      handle: p?.handle ?? null, with: other, of: str(r.of) || null,
      letters: num(r.letters) ?? p?.letters ?? 0, out: p?.out ?? null, in: p?.in ?? null,
      stamps: num(r.stamps_between),
      latest: time(r.last_at) ?? p?.latest ?? null,
      milestones: [...new Set(asArray(r.milestones).map((m) => str(m?.rung ?? m?.name ?? m)).filter(Boolean))].slice(0, 3),
      quoteOut: p?.quoteOut ?? null, quoteIn: p?.quoteIn ?? null,
    });
  }
  rows.sort((a, b) => b.letters - a.letters || (b.latest ?? 0) - (a.latest ?? 0) || a.with.localeCompare(b.with));
  const shown = rows.slice(0, TIES_SHOWN);
  shown.forEach((r, i) => { if (i >= QUOTED) { r.quoteOut = null; r.quoteIn = null; } });
  return { rows: shown, total: rows.length };
}

export const WENT_KINDS = Object.freeze(["mark", "idea", "ballot", "pot", "gift", "send", "burn"]);
const WENT_WORDS = Object.freeze({ mark: "behind marks", idea: "behind ideas", ballot: "on ballots", pot: "into pots", gift: "given", send: "sent", burn: "burned", other: "elsewhere" });
/** The stamps-went slot: the house's flows grouped by kind, each with its total and its newest rows. null when the part did not come. */
export function wentOf(bundle, handles = []) {
  const went = dataOf(bundle, "went");
  if (!went) return null;
  const house = new Set(handles);
  const groups = new Map();
  for (const r of asArray(went.rows)) {
    const n = num(r.stamps);
    if (n == null || n <= 0) continue;
    const from = str(r.from);
    if (from && house.size && !house.has(from)) continue;
    const kind = WENT_KINDS.includes(str(r.kind)) ? str(r.kind) : "other";
    if (!groups.has(kind)) groups.set(kind, { kind, words: WENT_WORDS[kind], total: 0, rows: [] });
    const g = groups.get(kind);
    g.total += n;
    g.rows.push({ at: time(r.at ?? r.date), handle: from || null, stamps: n, title: str(r.for ?? r.to).replace(/-/g, " ").slice(0, 120), href: safeHref(r.href) });
  }
  const out = [...groups.values()];
  for (const g of out) { g.rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)); g.rows = g.rows.slice(0, 4); }
  out.sort((a, b) => b.total - a.total || a.kind.localeCompare(b.kind));
  return { groups: out, total: out.reduce((s, g) => s + g.total, 0) };
}

export const FEED_SORTS = Object.freeze(["newest", "backed", "near"]);
export const FEED_SHOWN = 12;
/**
 * The town slot: every answered feed row, with the values each sort reads. null when the part did not come. Backing and distance are read under
 * `backing`/`distance` (POS-1027's words) or `backed`/`near`; unknown is never made up.
 */
export function feedOf(bundle) {
  const feed = dataOf(bundle, "feed");
  if (!feed) return null;
  const rows = asArray(feed.rows).map((r) => ({
    id: str(r.id) || null,
    kind: str(r.kind).slice(0, 20) || "post",
    at: time(r.at),
    title: str(r.title).slice(0, 140),
    href: safeHref(r.href),
    by: str(r.by).slice(0, 60) || null,
    backed: num(r.backing) ?? num(r.backed) ?? 0,
    near: num(r.distance) ?? num(r.near),
  })).filter((r) => r.title);
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  // EVERY answered row, uncut: the reader's sort runs over the whole list and only then is it cut (feedShown), so "most backed" is the most backed
  // of the feed, not of its newest twelve (review of #420)
  return { rows, sorts: FEED_SORTS.filter((s) => s !== "near" || rows.some((r) => r.near != null)) };
}

/** The rows the town slot shows for a sort: the whole feed sorted the reader's way, then cut to the first FEED_SHOWN. */
export function feedShown(rows, sort = "newest") {
  const out = [...asArray(rows)];
  if (sort === "backed") out.sort((a, b) => b.backed - a.backed || (b.at ?? 0) - (a.at ?? 0));
  else if (sort === "near") out.sort((a, b) => (a.near ?? Infinity) - (b.near ?? Infinity) || (b.at ?? 0) - (a.at ?? 0));
  else out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return out.slice(0, FEED_SHOWN);
}

/** The day slot: each resident's sentences, in the house's order. A resident the collection does not carry is "not read". null when it did not come. */
export function dayOf(bundle, handles = []) {
  const days = collectionOf(bundle, "days");
  if (!days) return null;
  const by = new Map(days.map((d) => [str(d.handle), d]));
  return {
    rows: handles.map((h) => {
      const d = by.get(h);
      const lines = asArray(d?.sentences).map((l) => str(l).slice(0, 240)).filter(Boolean).slice(0, 6);
      return { handle: h, date: str(d?.date).slice(0, 10) || null, lines, answered: !!d };
    }),
  };
}

/** The human's own record: the house's public `happened` rows whose hand is the human's, newest first. null when the part did not come. */
export function humanLogOf(bundle, shown = 6) {
  const happened = dataOf(bundle, "happened");
  if (!happened) return null;
  return asArray(happened.rows)
    .filter((r) => r?.hand === "human")
    .map((r) => ({ at: time(r.at), words: [str(r.verb), str(r.object)].filter(Boolean).join(" ").replace(/-/g, " ").slice(0, 160), for: str(r.for) || null, by: str(r.by) || null }))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, shown);
}

/** Every fold at once: what a house's script reads as `hearth.parts` (script.mjs). Each is null while its part has not come. */
export function partsFor(bundle, handles = []) {
  return {
    pairs: pairsOf(bundle, handles),
    ties: tiesOf(bundle, handles),
    went: wentOf(bundle, handles),
    feed: feedOf(bundle),
    days: dayOf(bundle, handles),
    humanLog: humanLogOf(bundle),
  };
}

/** A link the office handed back, kept only when it is a site path: the bundle is data, and a row never carries an outside address onto the page. */
export function safeHref(v) {
  const s = str(v);
  return /^\/(?!\/)[A-Za-z0-9_./%?#=&+~-]{0,300}$/.test(s) ? s : null;
}
