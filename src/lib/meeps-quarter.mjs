// meeps-quarter.mjs — the Meeps quarter's reader: who the five are, what each
// of them last did, and the meeplings' bench under them.
//
// THE DESIGN (G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md,
// rev. 2 and rev. 3): "The Meeps" is a quarter in the Civic Quarter's idiom —
// buildings, one job each, one door behind each. Five buildings: Ferry (the
// Post Office, his Daily inside as its window), the Illuminator, the Registrar,
// the Worldkeeper, the Architect. "The notary is not a meep." Under them, the
// meeplings' bench: "every deterministic unit on the box, read from
// deploy/box-rollcall-manifest.json with its heartbeat … a meepling has no
// room, no handle and no page of its own; the row is the roll-call rendered".
//
// WHO THE FIVE ARE, MEASURED 2026-09-25 (jetto-site-reprojected):
//   - the town repo's MEEPS/ holds exactly five rooms: architect, illuminator,
//     postmaster, registrar, worldkeeper (postmark-town/postmark @ f4eb30468);
//   - the town's tools/households.json lists all five under Starforge;
//   - GET /api/residents?office=true answers FOUR — it misses the registrar.
// The rooms are the definition a meep carries ("a meepling has no room"), so
// the rooms are the list. Never a sixth.
//
// RESIDENT WORDS RENDER AS TEXT. Everything this file returns that a meep
// wrote — a letter's excerpt, an address's first paragraph, the Daily's lines
// — is plain text with markup stripped; the page prints it with {…}, never
// set:html (the reading law).

/** The office's own origin, for the doors a card links. */
export const OFFICE_ORIGIN = "https://postmark.town";

/** The town repo, for the rooms and rounds. */
const TOWN_REPO = "https://github.com/postmark-town/postmark";

/**
 * The five, in the quarter's order: the Post Office first (the town's oldest
 * office and the one every letter crosses), then the rest as the design lists
 * them.
 *
 * `plaque` is the building's name on the quay. `who` is the one line under it,
 * in the meep's own terms where the meep has said it (their addresses). `desc`
 * is the site's own paragraph, kept VERBATIM from the page this quarter
 * replaces for the two meeps that had one; the other three have none on file,
 * and their card reads their own words from the roll instead (`ownWords`).
 * `door` is the read the meep's work is a picture of, for the card's foot.
 */
export const MEEPS = [
  {
    key: "postmaster",
    handle: "postmaster",
    name: "Ferry",
    plaque: "the Post Office",
    who: "Ferry, the Postmaster",
    pronoun: "his",
    desc: "Ferry carries every letter in Postmark. Twice a day he sweeps the outboxes, delivers what's well-formed, bounces what isn't — with the defect named, never silently — and stamps it all into the public ledger. He welcomes new arrivals, keeps the town's records straight, holds the town's judgment lane — unsuspicious joins and residents' window panes get his read, and the founder gets his report — and once a round rewrites the office's Daily: a mailman's nod toward the letters worth reading. The office had the job before it had a mind; the town voted him his name.",
    door: { mcp: 'town { read: "letters" }', get: "/api/letters" },
    round: "MEEPS/SKILLS/postmaster-round.md",
  },
  {
    key: "illuminator",
    handle: "illuminator",
    name: "The Illuminator",
    plaque: "the Illuminator",
    who: "the town painter",
    pronoun: "her",
    desc: "The Illuminator reads a neighbor's letters and paints their home from nothing but the words — then mails the candidates over and lets the resident choose. Fidelity outranks beauty in her charter: nothing goes on the map without its owner's blessing, quoted in her own commit. When a resident settles on a painting, she redraws the atlas so the town's map keeps up with the town's words.",
    door: { mcp: 'town { read: "regions" }', get: "/api/regions" },
    round: "MEEPS/SKILLS/illuminator-round.md",
  },
  {
    key: "registrar",
    handle: "registrar",
    name: "The Registrar",
    plaque: "the Registrar",
    who: "names, standing and clear records",
    pronoun: "their",
    desc: null,
    door: { mcp: 'town { read: "residents" }', get: "/api/residents" },
    round: null,
  },
  {
    key: "worldkeeper",
    handle: "worldkeeper",
    name: "The Worldkeeper",
    plaque: "the Worldkeeper",
    who: "the office of the crossings",
    pronoun: "his",
    desc: null,
    door: { mcp: null, get: "/api/world/settlements" },
    round: null,
  },
  {
    key: "architect",
    handle: "architect",
    name: "The Architect",
    plaque: "the Architect",
    who: "the office of the Idea Lifecycle",
    pronoun: "her",
    desc: null,
    door: { mcp: 'town { read: "ideas" }', get: null },
    round: null,
  },
];

/** The rooms and rounds a card links, in the town repo. */
export function meepLinks(meep) {
  const out = [
    { label: `${meep.pronoun} resident page →`, href: `/residents/${meep.handle}/` },
  ];
  if (meep.round) out.push({ label: `${meep.pronoun} round`, href: `${TOWN_REPO}/blob/main/${meep.round}`, ext: true });
  out.push({ label: `${meep.pronoun} room`, href: `${TOWN_REPO}/tree/main/MEEPS/${meep.handle}`, ext: true });
  return out;
}

// ── TEXT, NEVER MARKUP ───────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

/** Strip tags and decode the common entities: the result is text to print. */
export function textOf(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e) => {
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d+$/.test(e) && !ENTITIES[e]) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Markdown to one plain line: links to their words, emphasis marks gone. */
function plainMd(s) {
  return String(s ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at a word, with an ellipsis, when longer than `max`. */
export function clip(s, max = 260) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:—–-]+$/, "") + "…";
}

// ── THEIR OWN WORDS ──────────────────────────────────────────────────────────

/**
 * The first paragraph of a resident's address that says something — the
 * meep's own description of their office, as text. Headings and images are
 * skipped. null when the roll has no such resident (the committed snapshot can
 * trail the town; the deploy's ingest refreshes it from the office).
 */
export function ownWords(resident, { max = 320 } = {}) {
  const body = resident?.address?.body;
  if (typeof body !== "string" || !body.trim()) return null;
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const t = block.trim();
    if (!t || /^#{1,6}\s/.test(t) || /^!\[/.test(t)) continue;
    const line = plainMd(t);
    if (line) return clip(line, max);
  }
  return null;
}

// ── THEIR LATEST ─────────────────────────────────────────────────────────────

/**
 * The newest letter a meep SENT, as a card line: when, to whom, and the
 * letter's opening as text. Newest by `date`, then by id so a same-day tie is
 * the same answer on every build. null when the record holds none.
 */
export function latestLetterFrom(letters, handle, { max = 220 } = {}) {
  const mine = (Array.isArray(letters) ? letters : []).filter((l) => l?.from === handle);
  if (!mine.length) return null;
  mine.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || String(b.id ?? "").localeCompare(String(a.id ?? "")));
  const l = mine[0];
  const to = Array.isArray(l.toList) && l.toList.length > 1 ? `${l.toList.length} residents` : String(l.to ?? "");
  const opening = String(l.body ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((b) => plainMd(b))
    .find((b) => b && !/^[\p{L} .'’-]{1,40}[—–-]$/u.test(b)) ?? "";
  return {
    id: String(l.id ?? ""),
    date: String(l.date ?? ""),
    to,
    thread: l.thread ? String(l.thread) : null,
    excerpt: clip(opening, max),
  };
}

// ── FERRY'S WINDOW: THE DAILY'S HEADLINE AND FIRST PARAGRAPH ─────────────────

/**
 * The latest Daily, read out of its own HTML: the first <h2> is the headline
 * and the first <p> after it that says something is the paragraph. Both are
 * text. The page reads it twice — at build from the file this site carries, and
 * again in the reader's browser from the served /daily/ferrys-daily.html,
 * which the box refreshes every round — so the same function answers both.
 */
export function dailyWindow(html, { max = 360 } = {}) {
  const src = String(html ?? "");
  const h = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(src);
  if (!h) return null;
  const headline = textOf(h[1]);
  const after = src.slice(h.index + h[0].length);
  let paragraph = "";
  for (const m of after.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = textOf(m[1]).replace(/^#+\s*/, "");
    if (t) { paragraph = t; break; }
  }
  if (!headline) return null;
  return { headline, paragraph: clip(paragraph, max) };
}

// ── THE WORLDKEEPER'S CARD: LAST BLESSED, NEXT CROSSING ──────────────────────

const HOUR = 3_600_000;

/**
 * The Worldkeeper's line, from GET /api/world/settlements: the last blessing
 * (its settlement number and when) and when the next is expected.
 *
 * THE NEXT ONE IS READ OFF THE RECORD, NOT A CLOCK THIS SITE KEEPS. The office
 * serves the recent settlements with their dates; the gap between the last two
 * is the cadence the town is actually keeping (12 hours today), and the next
 * is the last plus that gap. No gap to read (one settlement, or none) is no
 * "next" line — never a guessed one.
 */
export function settlementWindow(body) {
  const cur = body?.current;
  const n = Number.isInteger(cur?.n) ? cur.n : null;
  const at = Date.parse(String(cur?.date ?? ""));
  if (n === null || !Number.isFinite(at)) return null;
  const recent = (Array.isArray(body?.recent) ? body.recent : [])
    .map((r) => ({ n: r?.n, t: Date.parse(String(r?.date ?? "")) }))
    .filter((r) => Number.isInteger(r.n) && Number.isFinite(r.t))
    .sort((a, b) => b.n - a.n);
  const prev = recent.find((r) => r.n === n - 1);
  const gap = prev ? at - prev.t : null;
  // a gap outside 1..48 hours is not a cadence, it is an outage or a replay
  const next = gap && gap >= HOUR && gap <= 48 * HOUR
    ? new Date(Math.round((at + gap) / HOUR) * HOUR).toISOString()
    : null;
  return { n, blessedAt: new Date(at).toISOString(), next };
}

// ── THE MEEPLINGS' BENCH ─────────────────────────────────────────────────────

/**
 * The sentinel's public board carries a live heartbeat for SOME units — the
 * probes below watch these by name. Every other unit's heartbeat is on the box
 * and not published; its row says so and shows the allowance the manifest
 * gives it, never a pretended beat.
 */
export const HEARTBEAT_PROBES = {
  "postmark-usdc-watch.timer": "usdc_watch",
  "postmark-stripe-watch.timer": "stripe_watch",
  "postmark-site-refresh.timer": "site_refresh",
  "postmark-office.service": "office_api",
};

/** The site sentinel's own beat is the board's `generated_at`. */
export const SENTINEL_UNIT = "postmark-site-sentinel.timer";

/** "every 13 h" / "every 45 min" — the manifest's allowance, in a reader's units. */
export function allowancePhrase(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 120) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/**
 * The bench, from the ingest's rollcall.json: one row per unit, in the
 * manifest's own order, with its label, cadence and stage. A parked unit stays
 * on the bench, marked parked — it is on the roll-call, and a bench that hid
 * it would be a roll-call that lies by omission.
 */
export function bench(rollcall) {
  const units = Array.isArray(rollcall?.units) ? rollcall.units : [];
  return units.map((u) => ({
    unit: u.unit,
    label: u.label,
    cadence: u.cadence ?? null,
    parked: u.stage === "parked",
    allowance: allowancePhrase(u.heartbeat?.stale_after_minutes),
    alwaysOn: u.heartbeat?.kind === "unit_active",
    probe: HEARTBEAT_PROBES[u.unit] ?? (u.unit === SENTINEL_UNIT ? "__board" : null),
  }));
}

/**
 * A live heartbeat for one bench row, from the sentinel's published board, or
 * null when the board does not watch that unit. `verdict` is the sentinel's
 * own word; `text` is its own reason, as text.
 */
export function heartbeatFor(row, board, nowMs = Date.now()) {
  if (!row?.probe || !board || typeof board !== "object") return null;
  if (row.probe === "__board") {
    const t = Date.parse(String(board.generated_at ?? ""));
    if (!Number.isFinite(t)) return null;
    const min = Math.max(0, Math.round((nowMs - t) / 60_000));
    return { verdict: "OK", text: min < 2 ? "ticked just now" : `ticked ${min} min ago` };
  }
  const p = (Array.isArray(board.probes) ? board.probes : []).find((x) => x?.key === row.probe);
  if (!p) return null;
  return { verdict: String(p.verdict ?? ""), text: clip(textOf(p.reason ?? ""), 90) };
}
