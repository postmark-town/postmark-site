// bug-strip.mjs — the bug lane as a comic strip under the Bug Catcher's card,
// and the open-bugs board beside it.
//
// Keemin, 2026-09-29: "put the 'page' in the meeps page, under the Bugcatcher,
// with a nice visual comic-book like explanation of the process, with
// clickable bubbles for more detailed info." (Brief:
// G:/Starstory/docs/2026-09-29/rail/briefs/bugcatcher-strip.md, POS-236.)
//
// SEVEN PANELS, ONE PICTURE PATH EACH. A panel's picture is `img` and nothing
// else, so a panel is repainted by replacing one file. The pictures are drawn
// in the page's own pixel kit (tools/bug-strip-art.mjs writes them from
// pixel-icons.mjs's inks; Keemin, 2026-09-29: "pixel is fine").
//
// EVERY NUMBER IS TYPED ONCE, HERE. The ladder and the cap are the office's
// (postmark-office src/bugs.mjs, BUG_LADDER and CONFIRMED_CAP, as of
// train/2026-w41, where the file last changed at c222fa1); the site cannot
// import the office, so LADDER is
// a copy and test/bug-strip.test.mjs pins it against a fixture of that file.
// Captions and bubbles read their amounts from LADDER, never from a literal.
//
// THE BUGS ARE LIVE. The browser reads the office's bug posts
// (GET /api/posts?class=bug, public and keyless: server.mjs § "GET /posts?
// class=…", "public and keyless") and `cardsOf` folds the answer into one
// card per bug (§ THE CARDS; until POS-547 a jar and a board, folded apart).
// What a resident wrote (a title, a critter's name) is returned as a string
// for textContent, never markup (the reading law). A read that failed says
// so; it never reads as an empty jar.

import { MEEPS } from "./meeps-quarter.mjs";
import { mailPagerItems } from "./mail.mjs";

/** The flat ladder, a copy of the office's BUG_LADDER. */
export const LADDER = Object.freeze({
  confirmed: Object.freeze({ n: 2 }),
  reproduced: Object.freeze({ n: 3 }),
  diagnosed: Object.freeze({ n: 5 }),
  briefed: Object.freeze({ by: "grade", n: Object.freeze({ light: 10, heavy: 5 }) }),
  fixed: Object.freeze({ by: "size", n: Object.freeze({ S: 10, M: 25, L: 50 }) }),
});

/** Paid `confirmed` stages per household per week (the office's CONFIRMED_CAP). */
export const CONFIRMED_CAP = 3;

/** The lifecycle, in order, and the states a bug is finished in (office BUG_STAGES, BUG_FINISHED). */
export const STAGES = Object.freeze(["reported", "confirmed", "reproduced", "diagnosed", "briefed", "fixed", "shipped"]);
export const FINISHED = Object.freeze(["shipped", "duplicate", "not-a-bug"]);

const TOWN_REPO = "https://github.com/postmark-town/postmark";
/** A new issue on the town repo: the "Report a bug" button and panel 2's second road. */
export const NEW_ISSUE_URL = `${TOWN_REPO}/issues/new`;
/**
 * The strip as a one-minute video (Keemin, 2026-09-29: "watchable/embedded in
 * the actual site, above the static cards"). Click to play: the page shows the
 * thumbnail as a plain link to VIDEO_URL, and only a click swaps in the player
 * from YouTube's privacy-enhanced domain. Nothing from YouTube loads before it.
 */
export const VIDEO_URL = "https://youtu.be/U7J0en2iBeg";
/** The video's picture: its own thumbnail, scaled nearest-neighbour to 640×360. */
export const VIDEO_THUMB = "/meeps/bug-strip/video-thumb.png";
/** The player a click swaps in, derived from VIDEO_URL so the address is typed once. */
export const VIDEO_EMBED = `https://www.youtube-nocookie.com/embed/${VIDEO_URL.split("/").pop()}?autoplay=1&rel=0`;
export const VIDEO_TITLE = "How a bug gets caught in Postmark";

/**
 * The click: replaces the play box (the link) with the player, at the box's
 * 16:9 size, keeping the words under it. Built with createElement only.
 */
export function playVideo(box, doc = globalThis.document) {
  const player = doc.createElement("div");
  player.className = "bs-player is-playing";
  const frame = doc.createElement("iframe");
  frame.className = "bs-player-iframe";
  frame.src = VIDEO_EMBED;
  frame.title = VIDEO_TITLE;
  frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
  frame.setAttribute("allowfullscreen", "");
  frame.setAttribute("loading", "eager");
  const words = doc.createElement("span");
  words.className = "bs-player-words";
  words.textContent = `${VIDEO_TITLE} · 1 min`;
  player.append(frame, words);
  box.replaceWith(player);
  return player;
}
/** GitHub's private vulnerability report on the town repo. A security bug goes here, never the mail, never an issue. */
export const ADVISORY_URL = `${TOWN_REPO}/security/advisories/new`;
/** The call an agent makes to post a bug. */
export const POST_CALL = 'town { do: "post", args: { class: "bug", title, body } }';
/** The board's read. */
export const BOARD_PATH = "/posts?class=bug";

const L = LADDER;

/**
 * STAMPS ARE PURPLE (law, Keemin 2026-07-29; Keemin 2026-09-29: "use the stamp
 * purple font for the numbers and stamps"). So a text in the strip is a list
 * of SEGMENTS: plain strings, and `{ stamps }` for every stamp amount, which
 * the page renders as `<amount>✦` in the stamp family. `t` builds a list from
 * a template: an interpolated `S(…)` stays a stamp segment, anything else is
 * text. A count that is not stamps (the weekly cap) is plain text.
 */
export const S = (amount) => Object.freeze({ stamps: String(amount) });
export function t(strings, ...values) {
  const out = [];
  strings.forEach((s, i) => {
    if (s) out.push(s);
    if (i < values.length) {
      const v = values[i];
      if (v && typeof v === "object" && "stamps" in v) out.push(v);
      else if (String(v)) out.push(String(v));
    }
  });
  const merged = [];
  for (const seg of out) {
    if (typeof seg === "string" && typeof merged.at(-1) === "string") merged[merged.length - 1] += seg;
    else merged.push(seg);
  }
  return Object.freeze(merged);
}
/** A segment list (or a plain string) as the words a reader reads: a stamp amount as `<amount>✦`. */
export const plainOf = (x) => (typeof x === "string" ? x : x.map((s) => (typeof s === "string" ? s : `${s.stamps}✦`)).join(""));

/**
 * The seven panels. `caption` is the panel's one line, `scene` its picture's
 * alt text, `img` its one picture path, and `bubble` what the speech bubble
 * opens: `title` for the summary, then `lines`, with `links` ({ label, href })
 * and `call` (code) where a panel names a real road. Captions, titles and
 * lines are segment lists (`t`), so every stamp amount is marked as one.
 */
export const PANELS = Object.freeze([
  {
    n: 1,
    caption: t`Something's broken.`,
    scene: "A resident frowning at a glitching screen.",
    img: "/meeps/bug-strip/1-broken.svg",
    bubble: {
      title: t`What counts as a bug?`,
      lines: [
        t`Something in town that's wrong, and that anyone can check: a page that shows the wrong thing, a door that refuses what it should take, a letter that went astray.`,
        t`A new thing you wish the town had is an idea. Take it to the Think Tank. A question is just a question: ask it.`,
      ],
    },
  },
  {
    n: 2,
    caption: t`Tell the Bug Catcher.`,
    scene: "Three arrows flying toward the Bug Catcher's net.",
    img: "/meeps/bug-strip/2-tell.svg",
    bubble: {
      title: t`Three roads, and one locked door`,
      lines: [
        t`Your agent can post the bug itself:`,
        t`Or open a GitHub issue on the town's repo, or write a letter to bugcatcher. All three reach him.`,
      ],
      call: POST_CALL,
      links: [
        { label: "Open a GitHub issue", href: NEW_ISSUE_URL },
      ],
      locked: {
        title: "A security bug takes the locked door.",
        text: "Anything that would let someone read what isn't theirs, act as someone else, or take stamps goes through GitHub's private \"Report a vulnerability\". Only the founders see it. Never put it in a letter (the mail is public), and never in an issue.",
        link: { label: "Report a vulnerability", href: ADVISORY_URL },
      },
    },
  },
  {
    n: 3,
    caption: t`Spotted! ${S(`+${L.confirmed.n}`)}`,
    scene: "The bug on its letter, under the Bug Catcher's magnifying glass.",
    img: "/meeps/bug-strip/3-spotted.svg",
    art: "spotted",
    bubble: {
      title: t`Confirmed: ${S(L.confirmed.n)} to the reporter`,
      lines: [
        t`He looks for a duplicate first, then checks the bug against the public record. The first reporter keeps the credit.`,
        t`A household is paid for ${CONFIRMED_CAP} confirmed reports a week. A fourth is still spotted and credited, and pays nothing that week.`,
      ],
    },
  },
  {
    n: 4,
    caption: t`Show me. ${S(`+${L.reproduced.n}`)}`,
    scene: "A hand pointing at a numbered list of steps.",
    img: "/meeps/bug-strip/4-steps.svg",
    bubble: {
      title: t`Reproduced: ${S(L.reproduced.n)}`,
      lines: [
        t`Whoever gives the exact steps that make it happen again is credited, whether or not it was their bug.`,
      ],
    },
  },
  {
    n: 5,
    caption: t`Why it broke, and how to fix it. ${S(`+${L.diagnosed.n}`)} · ${S(`+${L.briefed.n.light}`)}`,
    scene: "A magnifying glass over the fault, then a drawn plan.",
    img: "/meeps/bug-strip/5-cause.svg",
    bubble: {
      title: t`Diagnosed: ${S(L.diagnosed.n)} · Fix brief: ${S(L.briefed.n.light)}`,
      lines: [
        t`Naming the cause pays ${S(L.diagnosed.n)}.`,
        t`A fix brief on the bug's GitHub issue pays ${S(L.briefed.n.light)}, or ${S(L.briefed.n.heavy)} if it needed heavy revision. Briefs are public, and anyone may write one.`,
      ],
    },
  },
  {
    n: 6,
    caption: t`Fixed, and named! ${S(`+${L.fixed.n.S}`)} / ${S(L.fixed.n.M)} / ${S(L.fixed.n.L)}`,
    scene: "A wall with a patch where the crack was.",
    img: "/meeps/bug-strip/6-fixed.svg",
    bubble: {
      title: t`Fixed: ${S(L.fixed.n.S)}, ${S(L.fixed.n.M)} or ${S(L.fixed.n.L)} by size`,
      lines: [
        t`A pull request built against the brief and merged pays by the fix's size: ${S(L.fixed.n.S)} for small, ${S(L.fixed.n.M)} for medium, ${S(L.fixed.n.L)} for large. Then it ships with the town.`,
        t`…and whoever fixes it names the bug: it joins the Bug Catcher's jar.`,
      ],
    },
  },
  {
    n: 7,
    caption: t`The stamps arrive.`,
    scene: "An envelope with stamps spilling out.",
    img: "/meeps/bug-strip/7-stamps.svg",
    bubble: {
      title: t`Paid by the founders`,
      lines: [
        t`The founders review each stage and pay it, a little after it happens.`,
        t`Meeps never take stamps. The credit is always the resident's.`,
      ],
    },
  },
]);

// ── THE JAR ──────────────────────────────────────────────────────────────────
//
// Keemin, 2026-09-29: the fixer names the bug, and it joins the Bug Catcher's
// jar. An OPEN bug (not yet fixed) is a silhouette with "?". A FINISHED one
// (fixed or shipped) is the lit jar with the name its fixer gave it
// (fields.critter) and who named it (fields.named_by: the resident credited
// with the fix, office events-store.mjs). Only open bugs are "?" (Wright's
// review, 2026-09-29). Since POS-547 every bug in the read is a card (§ THE
// CARDS), the side exits too, set aside under their own heading.
//
// THE LEGACY SHELF (POS-558, Darko 2026-10-10) supersedes the 09-29 review
// line that lit a finished bug with no name as "unnamed". A critter is named
// only at the advance to `fixed` (office bugs.mjs), so a bug that finished
// before names existed, or went straight to `shipped`, can never be named. It
// leaves the jar for its own shelf: "these bugs were spotted before the Bug
// Catcher was a thing and they are there to credit the residents who caught
// them." Its card credits the reporter by name, and "unnamed" is printed
// nowhere.

/** The jar's two pictures: a bug still loose, and a caught, finished one. */
export const JAR_ART = Object.freeze({
  open: "/meeps/bug-strip/jar-open.svg",
  finished: "/meeps/bug-strip/3-caught.svg",
});
const FINISHED_STATES = new Set(["fixed", "shipped"]);
const SIDE_EXITS = new Set(["duplicate", "not-a-bug"]);

// ── THE STAGES' NAMES ───────────────────────────────────────────────────────

const ISSUE_RE = /^https:\/\/github\.com\/postmark-town\/[A-Za-z0-9._-]+\/issues\/\d+$/;
const text = (v, max = 160) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
};

/**
 * What each open stage is called on the cards' headings. A confirmed bug is SPOTTED, never
 * "caught" (Keemin, 2026-09-29): a bug is caught when it is fixed and goes into
 * the jar. The strip's third panel says the same.
 */
export const STAGE_LABEL = Object.freeze({
  reported: "Reported",
  confirmed: "Spotted",
  reproduced: "Reproduced",
  diagnosed: "Diagnosed",
  briefed: "Briefed",
  fixed: "Fixed, shipping soon",
});

// ── THE CARDS (POS-547, Darko 2026-10-09) ────────────────────────────────────
//
// "One expandable card per bug. Clicking a bug shows what stage it's at, who
// contributed each earlier stage, and where the links lead." The cards take
// the place of the jar and the board, from the same read, which now carries
// each bug's `history` (postmark-office town-posts.mjs § A BUG CARRIES ITS
// HISTORY): one row per stage act, { stage, at, hand, credit, link,
// stamps_paid }.
//
// COLLAPSED, a card is the jar's slot as prod drew it, a squarish card in a
// grid (Darko, 2026-10-10, POS-558: "pretty much like the way the bug jars
// look on prod, where they have their own squarish, rectangularish cards"):
// the critter (its picked picture once revealed, the lit jar with the name its
// fixer gave it, or the "?" silhouette while it is loose), the title, the
// reporter and the stage. EXPANDED, it spans its whole row ("open them to fill
// that entire row with the information of the expanded version") and is the
// ladder, unchanged from POS-547: every stage of the main line, each reached
// one with who did it, when, its stamps and its link, the unreached ones dim;
// then the issue, the PR and the release. A side exit's ladder ends at its exit.
//
// THE PAGES (POS-558): the office's bug read pages (office town-posts.mjs §
// THE BUG READ PAGES: limit and offset in; total, shown, limit, offset,
// complete out), so the browser reads one page of PAGE_SIZE at a time and
// draws the site's numbered pager (mail.mjs § mailPagerItems, MailPager's
// look) under the cards. An office before POS-558 ignores the limit and sends
// every bug: that answer is one page, with no pager.
//
// THE ORDER is the office's, page after page, and since Wright's review of
// office#481 it is the jar's (office bugs.mjs § THE JAR'S ORDER): open bugs by
// the furthest stage first, then the finished with a name, then the legacy
// shelf, then the ones set aside. A page draws its groups in that order
// (CARD_GROUPS), so the pages read like the jar and the legacy shelf sits on
// the last pages. Its heading and line are drawn once, on the page where it
// begins; a later page heads it "continued" (cardsOf's legacyBefore).
//
// Everything a resident wrote reaches the page as text (textContent), and an
// href is only ever a URL on the town's own GitHub org.

/** The stage names on the ladder. A confirmed bug is Spotted (STAGE_LABEL's word). */
export const LADDER_LABEL = Object.freeze({
  reported: "Reported", confirmed: "Spotted", reproduced: "Reproduced", diagnosed: "Diagnosed",
  briefed: "Briefed", fixed: "Fixed", shipped: "Shipped", duplicate: "Duplicate", "not-a-bug": "Not a bug",
});
/** What a stage's link points at (office bugs.mjs § LINK_WHAT). */
export const LINK_LABEL = Object.freeze({ diagnosed: "the cause", briefed: "the brief", fixed: "the PR", shipped: "the release" });
const LINK_RE = /^https:\/\/github\.com\/postmark-town\/[A-Za-z0-9._-]+\/\S+$/;
/** A revealed critter's picture: the town's own media (office media.mjs). */
const MEDIA_RE = /^https:\/\/media\.postmark\.town\/\S+$/;

/** The legacy shelf's line (Darko, 2026-10-10, POS-558). */
export const LEGACY_LINE = "These bugs were spotted before the Bug Catcher's jar existed. They're here to credit the residents who caught them.";

/**
 * The card groups, in the office's order (§ THE ORDER): the open stages
 * furthest first, the shipped (named), the legacy shelf (the finished bugs
 * with no name, § THE JAR, whatever their state), the set aside last.
 */
export const CARD_GROUPS = Object.freeze([
  ...STAGES.filter((s) => s !== "shipped").reverse().map((s) => Object.freeze({ key: s, label: STAGE_LABEL[s], states: [s] })),
  Object.freeze({ key: "shipped", label: "Shipped", states: ["shipped"] }),
  Object.freeze({ key: "legacy", label: "Legacy bugs", states: ["fixed", "shipped"], note: LEGACY_LINE }),
  Object.freeze({ key: "set-aside", label: "Set aside", states: ["duplicate", "not-a-bug"] }),
]);
/** The legacy shelf's heading on a page after the one where it begins. */
export const LEGACY_CONTINUED = "Legacy bugs, continued";

/** A post on the legacy shelf: finished (fixed or shipped) with no name (§ THE JAR). */
export function isLegacyPost(p) {
  return Boolean(p && typeof p === "object" && FINISHED_STATES.has(p.state) && !text(p.fields?.critter, 40));
}

/** Bugs per page of the jar: four rows of prod's slots at desktop width. */
export const PAGE_SIZE = 24;
/** The read of one page: BOARD_PATH with its limit and offset. */
export const pagePath = (offset = 0, limit = PAGE_SIZE) => `${BOARD_PATH}&limit=${limit}&offset=${Math.max(0, Math.trunc(Number(offset) || 0))}`;

const dayOf = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(t)
    : "";
};
const linkOf = (v) => (typeof v === "string" && LINK_RE.test(v) ? v : null);
/**
 * A handle as the town knows its person. The founder's hand records as
 * `keemin` (office bugs.mjs § BUG_HANDS), and in town he is DARKO: the page
 * never prints the other name (Wright's review of #462, 2026-10-09).
 */
export const TOWN_NAMES = Object.freeze({ keemin: "Darko" });
const named = (h) => { const t = text(h, 40); return TOWN_NAMES[t] ?? t; };
const paidOf = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/**
 * One post's ladder: the main line, or the stages a side exit left from and
 * its exit. A reached stage is one with a history row, or one before the
 * bug's stage; one before it with no row was skipped, which only a read that
 * carries history can say. An office before POS-547 sends none, and every
 * bug's history holds at least its post, so an empty one is also unknown.
 */
const historyOf = (p) => (Array.isArray(p.history) && p.history.length ? p.history : null);
function ladderOf(p) {
  const known = Boolean(historyOf(p));
  const hist = new Map();
  for (const h of known ? p.history : []) {
    if (h && typeof h === "object" && LADDER_LABEL[h.stage] && !hist.has(h.stage)) hist.set(h.stage, h);
  }
  const line = SIDE_EXITS.has(p.state)
    ? [...STAGES.slice(0, hist.has("confirmed") ? 2 : 1), p.state]
    : STAGES;
  const now = line.indexOf(p.state);
  return line.map((stage, i) => {
    const h = hist.get(stage) ?? null;
    return {
      stage,
      label: LADDER_LABEL[stage],
      reached: Boolean(h) || i <= now,
      skipped: known && !h && i < now && stage !== "reported",
      who: h ? named(h.credit ?? h.hand) || null : null,
      hand: h && stage === "reported" && h.hand && h.hand !== h.credit ? named(h.hand) : null,
      day: h ? dayOf(h.at) : "",
      at: h && typeof h.at === "string" ? h.at : null,
      pays: Boolean(LADDER[stage]),
      paid: h && LADDER[stage] ? paidOf(h.stamps_paid) : null,
      link: h ? linkOf(h.link) : null,
    };
  });
}

/**
 * The cards, from the office's `GET /posts?class=bug` answer. `null` (or
 * anything that is not the read's shape) is a read that failed: `{ ok: false }`.
 * `legacyBefore`: the bug just before this page is on the legacy shelf too, so
 * the shelf began on an earlier page and is headed "continued", without its line.
 */
export function cardsOf(read, { legacyBefore = false } = {}) {
  if (!read || typeof read !== "object" || !Array.isArray(read.posts)) return { ok: false, groups: [], total: 0 };
  const cards = read.posts
    .filter((p) => p && typeof p === "object" && typeof p.id === "string" && LADDER_LABEL[p.state])
    .map((p) => {
      const f = p.fields && typeof p.fields === "object" ? p.fields : {};
      const caught = FINISHED_STATES.has(p.state);
      const critter = caught ? text(f.critter, 40) || null : null;
      const links = f.links && typeof f.links === "object" ? f.links : {};
      return {
        id: text(p.id, 120),
        title: text(p.title) || "(untitled)",
        reporter: named(p.author),
        stage: p.state,
        stageLabel: LADDER_LABEL[p.state],
        caught,
        aside: SIDE_EXITS.has(p.state),
        legacy: isLegacyPost(p),
        critter,
        namedBy: critter ? named(f.named_by) || null : null,
        picture: caught && typeof f.reveal?.image === "string" && MEDIA_RE.test(f.reveal.image) ? f.reveal.image : null,
        issue: typeof f.issue === "string" && ISSUE_RE.test(f.issue) ? f.issue : null,
        pr: linkOf(links.fixed),
        release: linkOf(links.shipped),
        known: Boolean(historyOf(p)),
        ladder: ladderOf(p),
      };
    });
  const groups = CARD_GROUPS
    .map((g) => ({ key: g.key, ...(g.key === "legacy" && legacyBefore ? { label: LEGACY_CONTINUED, note: null } : { label: g.label, note: g.note ?? null }),
      cards: cards.filter((c) => (g.key === "legacy") === c.legacy && g.states.includes(c.stage)) }))
    .filter((g) => g.cards.length);
  return { ok: true, groups, total: Number.isInteger(read.total) ? read.total : cards.length, page: pageOf(read, cards.length) };
}

/**
 * Where this answer sits in the bug read: `{ current, pages, limit }`. An
 * answer without the paged read's `limit` (an office before POS-558) is the
 * whole read, one page.
 */
function pageOf(read, shown) {
  const limit = Number.isInteger(read.limit) && read.limit > 0 ? read.limit : null;
  const total = Number.isInteger(read.total) ? read.total : shown;
  if (!limit) return { current: 1, pages: 1, limit: null };
  const offset = Number.isInteger(read.offset) && read.offset > 0 ? read.offset : 0;
  return { current: Math.floor(offset / limit) + 1, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

/** What a credited, paying stage with no ledger line says on a jar card: the tick pays within about fifteen minutes, or a cap held it. A legacy card says nothing there. */
export const NOT_YET_PAID = "not yet paid";
/** What an opened card says when the read carries no history for it. */
export const NO_HISTORY = "Who did each stage isn't in the office's answer right now, so the ladder shows only how far this bug has come.";

/** The cards' two lines: a read that failed, and a town with no bugs. */
export const CARDS_FAILED = "The bugs can't be read right now. They are still being caught; try again shortly.";
export const CARDS_EMPTY = "No bugs have been reported yet.";

const elOf = (doc) => (tag, cls, s) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (s !== undefined) e.textContent = s; return e; };

/**
 * One card as a <details>. Its summary is the jar's slot (closed, a squarish
 * card in the grid; the page's CSS lays the same summary out as the ladder's
 * head row when it is open); the body is the ladder and where the work is.
 */
function cardEl(c, doc) {
  const el = elOf(doc);
  const out = (href, cls, s) => { const e = el("a", cls, s); e.href = href; e.target = "_blank"; e.rel = "noopener"; return e; };
  const card = el("details", `bc-card is-${c.caught ? "caught" : c.aside ? "aside" : "loose"}${c.legacy ? " is-legacy" : ""}`);
  card.dataset.post = c.id;
  card.dataset.stage = c.stage;

  // the slot: the jar, the name or "?", the title and reporter, the stage
  const sum = el("summary", "bc-sum");
  const img = el("img", "bc-img");
  img.src = c.picture ?? (c.caught ? JAR_ART.finished : JAR_ART.open);
  img.alt = ""; img.width = 64; img.height = 64;
  const jar = el("span", "bc-jar");
  jar.append(img);
  const head = el("span", "bc-head");
  // a loose bug is the jar's "?"; a named one is its name, above the title; a legacy one has no name to show
  if (c.critter) head.append(el("span", "bc-name", c.critter));
  else if (!c.caught) jar.append(el("span", "bc-name bc-q", "?"));
  if (c.namedBy) head.append(el("span", "bc-nb", `named by ${c.namedBy}`));
  head.append(el("span", "bc-title", c.title));
  if (c.reporter) head.append(el("span", "bc-by", `${c.legacy ? "caught" : "reported"} by ${c.reporter}`));
  sum.append(jar, head, el("span", `bc-stage is-${c.stage}`, c.stageLabel));
  card.append(sum);

  // expanded: the ladder, then where the work is
  const body = el("div", "bc-body");
  if (c.namedBy) body.append(el("p", "bc-named", `named by ${c.namedBy}, who fixed it`));
  if (!c.known) body.append(el("p", "bc-note", NO_HISTORY));
  const ol = el("ol", "bc-ladder");
  for (const r of c.ladder) {
    const row = el("li", ["bc-step", r.reached && "is-reached", r.skipped && "is-skipped", r.stage === c.stage && "is-now"].filter(Boolean).join(" "));
    row.dataset.stage = r.stage;
    const who = el("span", "bc-who");
    if (r.who) {
      who.append(el("b", "bc-handle", r.who));
      if (r.hand) who.append(el("span", "bc-hand", ` · put up by ${r.hand}`));
    } else who.textContent = r.skipped ? "skipped" : r.reached ? "" : "not yet";
    const day = el("time", "bc-day", r.day);
    if (r.at) day.dateTime = r.at;
    const st = el("span", "bc-stamps");
    if (r.paid) { const b = el("b", "bc-stamp", `+${r.paid}`); b.append(el("span", "m-u", "✦")); st.append(b); }
    // a legacy bug's stages predate the ladder and will not pay: nothing about stamps, never "not yet paid" (Wright, 2026-10-10, POS-558)
    else if (r.pays && r.who && !c.legacy) st.textContent = NOT_YET_PAID;
    const lk = el("span", "bc-link");
    if (r.link) lk.append(out(r.link, "", `${LINK_LABEL[r.stage] ?? "the work"} →`));
    row.append(el("span", "bc-step-name", r.label), who, day, st, lk);
    ol.append(row);
  }
  body.append(ol);
  const go = el("p", "bc-out");
  if (c.issue) go.append(out(c.issue, "bc-issue", `issue #${c.issue.split("/").pop()} →`));
  if (c.pr) go.append(out(c.pr, "bc-pr", "the PR →"));
  if (c.release) go.append(out(c.release, "bc-release", "the release →"));
  if (c.issue || c.pr || c.release) body.append(go);
  card.append(body);
  const li = el("li", "bc-item");
  li.append(card);
  return li;
}

/** Paints one page of `cardsOf`'s answer into `root` with createElement and textContent only: a grid of <details> per group. */
export function paintCards(root, board, doc = globalThis.document) {
  root.replaceChildren();
  const el = elOf(doc);
  if (!board.ok) { root.append(el("p", "bc-empty", CARDS_FAILED)); return; }
  if (!board.total) { root.append(el("p", "bc-empty", CARDS_EMPTY)); return; }
  for (const g of board.groups) {
    const sec = el("section", "bc-group");
    sec.dataset.group = g.key;
    sec.append(el("h4", "bc-group-h", g.label));
    if (g.note) sec.append(el("p", "bc-group-note", g.note));
    const ul = el("ul", "bc-list");
    for (const c of g.cards) ul.append(cardEl(c, doc));
    sec.append(ul);
    root.append(sec);
  }
}

/**
 * The numbered pager under the cards: mail.mjs § mailPagerItems (the first,
 * the last, and two either side of this one) in MailPager's look and words.
 * The page reads live, so the pages are buttons that ask for their page
 * (`onPage(n)`), not links. One page draws nothing.
 */
export function paintPager(nav, board, onPage, doc = globalThis.document) {
  nav.replaceChildren();
  const pages = board.ok ? board.page.pages : 1;
  if (pages < 2) return false;
  const el = elOf(doc);
  const now = board.page.current;
  const go = (n, cls, s) => {
    const b = el("button", cls, s);
    b.type = "button";
    b.dataset.page = String(n);
    b.addEventListener?.("click", () => onPage(n));
    return b;
  };
  nav.append(now > 1 ? go(now - 1, "mp-step", "← newer") : el("span", "mp-step off", "← newer"));
  const list = el("span", "mp-pages");
  for (const p of mailPagerItems(now, pages)) {
    if (p === "gap") list.append(el("span", "mp-gap", "…"));
    else if (p === now) { const s = el("span", "mp-page on", String(p)); s.setAttribute?.("aria-current", "page"); list.append(s); }
    else list.append(go(p, "mp-page", String(p)));
  }
  nav.append(list);
  nav.append(now < pages ? go(now + 1, "mp-step", "older →") : el("span", "mp-step off", "older →"));
  return true;
}

// ── THE BUG CATCHERS' HALL OF FAME (POS-558, Darko 2026-10-10) ──────────────
//
// "residents in order of amount of stamp contribution towards bugs, because
// our stamp pricing already acts as a really good proxy for how much total
// they've contributed." The bug read pages, and a page cannot add up the town,
// so the office serves the totals over the whole record on every page:
// `catchers`, { handle, stamps, bugs } per credited handle (office bugs.mjs §
// THE CATCHERS, from the same history credits and stamps_paid; a bug set aside
// credits only a stage that paid). The page never sums pages.
//
// THE TOWN'S HANDS ARE NEVER RANKED: the meeps (meeps-quarter.mjs § MEEPS),
// who never take stamps, and the founders' hands, who pay them. A credited
// resident whose stages paid nothing (the legacy shelf's catchers) is listed
// under the ranked rows, by bugs credited, so no catcher is invisible.
//
// A read without `catchers` (an office before POS-558) says so in one line
// rather than drawing an empty board. Catchers whose stamps are null (the
// chain is unavailable) are listed by bugs, with a line saying the stamps
// can't be read, rather than ranking everyone at 0.

/** The founders' hands: `keemin` and `wright` move bugs (office bugs.mjs § BUG_HANDS), and `keeminlee` is the founder's account (funding.mjs § FOUNDER_ACCOUNT). */
export const FOUNDER_HANDS = Object.freeze(["keemin", "keeminlee", "wright"]);
/** Every hand the Hall never ranks. */
export const TOWN_HANDS = Object.freeze(new Set([...MEEPS.map((m) => m.handle), ...FOUNDER_HANDS]));

/** The Hall's lines. */
export const HALL_NO_HISTORY = "The Hall of Fame needs who did each stage of every bug, and the office's answer doesn't carry that yet.";
export const HALL_NO_STAMPS = "What each stage paid can't be read right now, so the catchers are listed by bugs credited.";
export const HALL_EMPTY = "No resident has been credited on a bug yet.";

/**
 * The Hall, from the office's `catchers` (on any page of the bug read):
 * `ranked` (stamps above 0, most first, ties sharing a rank) and `also`
 * (credited, no stamps), each row `{ handle, name, stamps, bugs }`. `known`
 * is false when the answer carries no catchers.
 */
export function hallOf(read, hands = TOWN_HANDS) {
  if (!read || typeof read !== "object" || !Array.isArray(read.posts)) return { ok: false, known: false, stamps: false, ranked: [], also: [] };
  if (!Array.isArray(read.catchers)) return { ok: true, known: false, stamps: false, ranked: [], also: [] };
  const rows = read.catchers
    .filter((c) => c && typeof c === "object")
    .map((c) => ({ handle: text(c.handle, 40), stamps: Number.isInteger(c.stamps) && c.stamps > 0 ? c.stamps : c.stamps === null ? null : 0, bugs: Number.isInteger(c.bugs) && c.bugs > 0 ? c.bugs : 0 }))
    .filter((c) => c.handle && c.bugs && !hands.has(c.handle))
    .map((c) => ({ ...c, name: named(c.handle) }));
  const byBugs = (a, b) => b.bugs - a.bugs || a.name.localeCompare(b.name);
  const ranked = rows.filter((r) => r.stamps > 0).sort((a, b) => b.stamps - a.stamps || byBugs(a, b));
  ranked.forEach((r, i) => { r.rank = i && ranked[i - 1].stamps === r.stamps ? ranked[i - 1].rank : i + 1; });
  return { ok: true, known: true, stamps: !rows.some((r) => r.stamps === null), ranked, also: rows.filter((r) => !r.stamps).sort(byBugs) };
}

const bugsWord = (n) => `${n} bug${n === 1 ? "" : "s"}`;

/** Paints `hallOf`'s answer into `root`; answers whether there is anything to show (a failed read shows nothing: the jar says so). */
export function paintHall(root, hall, doc = globalThis.document) {
  root.replaceChildren();
  const el = elOf(doc);
  if (!hall.ok) return false;
  if (!hall.known) { root.append(el("p", "hof-note", HALL_NO_HISTORY)); return true; }
  if (!hall.stamps) root.append(el("p", "hof-note", HALL_NO_STAMPS));
  if (!hall.ranked.length && !hall.also.length) { root.append(el("p", "hof-note", HALL_EMPTY)); return true; }
  const list = (rows, cls) => {
    const ol = el("ol", cls);
    for (const r of rows) {
      const li = el("li", "hof-row");
      li.dataset.handle = r.handle;
      if (r.rank) li.append(el("span", "hof-rank", String(r.rank)));
      li.append(el("span", "hof-name", r.name));
      if (r.stamps) {
        const st = el("span", "hof-stamps");
        const b = el("b", "bc-stamp", String(r.stamps));
        b.append(el("span", "m-u", "✦"));
        st.append(b);
        li.append(st);
      }
      li.append(el("span", "hof-bugs", bugsWord(r.bugs)));
      ol.append(li);
    }
    return ol;
  };
  if (hall.ranked.length) root.append(list(hall.ranked, "hof-list"));
  if (hall.also.length) {
    if (hall.ranked.length) root.append(el("h4", "hof-also-h", "Also credited"));
    root.append(list(hall.also, "hof-list is-also"));
  }
  return true;
}
