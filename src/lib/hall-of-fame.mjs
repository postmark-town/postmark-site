// hall-of-fame.mjs — Ferry's Hall of Fame: this month's top stamp earners, each
// with the sources their stamps came from. POS-967 (Darko, 2026-11-08 17:07:
// "this month's top stamp earners with a clickable breakdown of where the
// stamps came from, displaying holo separately with that iridescent color";
// 17:08: "the hall of fame should replace/revamp the 'Standings' section in the
// quest guild which is stale").
//
// THREE JOBS, ONE FILE, AND NONE OF THEM IS A NEW RULE ABOUT MONEY:
//
//   hallFromLedger   the FOLD, run by tools/extract-seam.mjs over the town
//                    checkout. It reads the public stamp-ledger the way the
//                    town's own tools/stamp-mint.mjs does (parseStampLedger,
//                    classifyEntry) and adds nothing to what a row means.
//   readHall         the READER: a raw emission in, a lawful one out, or null.
//   hallView         the VIEW: the emission, the town's clock and a letter
//                    address book in, the rows a page draws out.
//
// WHAT "EARNED" MEANS HERE IS THE TOWN'S OWN WORD FOR IT. foldPrimaryMint
// (stamp-mint.mjs): every arrow-bearing `MINT → <handle>` row, "earned,
// arrow-bearing (correspondence, votes, gifts, issuance, friendship)". A
// transfer between two residents moves stamps, it does not earn them, and a
// balance is what a resident HOLDS, so neither is a source here.
//
// HOLO IS APART, ALWAYS. A `holo · <handle> · <n> · pot:… ·` row is arrow-free
// by design (a mint is not a movement) and is the pot's mint to its givers. It
// is carried in its own field and is never added into `earned`, so it cannot
// be counted twice and no combined "score" exists to read.
//
// A MINT THE TOWN BURNED AND RE-CREDITED IS NOT EARNED. A bug-ladder stage paid
// to the wrong resident is burned exactly (a `correction-burn` row naming the
// wrong line's signature) and paid again to the right one. The fold leaves the
// burned line out, so the wrong recipient does not keep a credit the record
// took back, and the right one is counted once, by the recredit.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { letterHref } from "./mail.mjs";

// HOW MUCH AN EMISSION CARRIES, each a simple bound (RUNNING-A-LANE § 1.5), and
// each measured: the first cut (every earner, five records a source, two months)
// was 1.98 MB of JSON for one month's page.
//
// MONTHS: the page draws the town's CURRENT month; the one before it rides
// along so the first day of a month, before the refresh, still has a record to
// say "as of" about.
export const HALL_MONTHS = 2;
// The board is the TOP earners. The month's whole earner count rides beside it
// (`earners`), so "top 25 of 227" is said, never implied. A tie at the edge is
// cut by handle, the same order that breaks every other tie.
export const HALL_TOP = 25;
// The holo board lists the month's holo recipients apart from the plain rank.
export const HALL_HOLO_TOP = 10;
// The newest records listed under each source before "+N more". A source's own
// total and count are always whole; only the list of records is capped.
export const HALL_RECORDS_PER_SOURCE = 3;

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ARROW_MINT_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · /;

export const prevMonth = (month) => {
  const [y, m] = String(month).split("-").map(Number);
  return m <= 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// The town's month from the town's day (civic.mjs townDay: the calendar day in
// TOWN_TZ, never the runner's or UTC's). A string slice on purpose: the day was
// already reckoned in the town's zone, and a second Date here would reckon it
// again in the machine's.
export const monthOfDay = (day) => (DAY_RE.test(String(day ?? "")) ? String(day).slice(0, 7) : null);

// ── what a source is called, from the row's own kind ─────────────────────────
// Every arrow-bearing MINT row lands in exactly one of these; a row whose kind
// the classifier does not know lands in `other` rather than vanishing, because
// a breakdown that drops a credit stops adding up to the total.
const SOURCE_LABELS = Object.freeze({
  "letters-sent": "Letters sent",
  "letters-received": "Letters received",
  votes: "Votes cast",
  friendship: "Friendships",
  gift: "Gifts",
  "first-idea": "First ideas",
  welcome: "Welcomes",
  quest: "Quests",
  invite: "Invitations",
  "bug-ladder": "Bug-ladder rungs",
  award: "Post awards",
  issuance: "Town issuance",
  keeping: "Keeping mint",
  other: "Other mints",
});

// kind → { group, ref, label } for one classified row. `ref` names the public
// record the row points at, when it points at one: a letter, a post, a pot, a
// resident. The page turns a ref into an address; the emission only names it.
function sourceOf(c) {
  switch (c.kind) {
    case "mint":
      return { group: c.side === "received" ? "letters-received" : "letters-sent", ref: { type: "letter", id: c.cause }, label: c.cause };
    case "vote-mint":
      return { group: "votes", ref: null, label: c.topic };
    case "friendship":
      return { group: "friendship", ref: { type: "resident", id: c.friendWith }, label: `with ${c.friendWith}` };
    case "gift":
      return { group: "gift", ref: null, label: c.slug };
    case "first-idea":
      return { group: "first-idea", ref: { type: "post", id: c.mark }, label: c.mark };
    case "welcome":
      return { group: "welcome", ref: null, label: "welcome" };
    case "quest-pay":
      return { group: "quest", ref: null, label: c.quest };
    case "invite":
      // `invited` is a household key, not a handle, so there is no page to link
      return { group: "invite", ref: null, label: c.side === "inviter" ? "invited a household" : "was invited" };
    case "post-stage":
      return { group: "bug-ladder", ref: { type: "post", id: c.post }, label: `${c.stage} · ${c.post}` };
    case "post-recredit":
      return { group: "bug-ladder", ref: { type: "post", id: c.post }, label: `${c.stage} (re-credit) · ${c.post}` };
    case "post-award":
      return { group: "award", ref: { type: "post", id: c.post }, label: `${c.label} · ${c.post}` };
    case "town-issuance":
      return { group: "issuance", ref: null, label: c.purpose };
    case "keeping-mint":
      return { group: "keeping", ref: { type: "pot", id: c.pot }, label: c.pot };
    default:
      return { group: "other", ref: null, label: c.kind };
  }
}

// ── the fold ─────────────────────────────────────────────────────────────────
// Pure, so the falsifiers run it on invented ledgers.
//
//   mint     the town's tools/stamp-mint.mjs module (parseStampLedger is not
//            needed here; `entries` are already its output)
//   entries  parseStampLedger(...) over WHITE_PAGES/stamp-ledger.md
//   asOf     the town HEAD commit's date, YYYY-MM-DD. A row dated after it has
//            not happened as far as this answer is concerned (seamFromTown's
//            own rule).
export function hallFromLedger({ mint, entries, asOf }) {
  const asOfDay = String(asOf ?? "").slice(0, 10);
  if (!DAY_RE.test(asOfDay)) return null;
  const newest = asOfDay.slice(0, 7);
  const months = [newest];
  for (let i = 1; i < HALL_MONTHS; i++) months.push(prevMonth(months[i - 1]));
  const wanted = new Set(months);

  // lines the town took back: a correction-burn names the burned line's whole
  // signature, in any month, so this is read over the whole ledger first
  const burned = new Set();
  for (const e of entries) {
    const c = mint.classifyEntry(e.canonical);
    if (c.kind === "correction-burn") burned.add(c.sig);
  }

  // month → handle → { earned, holo, sources: Map(group → {n, count, all}), pots: Map(pot → {n, count}) }
  const byMonth = new Map(months.map((m) => [m, new Map()]));
  const person = (month, handle) => {
    const people = byMonth.get(month);
    if (!people.has(handle)) people.set(handle, { handle, earned: 0, sources: new Map(), holo: 0, pots: new Map() });
    return people.get(handle);
  };

  for (const e of entries) {
    const c = mint.classifyEntry(e.canonical);
    // the row's own day: the classifier's, or for a MINT row it does not name
    // (kind "unknown" carries no date) the date the arrow shape itself carries,
    // so a credit in an unclassified grammar is still counted, as "Other"
    const arrow = ARROW_MINT_RE.exec(e.canonical);
    const day = c.date ? String(c.date).slice(0, 10) : arrow ? arrow[1] : null;
    if (!day || day > asOfDay || !wanted.has(day.slice(0, 7))) continue;
    const month = day.slice(0, 7);

    if (c.kind === "holo") {
      if (c.n > 0) {
        const p = person(month, c.handle);
        p.holo += c.n;
        const pot = p.pots.get(c.pot) ?? { n: 0, count: 0 };
        p.pots.set(c.pot, { n: pot.n + c.n, count: pot.count + 1 });
      }
      continue;
    }

    // the earned credit: the same shape foldPrimaryMint keys on, plus the one
    // arrow-free earned row the town names (a keeping mint)
    let handle; let n;
    if (arrow) { handle = arrow[2]; n = Number(arrow[3]); }
    else if (c.kind === "keeping-mint") { handle = c.handle; n = c.n; }
    else continue;
    if (e.sig && burned.has(e.sig)) continue;

    const src = sourceOf(c);
    // an unclassified MINT row is labelled by its own `for:` tag, not "unknown"
    if (src.group === "other") src.label = /· for: (\S+)/.exec(e.canonical)?.[1] ?? "unclassified";
    const p = person(month, handle);
    p.earned += n;
    if (!p.sources.has(src.group)) p.sources.set(src.group, { group: src.group, label: SOURCE_LABELS[src.group], n: 0, count: 0, all: [] });
    const g = p.sources.get(src.group);
    g.n += n;
    g.count += 1;
    g.all.push({ date: day, n, ref: src.ref, label: src.label });
  }

  const holoOf = (p) => ({
    holo: p.holo,
    // holo by the pot that minted it: whole, so it sums to `holo` exactly
    holoPots: [...p.pots].map(([pot, v]) => ({ pot, n: v.n, count: v.count })).sort((a, b) => b.n - a.n || a.pot.localeCompare(b.pot)),
  });

  const out = { as_of: asOfDay, months: {} };
  for (const month of months) {
    const all = [...byMonth.get(month).values()];
    // PLAIN earners, highest first; ties by handle so two runs over one ledger
    // agree. A handle with holo and no plain earnings is not on this rank: it
    // is on the holo board below, which is where holo is read.
    const ranked = all.filter((p) => p.earned > 0).sort((a, b) => b.earned - a.earned || a.handle.localeCompare(b.handle));
    const people = ranked.slice(0, HALL_TOP).map((p) => ({
      handle: p.handle,
      earned: p.earned,
      sources: [...p.sources.values()]
        .map((g) => ({
          group: g.group,
          label: g.label,
          n: g.n,
          count: g.count,
          // newest first; ledger order breaks a same-day tie, newest line first
          records: g.all.map((r, i) => ({ ...r, i })).sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i)
            .slice(0, HALL_RECORDS_PER_SOURCE).map(({ i, ...r }) => r),
        }))
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
      ...holoOf(p),
    }));
    const holoBoard = all.filter((p) => p.holo > 0).sort((a, b) => b.holo - a.holo || a.handle.localeCompare(b.handle))
      .slice(0, HALL_HOLO_TOP).map((p) => ({ handle: p.handle, ...holoOf(p) }));
    out.months[month] = { earners: ranked.length, holoRecipients: all.filter((p) => p.holo > 0).length, people, holoBoard };
  }
  return out;
}

// ── the reader ───────────────────────────────────────────────────────────────
// A whole, lawful emission or null. "Lawful" is the acceptance's own sentence:
// each person's breakdown adds up to their total. A month whose numbers do not
// is dropped, not repaired, because a repaired number is a made-up one.
const isInt = (v) => Number.isInteger(v) && v >= 0;

// holo by pot, whole: the pots' amounts add up to the person's holo
function lawfulHolo(p) {
  if (!isInt(p.holo) || !Array.isArray(p.holoPots)) return false;
  let sum = 0;
  for (const h of p.holoPots) {
    if (!h || typeof h.pot !== "string" || !isInt(h.n) || !isInt(h.count)) return false;
    sum += h.n;
  }
  return sum === p.holo;
}

function lawfulPerson(p) {
  if (!p || typeof p.handle !== "string" || !p.handle) return false;
  if (!isInt(p.earned) || p.earned < 1 || !Array.isArray(p.sources) || !lawfulHolo(p)) return false;
  let sum = 0;
  for (const s of p.sources) {
    if (!s || typeof s.label !== "string" || !isInt(s.n) || !isInt(s.count) || !Array.isArray(s.records)) return false;
    sum += s.n;
  }
  return sum === p.earned;
}

const lawfulHoloRow = (p) => !!p && typeof p.handle === "string" && !!p.handle && p.holo > 0 && lawfulHolo(p);

export function readHall(raw) {
  if (!raw || typeof raw !== "object" || !DAY_RE.test(String(raw.as_of ?? "")) || !raw.months || typeof raw.months !== "object") return null;
  const months = {};
  for (const [month, body] of Object.entries(raw.months)) {
    if (!MONTH_RE.test(month) || !Array.isArray(body?.people) || !Array.isArray(body?.holoBoard)) continue;
    if (!isInt(body.earners) || !isInt(body.holoRecipients)) continue;
    if (!body.people.every(lawfulPerson) || !body.holoBoard.every(lawfulHoloRow)) continue;
    months[month] = body;
  }
  return { as_of: raw.as_of, months };
}

// ── the view ─────────────────────────────────────────────────────────────────
// `today` is the town's day (civic.mjs townDay), passed in so the clock is the
// caller's one and the month rolls over with the town's calendar.
//
// state:
//   unavailable  no emission, or none for this month and its as_of is older:
//                the page says the record could not be read, and draws no zero
//   empty        this month's record exists and nobody earned anything yet
//   ok           rows
export function hallView(hall, { today, limit = null, letterBook = null } = {}) {
  const month = monthOfDay(today);
  const none = () => ({ state: "unavailable", month, monthLabel: monthLabel(month), asOf: hall?.as_of ?? null, rows: [], holoRows: [], earners: 0, holoRecipients: 0 });
  if (!month || !hall) return none();
  const body = hall.months?.[month];
  if (!body) return none();

  const link = (ref) => {
    if (!ref) return null;
    if (ref.type === "letter") return letterBook && letterBook.has(ref.id) ? letterHref(ref.id, letterBook) : null;
    if (ref.type === "resident") return `/residents/${ref.id}/`;
    if (ref.type === "pot") return `/fund/${ref.id}/`;
    return null;
  };

  const holoPots = (p) => p.holoPots.map((h) => ({ pot: h.pot, n: h.n, count: h.count, href: `/fund/${h.pot}/` }));
  const rows = (limit == null ? body.people : body.people.slice(0, limit)).map((p, i) => ({
    rank: i + 1,
    handle: p.handle,
    href: `/residents/${p.handle}/`,
    earned: p.earned,
    holo: p.holo,
    holoPots: holoPots(p),
    sources: p.sources.map((s) => ({
      label: s.label, n: s.n, count: s.count,
      records: s.records.map((r) => ({ date: r.date, n: r.n, label: r.label, href: link(r.ref) })),
      more: s.count - s.records.length,
    })),
  }));
  return {
    state: body.earners > 0 || body.holoRecipients > 0 ? "ok" : "empty",
    month,
    monthLabel: monthLabel(month),
    asOf: hall.as_of,
    rows,
    // the holo board is the full board's, never the preview's
    holoRows: limit == null
      ? body.holoBoard.map((p) => ({ handle: p.handle, href: `/residents/${p.handle}/`, holo: p.holo, holoPots: holoPots(p) }))
      : [],
    earners: body.earners,
    holoRecipients: body.holoRecipients,
  };
}

// "November 2026", from the month itself, in a fixed zone so the label never
// follows the runner's clock
export function monthLabel(month) {
  if (!MONTH_RE.test(String(month ?? ""))) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}

// ── the loader ───────────────────────────────────────────────────────────────
// The committed emission, read and checked, or null: a build that cannot read
// it says "unavailable" on the page, it never draws an empty board as a town
// where nobody earned. Same two candidate paths as funding.mjs's readEmission.
export function loadHall({ path = null } = {}) {
  const candidates = path
    ? [path]
    : [new URL("../data/postmark/hall-of-fame.json", import.meta.url), join(process.cwd(), "src", "data", "postmark", "hall-of-fame.json")];
  for (const c of candidates) {
    try { return readHall(JSON.parse(readFileSync(c, "utf8"))); } catch { /* try the next */ }
  }
  return null;
}
