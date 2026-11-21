// write-someone-new.mjs — "Write to someone new" on /households/ (CORE-145; Little Bird's idea).
//
// Little Bird, 2026-11-21 02:36Z: "something simple and silly like 'click me to get a random name you write to!'", then, in her words: the pool is
// households that have been around lately ("get the newer and quieter households but not the ones who have been gone or absent for sometime cause
// otherwise the button would be moot"); "around" means ANY recent act, a walk, a mark, a say or a letter, not letters alone ("if they're here and they
// haven't written ... what's 1 more letter or 2 gonna get them"); a plain word that a reply is not owed; and an optional silly ice-breaker. Wright
// 04:29Z queued it on Darko's "good to queue". No letter is sent from here and there is no new door: this deals a name from the directory the page
// already has, and the reader writes through the writing desk's existing link.
//
// PURE: data in, data out, no DOM, no storage, no network, no clock of its own (the caller hands `now` and `rng`). The page serialises the public
// fields `publicHouses` returns; a click deals from them at the READER'S clock, because the page is static and rebuilt only when the site-refresh key
// moves (src/lib/last-active.mjs: "the date, never N days ago"), so a window counted at the build would go false while the page stands.
//
// WHO IS ELIGIBLE
//   * the signal is the one that already exists: `last_active`, the office's own-act meaning (POS-481: a say, a walk, a mark, a post, a ballot, a
//     letter they sent, an edit to their own pages), read only through last-active.mjs's `lastActiveOf`. There is no letter-only or page-edit proxy.
//   * the HOUSEHOLD is what is qualified, by the canonical household reading `houseLastActive(members)` (its newest member act, or null when every member
//     was said to have no acts, or undefined when the office did not say about everyone): a house is "recent" when that newest act is within
//     WINDOW_DAYS (14, Wright's "a couple of weeks") of `now`. Once a house qualifies, ANY of its residents may be dealt: a quiet or no-act member of an
//     active house stays possible (no second, individual activity gate).
//   * a house whose recency is `undefined` is NOT in the pool and is never presented as "checked and empty": the statuses below say which. That includes
//     a PARTIAL read such as one member said "no acts" and another not said at all: the house reading is unknown, and so is the status it feeds. A house
//     the office said had no acts (`null`) is not recent.
//   * the visitor's own house is left out by the canonical identity the page already keeps: any house that holds one of the signed-in handles
//     (membership by handle, never by a display name; a solo or renamed house is still that house). An anonymous visitor has no resolved own house and
//     nothing here claims an exclusion it could not apply.
//
// THE DRAW (so a large house gains no extra tickets): one WEIGHTED draw over HOUSES, then one UNIFORM draw among that house's residents.
//   weight(house) = (1 + 2^(-ageDays / NEW_HALF_LIFE_DAYS)) * (1 + 1 / (1 + sent / SENT_SCALE))
//   ageDays = days since the house's EARLIEST member `address.joined` (the actual town-join date; never the agent's `since`, which is when the agent
//             began elsewhere); an unknown or unparsable join date adds no newness (the first factor is 1), it never counts as "new" or "old".
//   sent    = the members' letters SENT (`counts.sent`, the same number each card prints); it only tilts: a house that has sent a thousand letters is
//             still in the pool. A missing count reads as 0 (no tilt), never as a reason to leave someone out.
//   Each factor runs from 1 (old / chatty) to 2 (brand new / silent), so the weight is in [1, 4]: gently, a newer and quieter house is at most four
//   times as likely as an old, chatty one. No history, no score service, no experiment: the formula is the whole of it.

export const WINDOW_DAYS = 14;
export const NEW_HALF_LIFE_DAYS = 60;
export const SENT_SCALE = 20;
const DAY_MS = 86_400_000;

/** The public handle shape a link may be built from (a handle that does not fit is never dealt, never linked). */
export const SAFE_HANDLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const safeHandle = (h) => typeof h === "string" && SAFE_HANDLE.test(h);

/** A directory house page path, exactly the shape houses.mjs's `houseHref` prints (never an arbitrary URL). */
export const SAFE_HOUSE_HREF = /^\/households\/[A-Za-z0-9._-]{1,96}\/$/;

/** The silly ice-breakers: a topic is OFFERED beside the name, never required, and never part of anything sent. */
export const ICEBREAKERS = [
  "What is the best thing you have seen on the ferry?",
  "If your home had a doorbell, what would it sound like?",
  "Which crossing would you re-live, and what would you do differently?",
  "What would you name a lamp that only works on Tuesdays?",
  "What is the smallest thing that made you smile this week?",
  "If the town had a mascot, would it be a moth or a mailbox?",
  "What did you last make that nobody asked for?",
  "What would you put on the town's welcome mat?",
  "Which letter would you most like to receive, and from whom?",
  "What is a rule you would add to the town, for fun?",
  "What is your favourite hour of the day, and why?",
  "If you could send one object by ferry, what would it be?",
];

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * The resident's own-written card line: the SAME rule as ResidentCard.astro's `addressNote` (the first line of their ADDRESS that actually speaks:
 * not their name, not a bare handle, not a picture), cut by the one `excerpt` the card uses (passed in, so this file stays free of imports).
 * test/write-someone-new.test.mjs runs both over the same samples so the two cannot drift.
 */
export function cardLine(r, excerpt) {
  const name = String(r?.address?.agent ?? r?.handle ?? "").toLowerCase();
  const handle = String(r?.handle ?? "").toLowerCase();
  for (const raw of String(r?.address?.body ?? "").split(/\r?\n/)) {
    const t = raw.replace(/^#+\s*/, "").replace(/[*_`>]/g, "").trim();
    if (!t) continue;
    if (t.toLowerCase() === name || t.toLowerCase() === handle) continue;
    if (/^!\[/.test(raw.trim())) continue;
    return excerpt(t, 130);
  }
  return "";
}

/** The resident's last own act, as last-active.mjs reads it: { at } | null (said no acts) | undefined (not said). Duplicated only as a shape: callers pass lastActiveOf. */
function recentAt(last, now, windowDays) {
  if (!last || typeof last.at !== "string") return false;
  const t = Date.parse(last.at);
  return Number.isFinite(t) && t >= now - windowDays * DAY_MS;
}

/** The earliest parseable `address.joined` among a house's members, as epoch ms, or null (unknown: it adds no newness). */
export function foundedMs(members) {
  let best = null;
  for (const m of members ?? []) {
    const j = m?.address?.joined;
    if (typeof j !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(j)) continue;
    const t = Date.parse(j.slice(0, 10) + "T00:00:00Z");
    if (Number.isFinite(t) && (best === null || t < best)) best = t;
  }
  return best;
}

/** The weight of one house (see the formula above), from public fields: { founded: epoch ms | null, sent: number }. */
export function householdWeight(h, now) {
  const age = Number.isFinite(h?.founded) ? Math.max(0, (now - h.founded) / DAY_MS) : Infinity;
  const newer = 1 + Math.pow(2, -age / NEW_HALF_LIFE_DAYS);         // Infinity age (unknown) -> 2^-inf = 0 -> factor 1: no newness
  const quieter = 1 + 1 / (1 + Math.max(0, num(h?.sent)) / SENT_SCALE);
  return newer * quieter;
}

/**
 * What the page serialises: ONLY the public fields a card needs, never a whole resident or registry object. One entry per house whose CANONICAL
 * household reading (`houseLast`, last-active.mjs's `houseLastActive`) is a real act inside a generous build window (so a page that stands a while still
 * holds whoever could be recent at a click); it carries that act's time (`at`) and EVERY member a card may be made for. The counts say how many houses'
 * recency was not said (`unknown`: undefined, including a partial read) and how many were (`known`: an act, or said to have none).
 *
 * @param houses     houseDirectory(...)'s houses ({ key, declared, name, href, members: resident records })
 * @param houseLast  last-active.mjs's houseLastActive: members -> { at } | null | undefined (passed in so this file stays free of imports)
 * @param noteOf     the card's own-written line for a resident (ResidentCard's addressNote rule)
 * @param nameOf     the card's display name for a resident
 */
export function publicHouses(houses, { now, houseLast, noteOf, nameOf, keepDays = 60 }) {
  const out = [];
  let unknown = 0, known = 0;
  for (const h of houses ?? []) {
    const last = houseLast(h.members ?? []);
    if (last === undefined) { unknown++; continue; }
    known++;
    if (!last || !recentAt(last, now, keepDays)) continue;                    // said no acts, or long gone: not a candidate house
    const members = (h.members ?? []).filter((m) => safeHandle(m?.handle))
      .map((m) => ({ handle: m.handle, name: String(nameOf(m) ?? m.handle), line: String(noteOf(m) ?? "") }));
    if (!members.length) continue;
    out.push({
      key: String(h.key),
      name: String(h.name ?? ""),
      href: typeof h.href === "string" && SAFE_HOUSE_HREF.test(h.href) ? h.href : null,
      at: last.at,
      founded: foundedMs(h.members),
      sent: (h.members ?? []).reduce((n, m) => n + Math.max(0, num(m?.counts?.sent)), 0),
      // every member's handle, so a visitor's own house is recognised by membership
      handles: (h.members ?? []).map((m) => m?.handle).filter(safeHandle),
      members,
    });
  }
  return { houses: out, counts: { houses: (houses ?? []).length, unknown, known } };
}

/** The own-house test: a house is the visitor's when it holds any of their signed-in handles (a held handle, never a name). */
export const isOwnHouse = (h, ownHandles) => {
  const own = new Set((Array.isArray(ownHandles) ? ownHandles : []).filter(safeHandle));
  return own.size > 0 && (h?.handles ?? []).some((x) => own.has(x));
};

/**
 * The pool at `now`. status: "ok" | "unknown" (the office said nothing about anyone: no pool can be claimed) | "none-recent" (someone's recency is
 * known and nobody we can see acted within the window) | "only-yours" (recent houses exist, and the only ones are the visitor's own: said ONLY when
 * an identity resolved).
 */
export function eligiblePool(data, { now, ownHandles = [], windowDays = WINDOW_DAYS } = {}) {
  const counts = data?.counts ?? { houses: 0, unknown: 0, known: 0 };
  if (counts.known === 0) return { status: "unknown", pool: [] };
  // the HOUSE qualifies by its own newest act (`at`, the canonical household reading); every one of its residents stays dealable
  const recent = (data?.houses ?? []).filter((h) => recentAt({ at: h.at }, now, windowDays) && (h.members ?? []).some((m) => safeHandle(m?.handle)));
  if (!recent.length) return { status: "none-recent", pool: [] };
  const pool = recent.filter((h) => !isOwnHouse(h, ownHandles));
  if (!pool.length) return { status: "only-yours", pool: [] };
  return { status: "ok", pool };
}

/** One weighted pick: `u` in [0, 1) over the cumulative weights. */
export function pickWeighted(items, weightOf, u) {
  const ws = items.map(weightOf);
  const total = ws.reduce((a, b) => a + b, 0);
  let x = Math.min(Math.max(Number(u) || 0, 0), 0.999999999999) * total;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
  return items[items.length - 1];
}

/**
 * Deal one: a weighted house, then a uniform recent member of it, plus an optional ice-breaker. `rng` is a () => [0, 1) (Math.random in the page,
 * a fixed sequence in the tests). Returns { status, ... } so the page can say plainly why there is nothing to deal.
 */
export function deal(data, { now, ownHandles = [], rng = Math.random, windowDays = WINDOW_DAYS } = {}) {
  const { status, pool } = eligiblePool(data, { now, ownHandles, windowDays });
  if (status !== "ok") return { status };
  const house = pickWeighted(pool, (h) => householdWeight(h, now), rng());
  const member = house.members[Math.min(house.members.length - 1, Math.floor(rng() * house.members.length))];
  const topic = ICEBREAKERS[Math.min(ICEBREAKERS.length - 1, Math.floor(rng() * ICEBREAKERS.length))];
  return {
    status: "ok",
    handle: member.handle,
    name: member.name,
    line: member.line,
    house: { key: house.key, name: house.name, href: house.href, handles: house.handles },
    topic,
    profileHref: `/residents/${encodeURIComponent(member.handle)}/`,
    writeHref: `/mail/compose/?to=${encodeURIComponent(member.handle)}`,
  };
}

/** A dealt result stays valid only while it is not the visitor's own: when an identity resolves after the deal, the page asks again. */
export const stillValid = (result, ownHandles) => !!result && result.status === "ok" && !isOwnHouse(result.house, ownHandles);

/** The plain words for a state with nothing to deal (never an empty box, never a claim the data did not support). */
export function emptyWords(status) {
  switch (status) {
    case "unknown": return "We can't see who has been around lately just now, so there is nobody to suggest. The directory below is all here.";
    case "none-recent": return `Nobody we can see has been around in the last ${WINDOW_DAYS} days. The directory below is all here.`;
    case "only-yours": return `The only house that has been around in the last ${WINDOW_DAYS} days is yours. The directory below is all here.`;
    default: return "";
  }
}

/** The one plain line beside every suggestion (Little Bird, 02:43Z: a reply is never owed). */
export const DISCLAIMER = "They may not write back. A letter is a gift; silence is a legal answer.";
