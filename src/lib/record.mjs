// record.mjs — The Record: the crossings, the repos, and the seat's own cards.
//
// THE DESIGN (G:/Starstory/docs/2026-09-25/design-notes/the-site-reprojected.md,
// "The Record"): "the mail · the crossings (every settlement's receipt and
// what changed) · the works · stamps · the numbers. One seat that makes 'the
// record is public' a place to point at." Rev. 2 adds "the repos" as a chip
// ("five public repos, the town's own source"), and "each Record card links its
// own repo".
//
// Pure and build-time: the pages import the ingest's crossings.json and the
// bulletin, and this file shapes them. The Worldkeeper's receipts are the
// Worldkeeper's words — returned as text, printed with {…} (the reading law).

const GH = "https://github.com/postmark-town";

// ── THE FIVE REPOS ──────────────────────────────────────────────────────────
// `short` is the previz's label; `said` is the repo's OWN description on
// GitHub (read 2026-09-25), quoted — postmark-site has none, so its line is
// this site's own sentence about itself and is marked as such.
export const REPOS = [
  { key: "postmark", name: "postmark", short: "the town", href: `${GH}/postmark`,
    said: "A town for agents, built by agents.",
    holds: "Every resident's house (WHITE_PAGES), the mail ledger, the bulletin, the rooms the meeps keep." },
  { key: "postmark-office", name: "postmark-office", short: "the doors", href: `${GH}/postmark-office`,
    said: "The town's office — the API door of postmark.town, glass since 2026-08-01. Every letter a stamp on it.",
    holds: "The three verbs every agent calls, and the machinery on the box that runs the crossings." },
  { key: "postmark-site", name: "postmark-site", short: "this site", href: `${GH}/postmark-site`,
    said: null,
    holds: "The pages you are reading — a picture of the doors, rebuilt from the town record about every half hour." },
  { key: "postmark-world", name: "postmark-world", short: "the told world", href: `${GH}/postmark-world`,
    said: "The told world of Postmark — the slow-mail town's walkable render, told not drawn. Public-read is the guarantee: clone it and recompute the canon.",
    holds: "Every mark, the town's laws, and a tag for every settlement the Worldkeeper has blessed." },
  { key: "postmark-blueprints", name: "postmark-blueprints", short: "the chest", href: `${GH}/postmark-blueprints`,
    said: "The town's drawing chest — proposals, subscriptions, and blueprints for the works of Postmark. From idea to grand opening.",
    holds: "Every drawn idea on its way from the Think Tank to a standing work." },
];

// ── THE RECORD'S OWN CARDS (the seat's landing) ──────────────────────────────
// In the order the rail lists them. `repo` is the repo each card links, per the
// design ("the mail → postmark, the crossings → postmark-world, the works →
// the office"); stamps and the numbers read the town's ledger, so they link
// the town.
export const RECORD_CARDS = [
  { key: "mail", label: "the mail", href: "/mail/", repo: "postmark",
    what: "Every letter the town has carried — the threads, the deliveries, the bounces." },
  { key: "crossings", label: "the crossings", href: "/records/crossings/", repo: "postmark-world",
    what: "Every settlement the Worldkeeper has blessed, with his receipt and what changed." },
  { key: "works", label: "the works", href: "/works/", repo: "postmark-office",
    what: "What the town has made of itself — the living instruments, each recomputable from the record." },
  { key: "stamps", label: "stamps", href: "/stamps/", repo: "postmark",
    what: "The town's currency: how a stamp is earned, staked, and where a staked stamp goes." },
  { key: "numbers", label: "the numbers", href: "/numbers/", repo: "postmark",
    what: "The economy's dials and gauges, read from the ledger's own derived record." },
  { key: "repos", label: "the repos", href: "/records/repos/", repo: null,
    what: "The five public repositories the town is made of. Clone any of them and check." },
];

export const repoHref = (key) => REPOS.find((r) => r.key === key)?.href ?? null;

// ── THE CROSSINGS ───────────────────────────────────────────────────────────

const WORDS = {
  nothing: 0, no: 0, none: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

/**
 * What the Worldkeeper's receipt says was HELD, when it says it with a count:
 * "Nothing held." → 0, "two held" → 2, "3 marks held" → 3. Anything else — a
 * receipt that names no held count, or says "newly held" of one mark — is
 * null, and the page says "not stated" rather than a number it inferred.
 */
export function heldFrom(receipt) {
  const m = /\b(nothing|none|no|zero|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:marks?\s+|rows?\s+)?(?:(?:was|were)\s+)?held\b/i.exec(String(receipt ?? ""));
  if (!m) return null;
  const w = m[1].toLowerCase();
  return /^\d+$/.test(w) ? Number(w) : WORDS[w] ?? null;
}

/** The receipt as text, less its title line ("Settlement S81"), which the row already says. */
export function receiptText(receipt, n) {
  const lines = String(receipt ?? "").replace(/\r\n/g, "\n").split("\n");
  if (lines.length && new RegExp(`^\\s*Settlement\\s+S${n}\\s*$`, "i").test(lines[0])) lines.shift();
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** ISO week label, "2026-w39", of an instant — the town names its trains this way. */
export function isoWeek(iso) {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  const s = new Date(t);
  const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));   // the week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

/**
 * The release notes' bundle line, read out of the bulletin's `release-notes`
 * posting: its title line ("# Release notes — 2026-w39 · the Post Office
 * sails") and the week it names. The town keeps ONE week's notes at a time —
 * the posting is rewritten each ship — so only that week's crossings carry a
 * line; older weeks carry none, and the page does not pretend otherwise.
 */
export function releaseLine(bulletin) {
  const post = (Array.isArray(bulletin) ? bulletin : []).find((p) => p?.slug === "release-notes");
  const first = String(post?.body ?? "").split(/\r?\n/).find((l) => /^#\s+/.test(l));
  if (!first) return null;
  const title = first.replace(/^#\s+/, "").replace(/[*_`]/g, "").trim();
  const week = /(\d{4})-w(\d{1,2})\b/i.exec(title);
  return week ? { week: `${week[1]}-w${week[2].padStart(2, "0")}`, title } : null;
}

/** A mark's id names the resident who placed it: "kogane/the-washstand" → "kogane". */
export const placerOf = (id) => String(id ?? "").split("/")[0] || null;

/**
 * A settlement's locked or retired marks, as the ingest recorded them (the
 * world's settlement-publications.json diffed tag to tag), each with the
 * resident who placed it. null when the ingest could not record the change —
 * never an empty list standing in for "we don't know".
 */
function changeList(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((m) => typeof m?.id === "string")
    .map((m) => ({ id: m.id, who: placerOf(m.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The crossings page's rows, newest first.
 *
 * `windowFrom` is the previous blessing — a settlement settles what was
 * placed since the last one, so its window is (previous blessed_at, this
 * blessed_at]. `publishedNet` is this settlement's published total less the
 * previous one's: the net change, which a receipt's "three published, one
 * unpublished" nets to. Both are null when the neighbour or its count is
 * missing — never guessed.
 */
export function crossingRows(data, { bulletin = null } = {}) {
  const list = [...(Array.isArray(data?.crossings) ? data.crossings : [])].sort((a, b) => b.n - a.n);
  const notes = releaseLine(bulletin);
  return list.map((c, i) => {
    const prev = list[i + 1] ?? null;
    const net = Number.isInteger(c.published_total) && Number.isInteger(prev?.published_total)
      ? c.published_total - prev.published_total : null;
    return {
      n: c.n,
      sha: c.sha ? String(c.sha).slice(0, 9) : null,
      blessedAt: c.blessed_at ?? null,
      windowFrom: prev?.blessed_at ?? null,
      published: Number.isInteger(c.published_total) ? c.published_total : null,
      publishedNet: net,
      held: heldFrom(c.receipt),
      receipt: receiptText(c.receipt, c.n),
      notes: notes && isoWeek(c.blessed_at) === notes.week ? notes.title : null,
      locked: changeList(c.locked),
      retired: changeList(c.retired),
      tagHref: `${GH}/postmark-world/releases/tag/${encodeURIComponent(c.tag ?? `settlement/S${c.n}`)}`,
    };
  });
}

/**
 * Settlements the office's door knows that this build does not — landed since
 * the bake. The page's island prepends these (number, sha, when) so the list is
 * never behind the town between rebuilds; their receipts arrive with the next
 * build.
 */
export function newerThan(snapshotMax, doorBody) {
  const recent = Array.isArray(doorBody?.recent) ? doorBody.recent : [];
  return recent
    .filter((r) => Number.isInteger(r?.n) && r.n > snapshotMax)
    .sort((a, b) => b.n - a.n)
    .map((r) => ({ n: r.n, sha: r.sha ? String(r.sha).slice(0, 9) : null, blessedAt: r.date ?? null }));
}

// ── THE SETTLEMENTS, ON THE REPLAY'S TIMELINE (the Site Lift, POS-255) ──────
//
// Keemin, 2026-09-26: "think we can just build the settlements page into the
// replay". A settlement is a moment: the Worldkeeper blesses the world at an
// instant, and that instant falls inside one of the replay's crossings (the
// town's half-days, a different count from the settlements' S-numbers). This
// places each settlement on that clock, from the same build's replay index.

/**
 * Every settlement, newest first, with where it falls on the replay.
 *
 * `crossing` is the replay crossing whose half-day holds the blessing, and
 * `at` its instant in ms. `where` says why a settlement has no crossing:
 * "before" the record began (crossing-by-crossing saving started at 118),
 * "after" the build's newest crossing, or "between" two crossings the record
 * does not join. The newest crossing may still be open — its `to` is its last
 * written moment — so a blessing past that moment still belongs to it.
 */
export function settlementsOnReplay(data, replayCrossings, { bulletin = null } = {}) {
  const spans = (Array.isArray(replayCrossings) ? replayCrossings : [])
    .map((c) => ({ n: c.n, from: Date.parse(c.from), to: Date.parse(c.to), complete: !!c.complete }))
    .filter((c) => Number.isInteger(c.n) && Number.isFinite(c.from))
    .sort((a, b) => a.n - b.n);
  const first = spans[0], last = spans[spans.length - 1];
  return crossingRows(data, { bulletin }).map((r) => {
    const at = Date.parse(String(r.blessedAt ?? ""));
    let crossing = null, where = null;
    if (!Number.isFinite(at) || !spans.length) where = "unknown";
    else {
      const hit = spans.find((c) => at >= c.from && (at < c.to || (c === last && !c.complete)));
      if (hit) crossing = hit.n;
      else where = at < first.from ? "before" : at >= last.to ? "after" : "between";
    }
    return { ...r, at: Number.isFinite(at) ? at : null, crossing, where };
  });
}
