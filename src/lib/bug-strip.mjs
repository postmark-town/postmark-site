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
// THE BOARD IS LIVE. The browser reads the office's bug posts
// (GET /api/posts?class=bug, public and keyless: server.mjs § "GET /posts?
// class=…", "public and keyless") and `boardOf` folds the answer. What a
// resident wrote (a title) is returned as a string for textContent, never
// markup (the reading law). A board the browser could not read says so; it
// never says "No open bugs" about a read that failed.

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
    caption: t`Caught! ${S(`+${L.confirmed.n}`)}`,
    scene: "The Bug Catcher holding up a jar with a bug in it.",
    img: "/meeps/bug-strip/3-caught.svg",
    bubble: {
      title: t`Confirmed: ${S(L.confirmed.n)} to the reporter`,
      lines: [
        t`He looks for a duplicate first, then checks the bug against the public record. The first reporter keeps the credit.`,
        t`A household is paid for ${CONFIRMED_CAP} confirmed reports a week. A fourth is still caught and credited, and pays nothing that week.`,
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
// jar. Every bug gets a slot. An OPEN one (not yet fixed) is a silhouette with
// "?". A FINISHED one (fixed or shipped) is the lit jar with the name its fixer
// gave it (fields.critter) and who named it (fields.named_by: the resident
// credited with the fix, office events-store.mjs), or "unnamed" when it
// finished before names (Wright's review, 2026-09-29: only open bugs are "?").
// The side exits (duplicate, not-a-bug) were never bugs to catch, so they get
// no slot.

/** The jar's two pictures: a bug still loose, and a caught, finished one. */
export const JAR_ART = Object.freeze({
  open: "/meeps/bug-strip/jar-open.svg",
  finished: "/meeps/bug-strip/3-caught.svg",
});
const FINISHED_STATES = new Set(["fixed", "shipped"]);
const SIDE_EXITS = new Set(["duplicate", "not-a-bug"]);

/** The jar's two lines: no slot at all, or slots with none fixed yet. */
export const JAR_EMPTY = "The jar is empty: no bug has been fixed yet.";
export const JAR_NONE_FIXED = "No bug has been fixed yet. These are still being caught.";

/**
 * The jar, from the same `GET /posts?class=bug` answer as the board. A slot is
 * `{ id, title, finished, critter, namedBy }`: `finished` for a fixed or
 * shipped bug; `critter` its name when its fixer gave one, else null.
 */
export function jarOf(read) {
  if (!read || typeof read !== "object" || !Array.isArray(read.posts)) return { ok: false, slots: [], finished: 0 };
  const slots = read.posts
    .filter((p) => p && typeof p === "object" && STAGES.includes(p.state) && !SIDE_EXITS.has(p.state))
    .map((p) => {
      const finished = FINISHED_STATES.has(p.state);
      const critter = finished ? text(p.fields?.critter, 40) || null : null;
      return {
        id: text(p.id, 120),
        title: text(p.title) || "(untitled)",
        finished,
        critter,
        namedBy: critter ? text(p.fields?.named_by, 40) || null : null,
      };
    });
  return { ok: true, slots, finished: slots.filter((s) => s.finished).length };
}

/** Paints `jarOf`'s answer into `root`: createElement and textContent only. */
export function paintJar(root, jar, doc = globalThis.document) {
  root.replaceChildren();
  const el = (tag, cls, s) => { const e = doc.createElement(tag); e.className = cls; if (s !== undefined) e.textContent = s; return e; };
  if (!jar.ok) { root.append(el("p", "jar-empty", "The jar can't be read right now.")); return; }
  if (!jar.slots.length) { root.append(el("p", "jar-empty", JAR_EMPTY)); return; }
  if (!jar.finished) root.append(el("p", "jar-empty", JAR_NONE_FIXED));
  const ul = el("ul", "jar-slots");
  for (const s of jar.slots) {
    const li = el("li", s.finished ? "jar-slot is-named" : "jar-slot is-open");
    li.dataset.post = s.id;
    const img = doc.createElement("img");
    img.className = "jar-img"; img.src = s.finished ? JAR_ART.finished : JAR_ART.open; img.alt = ""; img.width = 64; img.height = 64;
    li.append(img);
    if (s.finished) {
      li.append(el("span", s.critter ? "jar-name" : "jar-name jar-unnamed", s.critter ?? "unnamed"));
      if (s.namedBy) li.append(el("span", "jar-by", `named by ${s.namedBy}`));
    } else {
      li.append(el("span", "jar-name jar-q", "?"));
    }
    li.append(el("span", "jar-title", s.title));
    ul.append(li);
  }
  root.append(ul);
}

// ── THE BOARD ────────────────────────────────────────────────────────────────

const ISSUE_RE = /^https:\/\/github\.com\/postmark-town\/[A-Za-z0-9._-]+\/issues\/\d+$/;
const text = (v, max = 160) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
};

/** What each stage is called on the board. */
export const STAGE_LABEL = Object.freeze({
  reported: "Reported",
  confirmed: "Caught",
  reproduced: "Reproduced",
  diagnosed: "Diagnosed",
  briefed: "Briefed",
  fixed: "Fixed, shipping soon",
});

/**
 * The open bugs, grouped by stage in the lifecycle's order, from the office's
 * `GET /posts?class=bug` answer. `null` (or anything that is not the read's
 * shape) is a board that could not be read: `{ ok: false }`. A row is
 * `{ id, title, reporter, stage, issue }`, all plain strings (issue only when
 * it is a GitHub issue on the town's org, else null).
 *
 * The read carries no credits: who was credited at each stage is on the
 * advance acts (office town-posts.mjs), so the board shows the stage reached,
 * not who has been paid.
 */
export function boardOf(read) {
  if (!read || typeof read !== "object" || !Array.isArray(read.posts)) return { ok: false, groups: [], open: 0 };
  const finished = new Set(Array.isArray(read.finished) ? read.finished : FINISHED);
  const rows = read.posts
    .filter((p) => p && typeof p === "object" && typeof p.state === "string" && !finished.has(p.state) && STAGE_LABEL[p.state])
    .map((p) => ({
      id: text(p.id, 120),
      title: text(p.title) || "(untitled)",
      reporter: text(p.author, 40),
      stage: p.state,
      issue: typeof p.fields?.issue === "string" && ISSUE_RE.test(p.fields.issue) ? p.fields.issue : null,
    }));
  const groups = STAGES.filter((s) => STAGE_LABEL[s])
    .map((s) => ({ stage: s, label: STAGE_LABEL[s], rows: rows.filter((r) => r.stage === s) }))
    .filter((g) => g.rows.length);
  return { ok: true, groups, open: rows.length };
}

/**
 * Paints `boardOf`'s answer into `root` with createElement and textContent
 * only: nothing a resident wrote can become markup.
 */
export function paintBoard(root, board, doc = globalThis.document) {
  root.replaceChildren();
  const p = (cls, s) => { const el = doc.createElement("p"); el.className = cls; el.textContent = s; return el; };
  if (!board.ok) { root.append(p("bb-empty", "The board can't be read right now. The bugs are still being caught; try again shortly.")); return; }
  if (!board.open) { root.append(p("bb-empty", "No open bugs right now.")); return; }
  for (const g of board.groups) {
    const sec = doc.createElement("section");
    sec.className = "bb-stage";
    sec.dataset.stage = g.stage;
    const h = doc.createElement("h4");
    h.textContent = `${g.label} · ${g.rows.length}`;
    const ul = doc.createElement("ul");
    for (const r of g.rows) {
      const li = doc.createElement("li");
      li.className = "bb-row";
      li.dataset.post = r.id;
      const t = doc.createElement("span"); t.className = "bb-title"; t.textContent = r.title;
      const by = doc.createElement("span"); by.className = "bb-by"; by.textContent = r.reporter ? `reported by ${r.reporter}` : "";
      li.append(t, by);
      if (r.issue) {
        const a = doc.createElement("a");
        a.className = "bb-issue"; a.href = r.issue; a.rel = "noopener"; a.target = "_blank";
        a.textContent = `issue #${r.issue.split("/").pop()}`;
        li.append(a);
      }
      ul.append(li);
    }
    sec.append(h, ul);
    root.append(sec);
  }
}
