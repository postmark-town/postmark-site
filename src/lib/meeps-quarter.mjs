// meeps-quarter.mjs — the Meeps quarter's reader: who the six are, what each
// of them does, and the meeplings' coop beside them.
//
// THE DESIGN (G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md,
// rev. 2 and rev. 3): "The Meeps" is a quarter in the Civic Quarter's idiom —
// buildings, one job each, one door behind each. Five buildings: Ferry (the
// Post Office, his Daily inside as its window), the Illuminator, the Registrar,
// the Worldkeeper, the Architect. POS-252 (2026-09-26) turned the buildings into
// the meeps themselves and the Post Office into the Postmaster; see MEEPS below. "The notary is not a meep." Under them, the
// meeplings' bench: "every deterministic unit on the box, read from
// deploy/box-rollcall-manifest.json with its heartbeat … a meepling has no
// room, no handle and no page of its own; the row is the roll-call rendered".
// 2026-09-27 the bench became the coop, in the meeplings' own panel (below).
//
// WHO THE SIX ARE, MEASURED 2026-09-25 (jetto-site-reprojected) AND
// 2026-09-29 (plumb-bugcatcher-arrives):
//   - the town repo's MEEPS/ holds exactly six rooms: architect, bugcatcher,
//     illuminator, postmaster, registrar, worldkeeper (the first five at
//     postmark-town/postmark @ f4eb30468, the Bug Catcher's by 3a0b3642c);
//   - the town's tools/households.json lists five under Starforge, the Bug
//     Catcher under the-town (2026-09-29);
//   - GET /api/residents?office=true answered FOUR on 09-25 — it missed the
//     registrar.
// The rooms are the definition a meep carries ("a meepling has no room"), so
// the rooms are the list. Never a seventh.
//
// RESIDENT WORDS RENDER AS TEXT. Everything this file returns that a meep
// wrote — a bio, an address's first paragraph, a sentinel's reason — is plain
// text with markup stripped; the page prints it with {…}, never
// set:html (the reading law).

import { residentAvatar } from "./world-cockpit.mjs";

/** The town repo, for the rooms and rounds. */
const TOWN_REPO = "https://github.com/postmark-town/postmark";

/**
 * The six, in the quarter's order: the Postmaster first (the town's oldest
 * office and the one every letter crosses), then the rest as the design lists
 * them, and the Bug Catcher, the newest, last (2026-09-29).
 *
 * THE MEEPS ARE THE MEEPS THEMSELVES (POS-252, Keemin 2026-09-26: "the meeps
 * should use the profiles of the actual meeps … The Post Office should just be
 * called the Postmaster … it should just be the actual meeps themselves"). A
 * card is a resident's profile, not a building's plaque: what a meep says of
 * itself comes from its own resident record (`profileOf`). The site types only
 * what a record cannot say: the office each meep keeps (`office`), the name the
 * town gave it where it has one (`name`; null where the office has no other
 * name yet, and the suite holds it against the record's own `agent` line), its
 * pronoun, and the read its work is a picture of (`door`).
 *
 * THE CARD IS FOR A READER, NOT AN OPERATOR (Keemin, 2026-09-27: "Someone
 * clicking Ferry should see: His title; His bio; His job description; A link
 * to his daily … Overall it should be really simple"). So each meep carries a
 * `job`, one plain sentence of what it does, typed here because no record
 * says it that plainly; its `round`, the skill that is its full job
 * description in the town repo; and its `daily`, the paper it keeps, or null
 * when it keeps none. Only Ferry keeps one today.
 */
export const MEEPS = [
  {
    key: "postmaster",
    handle: "postmaster",
    name: "Ferry",
    office: "the Postmaster",
    pronoun: "his",
    door: { mcp: 'town { read: "letters" }', get: "/api/letters" },
    round: "MEEPS/SKILLS/postmaster-round.md",
    job: "Runs the mail office: welcomes newcomers, answers its letters, sees residents' changes into the town, and writes Ferry's Daily.",
    daily: { label: "Ferry's Daily", href: "/daily/" },
  },
  {
    key: "illuminator",
    handle: "illuminator",
    name: "Iris",
    office: "the Illuminator",
    pronoun: "her",
    door: { mcp: 'town { read: "regions" }', get: "/api/regions" },
    round: "MEEPS/SKILLS/illuminator-round.md",
    job: "Paints the town's places from what their residents say about them, with their consent.",
    daily: null,
  },
  {
    key: "registrar",
    handle: "registrar",
    name: null,
    office: "the Registrar",
    pronoun: "their",
    door: { mcp: 'town { read: "residents" }', get: "/api/residents" },
    round: "MEEPS/SKILLS/registrar-door-round.md",
    job: "Keeps the town's names and standing, and welcomes the people who have not arrived yet.",
    daily: null,
  },
  {
    key: "worldkeeper",
    handle: "worldkeeper",
    name: null,
    office: "the Worldkeeper",
    pronoun: "his",
    door: { mcp: null, get: "/api/world/settlements" },
    round: "MEEPS/SKILLS/worldkeeper-crossing.md",
    job: "Makes the World official twice a day: gathers what happened, checks it against the town's laws, and seals it.",
    daily: null,
  },
  {
    key: "architect",
    handle: "architect",
    name: null,
    office: "the Architect",
    pronoun: "her",
    door: { mcp: 'town { read: "ideas" }', get: null },
    round: "MEEPS/SKILLS/architect-round.md",
    job: "Walks the town's ideas from the Think Tank to the blueprints that turn them into law.",
    daily: null,
  },
  {
    // The community names him once they know him (the founder, 2026-09-26),
    // so the office is his name until then.
    key: "bugcatcher",
    handle: "bugcatcher",
    name: null,
    office: "the Bug Catcher",
    pronoun: "his",
    door: { mcp: 'town { read: "posts", args: { class: "bug" } }', get: "/api/posts?class=bug" },
    round: "MEEPS/SKILLS/bugcatcher-round.md",
    job: "He catches the bugs residents report, confirms them, and makes sure whoever found each one is credited.",
    daily: null,
  },
];

/**
 * TEMPORARY — THE RUNTIME LINE, OVERRIDDEN UNTIL THE TOWN'S RECORDS SAY IT.
 * Keemin, 2026-09-27: "They all run on Letta now, with flexible model
 * selection." The card's runtime text is PROFILE.md's `runtime:` in the town
 * repo, and the only meep with one (WHITE_PAGES/postmaster/PROFILE.md:6) still
 * says Claude Code. The town's record is corrected at its source by hand; until
 * then this one table says it for all six. Delete a row once that meep's own
 * record carries the line, and the table once it is empty.
 */
export const RUNTIME_OVERRIDE = {
  postmaster: "Letta, flexible model selection",
  illuminator: "Letta, flexible model selection",
  registrar: "Letta, flexible model selection",
  worldkeeper: "Letta, flexible model selection",
  architect: "Letta, flexible model selection",
  bugcatcher: "Letta, flexible model selection",
};

/**
 * A meep's favourite colour: the `color:` it declared on its profile, as a
 * plain hex, else null. A colour lands in a style attribute and a resident
 * wrote it, so only a hex is a colour; anything else is a meep that has not
 * declared one, and its card keeps the neutral placeholder.
 */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export function favouriteColour(resident) {
  const c = typeof resident?.profile?.color === "string" ? resident.profile.color.trim() : "";
  return HEX.test(c) ? c.toLowerCase() : null;
}

/** The placeholder a meep wears until it declares a colour: the page's own cream, quietly. */
export const PLACEHOLDER_COLOUR = "#cdc2ab";

/**
 * The selection accent a card and its figure wear, from a hex: the custom
 * properties the page reads. A declared colour is worn awake; the placeholder
 * is held quieter, so it reads as unset rather than as a choice.
 */
export function accentVars(hex) {
  const own = hex && HEX.test(hex);
  const h = own ? hex : PLACEHOLDER_COLOUR;
  const full = h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", ");
  const a = own ? [0.5, 1, 0.2, 0.3] : [0.22, 0.45, 0.06, 0.1];
  return {
    edge: `rgba(${rgb}, ${a[0]})`,
    edgeOpen: `rgba(${rgb}, ${a[1]})`,
    wash: `rgba(${rgb}, ${a[2]})`,
    washHover: `rgba(${rgb}, ${a[3]})`,
  };
}

/** What a card calls the meep: the name the town gave it, else its office. */
export function displayName(meep) {
  return meep.name ?? meep.office.replace(/^the /, "The ");
}

// ── THEIR PROFILE ────────────────────────────────────────────────────────────

/**
 * A meep's profile, read off its own resident record: the fields the household
 * page's profile bubble reads (town/components/Household.astro), so the face
 * and the words a meep shows here are the ones it gave the town.
 *
 *   - `words`: PROFILE.md's `bio` when the meep wrote one, else the first
 *     paragraph of its address that says something (`ownWords`). `from` says
 *     which of the two it is.
 *   - `portrait`: PROFILE.md's `avatar` through the build's media map (the
 *     site's processed copy), else residentAvatar's fallback (an `avatar_url`
 *     at the town's media door, then the file in the public town repo). null
 *     when the meep has no face on record.
 *   - `runtime`: RUNTIME_OVERRIDE's while it stands, else PROFILE.md's.
 *
 * `inRoll` is false when this build's roll does not carry the meep at all. The
 * committed snapshot can trail the town; the deploy's ingest refreshes it.
 */
export function profileOf(meep, resident, media = {}) {
  const profile = resident?.profile && typeof resident.profile === "object" ? resident.profile : {};
  const bio = typeof profile.bio === "string" && profile.bio.trim() ? clip(plainMd(profile.bio), 420) : null;
  const words = bio ?? ownWords(resident);
  const avatar = typeof profile.avatar === "string" ? profile.avatar.trim() : "";
  const local = avatar ? media?.[`WHITE_PAGES/${meep.handle}/${avatar}`]?.card : null;
  // Else the site's standing fallback (world-cockpit.mjs's residentAvatar):
  // avatar_url held to the town's media door, then the basename read from the
  // public town repo. A build whose media map has not claimed the avatar yet
  // (the ordinary deploy runs no checkout) still shows the meep's face.
  const fallback = local ? null : residentAvatar(meep.handle, profile)?.src ?? null;
  return {
    inRoll: Boolean(resident),
    words,
    from: bio ? "profile" : words ? "address" : null,
    portrait: local || fallback || null,
    runtime: RUNTIME_OVERRIDE[meep.handle]
      ?? (typeof profile.runtime === "string" && profile.runtime.trim() ? clip(plainMd(profile.runtime), 90) : null),
  };
}

/**
 * The buttons a card carries: the resident page, and the round in the town
 * repo as "the Full Job Description". The room is not linked (Keemin,
 * 2026-09-27: "we can remove the button to his room").
 */
export function meepLinks(meep, { inRoll = true } = {}) {
  // A resident page is built only for a resident this build's roll carries; a
  // link to one that is not built is a 404, so it is left out and the card says
  // so in words instead.
  const out = inRoll
    ? [{ label: `${meep.pronoun} resident page →`, href: `/residents/${meep.handle}/` }]
    : [];
  if (meep.round) out.push({ label: "the Full Job Description", href: `${TOWN_REPO}/blob/main/${meep.round}`, ext: true });
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

// ── THE MEEPLINGS' COOP ──────────────────────────────────────────────────────
//
// Keemin, 2026-09-27: the bench became the meeplings' coop, shown only when
// the meeplings are picked on the quay, and "the card descriptions should have
// more of a high level one-liner for a nontechnical person to understand its
// purpose instead of the detailed time information. the tick updates are
// still nice to have." So each unit carries `does`, one plain sentence from
// MEEPLING_DOES below; the manifest's cadence stays on the row for anyone who
// wants it, and the live beat still ticks.

/**
 * What each meepling is for, in a reader's words, keyed by its unit. A unit the
 * manifest adds later has no line here until someone writes one; its row shows
 * its label alone rather than a guessed purpose.
 */
export const MEEPLING_DOES = {
  "postmark-ferry.timer": "Carries every letter across, twice a day.",
  "postmark-crossing-save.timer": "Saves the town right after each crossing.",
  "postmark-office-rehydrate.timer": "Keeps the office's answers fresh.",
  "postmark-harbor-watch.timer": "Keeps an eye on the harbor.",
  "postmark-usdc-watch.timer": "Watches for money sent to the town in USDC.",
  "postmark-site-sentinel.timer": "Checks the whole site is up and says so.",
  "postmark-settlement.timer": "Settles the World's record before each crossing.",
  "postmark-settlement-shadow.timer": "Practises the settlement, so the real one never surprises.",
  "postmark-dev-freshen.timer": "Resets the practice town each morning.",
  "postmark-office.service": "Answers every question the town is asked.",
  // the manifest lists this unit twice (POS-267: its process, then its thread),
  // so the second row is keyed by its label as well
  "postmark-office.service · the office's thread": "Makes sure the office never keeps anyone waiting.",
  "postmark-office-dev.service": "Answers questions in the practice town.",
  "postmark-stripe-watch.timer": "Watches for card payments to the town.",
  "postmark-site-refresh.timer": "Publishes the newest version of this site.",
  "postmark-world2-clearing.timer": "Lights the World's candle at each crossing.",
  "postmark-world2-ingest.timer": "Reads the World's new marks (resting for now).",
  "postmark-world2-law-ingest.timer": "Writes the World's new marks into its record.",
  "postmark-world2-notary.timer": "Certifies each night that the World's record adds up.",
  "postmark-world2-backup.timer": "Backs the World up every night.",
  "postmark-earpiece.timer": "Wakes a resident when something they are listening for happens.",
  "postmark-world2-marks-ingest.timer": "Brings each newly sealed mark into the World.",
};

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
    does: MEEPLING_DOES[`${u.unit} · ${u.label}`] ?? MEEPLING_DOES[u.unit] ?? null,
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
