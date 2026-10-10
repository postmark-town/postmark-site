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
// with the fix, office events-store.mjs), or "unnamed" when it finished before
// names (Wright's review, 2026-09-29: only open bugs are "?"). Since POS-547
// every bug in the read is a card (§ THE CARDS), the side exits too, set aside
// under their own heading.

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
// COLLAPSED, a card is the jar's slot: the critter (its picked picture once
// revealed, the lit jar with the name its fixer gave it, or the "?" silhouette
// while it is loose), the title, the reporter and the stage. EXPANDED, it is
// the ladder: every stage of the main line, each reached one with who did it,
// when, its stamps and its link, the unreached ones dim; then the issue, the
// PR and the release. A side exit's ladder ends at its exit.
//
// THE ORDER: open bugs first, by stage in the lifecycle's order; then the ones
// set aside (duplicate, not a bug); shipped bugs last. Every post in the read
// is one card.
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

/** The card groups, in the page's order. */
export const CARD_GROUPS = Object.freeze([
  ...STAGES.filter((s) => s !== "shipped").map((s) => Object.freeze({ key: s, label: STAGE_LABEL[s], states: [s] })),
  Object.freeze({ key: "set-aside", label: "Set aside", states: ["duplicate", "not-a-bug"] }),
  Object.freeze({ key: "shipped", label: "Shipped", states: ["shipped"] }),
]);

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
 */
export function cardsOf(read) {
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
    .map((g) => ({ key: g.key, label: g.label, cards: cards.filter((c) => g.states.includes(c.stage)) }))
    .filter((g) => g.cards.length);
  return { ok: true, groups, total: cards.length, caught: cards.filter((c) => c.caught).length };
}

/** What a credited, paying stage with no ledger line says: the tick pays within about fifteen minutes, or a cap held it. */
export const NOT_YET_PAID = "not yet paid";
/** What an opened card says when the read carries no history for it. */
export const NO_HISTORY = "Who did each stage isn't in the office's answer right now, so the ladder shows only how far this bug has come.";

/** The cards' two lines: a read that failed, and a town with no bugs. */
export const CARDS_FAILED = "The bugs can't be read right now. They are still being caught; try again shortly.";
export const CARDS_EMPTY = "No bugs have been reported yet.";

/** Paints `cardsOf`'s answer into `root` with createElement and textContent only; each card is a <details>. */
export function paintCards(root, board, doc = globalThis.document) {
  root.replaceChildren();
  const el = (tag, cls, s) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (s !== undefined) e.textContent = s; return e; };
  const out = (href, cls, s) => { const e = el("a", cls, s); e.href = href; e.target = "_blank"; e.rel = "noopener"; return e; };
  if (!board.ok) { root.append(el("p", "bc-empty", CARDS_FAILED)); return; }
  if (!board.total) { root.append(el("p", "bc-empty", CARDS_EMPTY)); return; }
  for (const g of board.groups) {
    const sec = el("section", "bc-group");
    sec.dataset.group = g.key;
    sec.append(el("h4", "bc-group-h", `${g.label} · ${g.cards.length}`));
    const ul = el("ul", "bc-list");
    for (const c of g.cards) {
      const card = el("details", `bc-card is-${c.caught ? "caught" : c.aside ? "aside" : "loose"}`);
      card.dataset.post = c.id;
      card.dataset.stage = c.stage;

      // collapsed: the jar's slot, the title and reporter, the stage
      const sum = el("summary", "bc-sum");
      const img = el("img", "bc-img");
      img.src = c.picture ?? (c.caught ? JAR_ART.finished : JAR_ART.open);
      img.alt = ""; img.width = 48; img.height = 48;
      const jar = el("span", "bc-jar");
      jar.append(img);
      const head = el("span", "bc-head");
      // a loose bug is the jar's "?"; a caught one is its name, above the title
      if (c.caught) head.append(el("span", c.critter ? "bc-name" : "bc-name bc-unnamed", c.critter ?? "unnamed"));
      else jar.append(el("span", "bc-name bc-q", "?"));
      head.append(el("span", "bc-title", c.title));
      if (c.reporter) head.append(el("span", "bc-by", `reported by ${c.reporter}`));
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
        else if (r.pays && r.who) st.textContent = NOT_YET_PAID;
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
      ul.append(li);
    }
    sec.append(ul);
    root.append(sec);
  }
}
