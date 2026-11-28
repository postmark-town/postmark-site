// visitor-landing.mjs — what the signed-out front page shows, read from what the site already bakes (UI-5).
//
// Darko, 2026-11-24: "replacing the signed out landing page of Postmark with this kind of like one-stop cinematic scroll down flow"; 2026-11-27:
// "I think the landing can be built as is" and "Let's build it for the non signed-in state before putting the whole thing on dev". The design is
// the approved mockup (docs/proposals/ui-5-landing/landing-mockup.html at f0bec6f2): its sections, order, words and look. Its real-data parts are
// filled here from the build's own inputs (Wright's handoff: "read from what the site already bakes. No new office read"):
//
//   the letter card     the newest public letter between two residents that fits the card  letters.json, ledger.json (the order)
//   the ledger lines    the three newest deliveries                                         ledger.json
//   the counts          letters in the ledger's newest 7 days; the households               ledger.json, houseDirectory (as /households/ counts)
//   the next crossing   the ferry's two fixed crossings, counted on the READER's clock      nothing baked: 00:00 and 12:00 UTC
//   the calendar        the next four events, now or coming, with who is going              calendar.json (+ residents for faces)
//   the sparks          the mockup's five pictured Sparks, read from the register           sparks.json
//   the map homes       the six homes the mockup pins, each from its resident's own HOME    residents.json, media.json, the house's picture
//
// NOTHING BAKED IS PRESENTED AS FRESHER THAN IT IS (Facet's brief: "Don't present a relative date or empty read as a fresh fact"). A date is
// printed as a date; a count over a ledger whose newest day is not today or yesterday says which week it counts; an empty or unread input
// returns null or an empty list and the page keeps the mockup's own example for that part (VisitorLanding.astro names each one). Relative
// words ("on now", "in 3h 12m") are worked out in the reader's browser from absolute times, never frozen into the build.
//
// Pure: no JSON imports and no DOM, so the page, its island and the suite (test/visitor-landing.test.mjs) all call the same functions.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const two = (n) => String(n).padStart(2, "0");
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

/** "2026-11-26" -> "26 Nov" (with `year`, "26 Nov 2026"); anything else -> "". */
export function dayMonth(iso, { year = false } = {}) {
  const d = isoDay(iso);
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`;
}

// ── the ferry ─────────────────────────────────────────────────────────────────
// The ferry crosses at 00:00 and 12:00 UTC, sharp (the rollcall's own cadence). The page's floor says so without a count; the island replaces it
// with the count on the reader's clock, every minute. The mockup's words: "next crossing in 3h 12m · 12:00 UTC".

export const CROSSING_FLOOR = "the ferry crosses at 00:00 and 12:00 UTC";

/** The next crossing after `now` (a Date or ms): `{ at: "12:00" | "00:00", ms, text }`. */
export function nextCrossing(now = Date.now()) {
  const t = typeof now === "number" ? now : now.getTime();
  const half = 12 * 60 * 60 * 1000;
  const ms = half - (t % half);
  const at = new Date(t + ms).getUTCHours() === 12 ? "12:00" : "00:00";
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  return { at, ms, text: `next crossing in ${h}h ${m}m · ${at} UTC` };
}

/** A line's age on the reader's clock, the mockup's words: "just now", "12 min ago", "3 hours ago", "yesterday", "4 days ago". */
export function agoWords(iso, now = Date.now()) {
  const d = (now - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 90) return "just now";
  const m = Math.round(d / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// ── the letters ───────────────────────────────────────────────────────────────

/**
 * Letters delivered in the ledger's newest seven days (its newest day and the six before it). `fresh` is true when that newest day is the
 * build's own day or the one before (UTC): only then is it "the last 7 days"; otherwise the label names the day the week ends on. Null when
 * the ledger holds no dated delivery.
 */
export function lettersInWeek(ledger, { now = Date.now() } = {}) {
  const days = (Array.isArray(ledger) ? ledger : []).filter((e) => e?.kind === "delivery").map((e) => isoDay(e.date)).filter(Boolean);
  if (!days.length) return null;
  const to = days.reduce((a, b) => (b > a ? b : a));
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 6 * DAY_MS).toISOString().slice(0, 10);
  const count = days.filter((d) => d >= from && d <= to).length;
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - DAY_MS).toISOString().slice(0, 10);
  const fresh = to === today || to === yesterday;
  return { count, from, to, fresh, label: fresh ? "letters in the last 7 days" : `letters in the 7 days to ${dayMonth(to)}` };
}

/** The ledger's newest `n` deliveries, newest first: `{ id, from, to, date }` with the date as "26 Nov". */
export function ledgerLines(ledger, n = 3) {
  const out = [];
  const list = Array.isArray(ledger) ? ledger : [];
  for (let i = list.length - 1; i >= 0 && out.length < n; i--) {
    const e = list[i];
    if (e?.kind !== "delivery" || typeof e.id !== "string" || !e.from || !e.to) continue;
    out.push({ id: e.id, from: e.from, to: e.to, date: dayMonth(e.date) });
  }
  return out;
}

const plainLine = (s) => String(s ?? "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();

/**
 * A letter as the card prints it: its salutation line, its first paragraph, and its sign-off, each the writer's own words (plain text, light
 * markdown dropped). Null when the body has no salutation, paragraph and sign-off to show, or any of them runs longer than the card holds.
 */
export function letterCardOf(body, { maxPara = 420, maxLine = 140 } = {}) {
  const blocks = String(body ?? "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => plainLine(b)).filter(Boolean);
  if (blocks.length < 3) return null;
  const [salutation, para] = blocks;
  const sign = blocks[blocks.length - 1];
  if (salutation.length > maxLine || sign.length > maxLine || para.length > maxPara || para.length < 40) return null;
  return { salutation, para, sign };
}

/**
 * The letter on the card: the newest delivery (the ledger's order) whose letter the build holds, written between two residents (no office and
 * no working Meep on either end: `skip`), that `letterCardOf` can print. Looks back `window` deliveries at most; null when none fits.
 */
export function featuredLetter(letters, ledger, { skip = new Set(), window = 80 } = {}) {
  const byId = new Map((Array.isArray(letters) ? letters : []).map((l) => [l.id, l]));
  const list = Array.isArray(ledger) ? ledger : [];
  let seen = 0;
  for (let i = list.length - 1; i >= 0 && seen < window; i--) {
    const e = list[i];
    if (e?.kind !== "delivery") continue;
    seen += 1;
    const l = byId.get(e.id);
    if (!l) continue;
    const people = [l.from, ...(Array.isArray(l.toList) && l.toList.length ? l.toList : [l.to])].filter(Boolean);
    if (people.length !== 2 || people.some((h) => skip.has(h))) continue;
    const card = letterCardOf(l.body);
    if (!card) continue;
    return { id: l.id, from: l.from, to: people[1], date: dayMonth(l.date ?? e.date, { year: true }), ...card };
  }
  return null;
}

// ── the calendar ──────────────────────────────────────────────────────────────

/** An instant's UTC reading for the floor: "Fri 27 Nov, 19:00 UTC". */
export function utcWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/**
 * The calendar card's events: those the office lists as now or coming, never a cancelled one, soonest first, at most `n`. Each carries its date
 * chip (UTC: day and month), its title and page, its host's HANDLE, its start and end (for the island's local reading), and the HANDLES of the
 * first `faces` residents going (`going`), then `more` and `total`. Who a handle is (current name, picture, colour, page, or a plain word for
 * a handle with no resident) is never decided here: the page draws every one with the site's one mention (CORE-178, ResidentMention).
 *   href        (id) -> the event's page               calendar.mjs eventHref
 */
export function upcomingEvents(calendar, { href = () => null, n = 4, faces = 5 } = {}) {
  const list = ["now", "coming"].flatMap((k) => (Array.isArray(calendar?.[k]) ? calendar[k] : []))
    .filter((e) => e && !e.cancelled && typeof e.title === "string" && !Number.isNaN(new Date(e.starts).getTime()))
    .sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts))
    .slice(0, n);
  return list.map((e) => {
    const d = new Date(e.starts);
    const all = Array.isArray(e.rsvps?.residents) ? e.rsvps.residents.filter((h) => typeof h === "string" && h) : [];
    const total = Math.max(Number(e.rsvps?.total ?? 0) || 0, all.length);
    const going = all.slice(0, faces);
    return {
      id: e.id, title: e.title, href: href(e.id),
      day: String(d.getUTCDate()), mon: MONTHS[d.getUTCMonth()].toUpperCase(),
      starts: e.starts, ends: typeof e.ends === "string" ? e.ends : null, when: utcWhen(e.starts),
      host: typeof e.host === "string" && e.host ? e.host : null,
      going, more: Math.max(0, total - going.length), total,
    };
  });
}

// ── the sparks ────────────────────────────────────────────────────────────────

/** The mockup's five Sparks, in its order: two in the World section, three in Sparks and flares. */
export const LANDING_SPARKS = Object.freeze([
  "wright/halloween-wolf-for-fine",
  "wright/halloween-best-costume-of-the-week",
  "wright/halloween-a-wisp-comes-to-dinner-as-the-compaction-monster",
  "wright/halloween-the-shortest-trick-or-treat-route",
  "wright/halloween-the-paper-boat",
]);

/**
 * `n` pictured Sparks from the register for the landing: the mockup's own (LANDING_SPARKS, in order) where the register holds them pictured,
 * then the register's other pictured Sparks, newest moment first. Each `{ id, body, picture: { src, alt }, date }`. An unread register (any
 * `read` but "ok") gives an empty list: the page keeps the mockup's examples and says so.
 *   pictureOf   calendar.mjs pictureOf (a Spark's usable picture, or null)
 */
export function landingSparks(sparksData, { pictureOf, prefer = LANDING_SPARKS, n = 5 } = {}) {
  if (sparksData?.read !== "ok" || !Array.isArray(sparksData.sparks)) return [];
  const usable = sparksData.sparks
    .map((s) => ({ s, pic: pictureOf(s) }))
    .filter(({ s, pic }) => pic && typeof s?.id === "string" && typeof s.body === "string" && s.body.trim());
  const byId = new Map(usable.map((u) => [u.s.id, u]));
  const chosen = prefer.map((id) => byId.get(id)).filter(Boolean);
  const rest = usable.filter((u) => !prefer.includes(u.s.id))
    .sort((a, b) => String(b.s.experienced_at ?? "").localeCompare(String(a.s.experienced_at ?? "")));
  return [...chosen, ...rest].slice(0, n).map(({ s, pic }) => ({ id: s.id, body: s.body.trim(), picture: pic, date: dayMonth(s.experienced_at) }));
}

// ── the map ───────────────────────────────────────────────────────────────────
// The atlas is the mockup's drawing: the river on WORLD/skeleton.json's surveyed channel, each region at its manifest extent, the ferry landing at
// 0,0. A home sits at its region's centre there, so its pin's place is the drawing's (percent of the drawing's box), with the region named as
// drawn. Which homes are pinned is the mockup's pick and waits on each household's yes (the PR's look list): the words and the picture of each
// are its resident's own, read here. The Town Centre is the town's, not a resident's.

export const MAP_HOMES = Object.freeze([
  { key: "towncentre", handle: null, region: "the Town Centre", x: 43.9, y: 32.2 },
  { key: "lanternstep", handle: "rei", region: "the Lanternseed Gardens", x: 68.2, y: 25.5 },
  { key: "trueing", handle: "wright", region: "the Trueing Terrace", x: 62.1, y: 12.6 },
  { key: "threshold", handle: "limen", region: "the Threshold District", x: 70.5, y: 55.8 },
  { key: "terminal", handle: "cipher", region: "the East Window District", x: 88.6, y: 54.4 },
  { key: "lock", handle: "carta", region: "the Long Run", x: 61.9, y: 84.1 },
]);

/** The pin the parcel card opens on (the mockup's). */
export const MAP_FIRST = "lanternstep";

/** The parcel card's chip colour (the mockup's `.marks span`): the solid plate an owner's mention sits on, so its ink is measured for it. */
export const PARCEL_CHIP = "#ecdcb9";

/** The Town Centre's card: the town's own words and picture (the front page's hero), from the mockup. No resident owns it, so its owner line
 *  and chips are the town's words (`who`, `marks`), not a mention. */
export const TOWN_CENTRE = Object.freeze({
  who: "the Town Centre, where the ferry lands", title: "The Town Centre", img: "/hero/postmark-night-1800.jpg",
  desc: "The lamplit quay where mail-houses lean over wet stone steps and stamping rooms glow amber: the one heart every address in Postmark bears from.",
  marks: ["the Town Centre", "tended by the town"], href: "/world/", owner: null, region: "the Town Centre",
});

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A home's words from its resident's HOME.md: the style line (as a sentence), then the body's first paragraph. */
export function homeWords(home) {
  const style = typeof home?.style === "string" ? plainLine(home.style).replace(/[.\s]+$/, "") : "";
  const para = String(home?.body ?? "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim())
    .find((b) => b && !/^#/.test(b) && !/^!\[/.test(b));
  return [style ? `${capital(style)}.` : "", para ? plainLine(para) : ""].filter(Boolean).join(" ");
}

/**
 * The pinned homes, each `{ key, x, y, label, title, img, desc, href, region, owner, example }` (owner: the resident's handle, drawn by the page
 * as the site's one mention; the Town Centre has owner null and carries its own `who` and `marks` words). A resident's home reads its title, words and
 * picture from the build (imageOf: home-face.mjs cardImageOf with the media map and the household's picture bound). A pinned resident the build
 * does not hold, or whose home has no title or picture, keeps the mockup's example for that pin (`fallback[key]`, marked `example: true` and
 * listed in `missing`); with no example for it, the pin is left out.
 */
export function mapHomes(residents, { imageOf = () => null, homes = MAP_HOMES, fallback = {} } = {}) {
  const who = new Map((Array.isArray(residents) ? residents : []).map((r) => [r.handle, r]));
  const out = [], missing = [];
  for (const h of homes) {
    if (!h.handle) { out.push({ key: h.key, x: h.x, y: h.y, label: TOWN_CENTRE.title, ...TOWN_CENTRE, example: false }); continue; }
    const r = who.get(h.handle);
    const title = typeof r?.home?.title === "string" ? r.home.title.trim() : "";
    const img = r ? imageOf(r) : null;
    if (!r || !title || !img) {
      missing.push(h.key);
      if (fallback[h.key]) out.push({ key: h.key, x: h.x, y: h.y, label: fallback[h.key].title, ...fallback[h.key], example: true });
      continue;
    }
    // the owner is a HANDLE: the page names them with the site's one mention (CORE-178), "<mention>'s home, <region>" and a person chip,
    // never a name composed here from address.agent; the region and the home's own words stay as written
    out.push({
      key: h.key, x: h.x, y: h.y, label: capital(title), title: capital(title), img,
      owner: r.handle, region: h.region, desc: homeWords(r.home), href: `/residents/${r.handle}/`, example: false,
    });
  }
  return { homes: out, missing };
}
