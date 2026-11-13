// bundle.mjs — the office's public Hearth bundle, and what each v2 slot draws from it (POS-1024, POS-1028).
//
// THE READ (POS-1027, R6 in the 11-13 proposal): `household { read: "hearth", args: { household } }`, public, one answer holding everything a
// Hearth draws for a named house. The site reads it once per page through the household door's web twin, signed out
// (`GET /household?read=hearth&household=<key>`: the twin hands its query to the apex as the read's args), and hands the SAME answer to the
// site's slots and to a house's own script (script.mjs). Public data only: it is read with no bearer, so it holds exactly what a signed-out
// visitor may see (POS-1024/b: "Yes, minus private acts").
//
// ⚑ THE SHAPE IS A DRAFT. POS-1027 (Rivet's office half) had posted no read shape when this was built (2026-11-13), so this codes against the
// proposal's draft: "A bundle, built the way the doorstep is: each part names the read it is." THIS FILE IS THE ONE PLACE THAT KNOWS THE SHAPE;
// when the office's answer lands, it changes here and nowhere else. The draft:
//
//   { household: "<key>", as_of: "<iso>",
//     parts: {
//       closer: { read: "closer",  rows: [{ handle, with, out, in, stamps?, latest_at?, milestones?: [{ name, at? }] }] },
//       pairs:  { read: "pair",    rows: [{ a, b, a_to_b, b_to_a, first_at?, latest_at?, quote_a?, quote_b? }] },    // quotes by rule (POS-1024/c)
//       went:   { read: "stamps", view: "went", rows: [{ at, handle, kind, stamps, for?, title?, href? }] },        // kind: mark|idea|ballot|pot|gift|burn|send
//       happened: { read: "happened", rows: [...] },                                                               // public rows, `hand` on each
//       feed:   { read: "feed",    rows: [{ kind, at, title, href?, by?, backed?, near? }] },
//       day:    { read: "day",     residents: { "<handle>": { date, lines: ["wrote 3 letters, to …", …] } } },
//     } }
//
// A part that is absent, or a bundle that did not answer, folds to null: its slot draws nothing (hidden), never "nothing happened". A part
// that answered with no rows is an honest none and the slot says so.

const asArray = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (v) => { const t = typeof v === "number" ? v : Date.parse(str(v)); return Number.isFinite(t) ? t : null; };

/** The read's address for a named house: the household door's web twin, signed out. */
export function bundleUrl(api, key) {
  return `${api}/household?read=hearth&household=${encodeURIComponent(key)}`;
}

/** An answer that is a bundle, or null (an error, an array, nothing). The fetch is reads.mjs § readHearthBundle, the page's one reader. */
export function bundleFrom(answer) {
  return answer && typeof answer === "object" && !Array.isArray(answer) && !answer.error && !answer.defect ? answer : null;
}

/** One part of the bundle by its name, or null. The draft nests parts under `parts`; a flat answer is read the same way. */
export function partOf(bundle, name) {
  if (!bundle || typeof bundle !== "object") return null;
  const p = bundle.parts && typeof bundle.parts === "object" ? bundle.parts[name] : bundle[name];
  return p && typeof p === "object" ? p : null;
}

// eight ties, and the quotes on the first three only: Darko, 2026-11-11, on small text ("there's a certain point at which … the words
// themselves don't mean anything to you anymore")
const TIES_SHOWN = 8;
const QUOTED = 3;
/**
 * The ties slot: one row per pair a resident of the house writes with, most letters first. Quotes, when the pair read carries them, ride the
 * row (by rule, POS-1024/c: the first line of the newest letter each way). null when the closer part did not come.
 */
export function tiesOf(bundle, handles = []) {
  const closer = partOf(bundle, "closer");
  if (!closer) return null;
  const house = new Set(handles);
  const pairs = new Map();
  for (const p of asArray(partOf(bundle, "pairs")?.rows)) pairs.set(`${str(p.a)}|${str(p.b)}`, p);
  const rows = [];
  for (const r of asArray(closer.rows)) {
    const handle = str(r.handle), other = str(r.with);
    if (!handle || !other || !house.has(handle)) continue;
    if (house.has(other) && other < handle) continue;          // two residents of the house: one row for the pair, not one from each side
    const out = num(r.out) ?? 0, back = num(r.in) ?? 0;
    const pair = pairs.get(`${handle}|${other}`) ?? pairs.get(`${other}|${handle}`) ?? null;
    const flip = pair && str(pair.a) !== handle;
    rows.push({
      handle, with: other, out, in: back, letters: out + back,
      stamps: num(r.stamps),
      latest: time(r.latest_at ?? pair?.latest_at),
      milestones: asArray(r.milestones).map((m) => str(m?.name ?? m)).filter(Boolean).slice(0, 3),
      quoteOut: str(flip ? pair?.quote_b : pair?.quote_a).slice(0, 200) || null,
      quoteIn: str(flip ? pair?.quote_a : pair?.quote_b).slice(0, 200) || null,
    });
  }
  rows.sort((a, b) => b.letters - a.letters || (b.latest ?? 0) - (a.latest ?? 0) || a.with.localeCompare(b.with));
  const shown = rows.slice(0, TIES_SHOWN);
  shown.forEach((r, i) => { if (i >= QUOTED) { r.quoteOut = null; r.quoteIn = null; } });
  return { rows: shown, total: rows.length };
}

export const WENT_KINDS = Object.freeze(["mark", "idea", "ballot", "pot", "gift", "send", "burn"]);
const WENT_WORDS = Object.freeze({ mark: "behind marks", idea: "behind ideas", ballot: "on ballots", pot: "into pots", gift: "given", send: "sent", burn: "burned" });
/** The stamps-went slot: the house's flows grouped by kind, each with its total and its newest rows. null when the part did not come. */
export function wentOf(bundle, handles = []) {
  const went = partOf(bundle, "went");
  if (!went) return null;
  const house = new Set(handles);
  const groups = new Map();
  for (const r of asArray(went.rows)) {
    const n = num(r.stamps);
    if (n == null || n <= 0) continue;
    if (r.handle != null && house.size && !house.has(str(r.handle))) continue;
    const kind = WENT_KINDS.includes(str(r.kind)) ? str(r.kind) : "other";
    if (!groups.has(kind)) groups.set(kind, { kind, words: WENT_WORDS[kind] ?? "elsewhere", total: 0, rows: [] });
    const g = groups.get(kind);
    g.total += n;
    g.rows.push({ at: time(r.at), handle: str(r.handle) || null, stamps: n, title: str(r.title ?? r.for).slice(0, 120), href: safeHref(r.href) });
  }
  const out = [...groups.values()];
  for (const g of out) { g.rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)); g.rows = g.rows.slice(0, 4); }
  out.sort((a, b) => b.total - a.total || a.kind.localeCompare(b.kind));
  return { groups: out, total: out.reduce((s, g) => s + g.total, 0) };
}

export const FEED_SORTS = Object.freeze(["newest", "backed", "near"]);
const FEED_SHOWN = 12;
/** The town slot: the feed's rows, with the values each sort reads. null when the part did not come. */
export function feedOf(bundle) {
  const feed = partOf(bundle, "feed");
  if (!feed) return null;
  const rows = asArray(feed.rows).map((r) => ({
    kind: str(r.kind).slice(0, 20) || "post",
    at: time(r.at),
    title: str(r.title).slice(0, 140),
    href: safeHref(r.href),
    by: str(r.by).slice(0, 60) || null,
    backed: num(r.backed) ?? 0,
    near: num(r.near),
  })).filter((r) => r.title);
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return { rows: rows.slice(0, FEED_SHOWN), sorts: FEED_SORTS.filter((s) => s !== "near" || rows.some((r) => r.near != null)) };
}

/** The day slot: each resident's sentences, in the house's order. null when the part did not come. */
export function dayOf(bundle, handles = []) {
  const day = partOf(bundle, "day");
  if (!day) return null;
  const by = day.residents && typeof day.residents === "object" ? day.residents : {};
  return {
    rows: handles.map((h) => {
      const d = by[h];
      const lines = asArray(d?.lines).map((l) => str(l).slice(0, 240)).filter(Boolean).slice(0, 6);
      return { handle: h, date: str(d?.date).slice(0, 10) || null, lines, answered: !!d };
    }),
  };
}

/** A link the office handed back, kept only when it is a site path: the bundle is data, and a row never carries an outside address onto the page. */
export function safeHref(v) {
  const s = str(v);
  return /^\/(?!\/)[A-Za-z0-9_./%?#=&+~-]{0,300}$/.test(s) ? s : null;
}
