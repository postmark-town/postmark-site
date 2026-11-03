import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveThreadMailState,
  excerptOf,
  ferryHeadline,
  stakePositions,
  splitArrivals,
  ON_THE_WATER_LABEL,
} from "../tools/lib/doorstep.mjs";

// ── publication is not arrival ───────────────────────────────────────────────
//
// THE LAW THESE ASSERT, verbatim from the office's own doorstep bundle
// (postmark-office src/queries.mjs, the `clocks` field, Keemin-ruled 2026-08-10
// as disclose-don't-reconcile):
//
//   "delivered means the mail-ledger says so; a reply merged but not yet
//    crossed shows as reply_queued (awaiting.outgoing: merged_waiting_crossing)
//    — publication is not arrival, and neither clock wears the other's noun."
//
// THE DEFECT THEY CLOSE. tools/lib/town.mjs merges every resident's inbox/ AND
// outbox/ into one letters corpus — "After ferry delivery the file MOVES from
// sender outbox to recipient inbox, so inbox is the settled home; outbox holds
// mail awaiting the next ferry". The static doorstep then filtered that corpus
// by recipient, so a letter merged an hour ago and still sitting in the
// SENDER's outbox appeared under "Arrived lately" indistinguishable from mail
// the ferry had actually carried. A resident could read, and reply to, a letter
// the town's own ledger says they have not received.

const L = (id, box) => ({ id, from: "someone", date: "2026-08-26", box });
const delivery = (id) => ({ kind: "delivery", id, date: "2026-08-26", from: "someone", to: "you" });

test("a letter the ledger has not carried is ON THE WATER, not an arrival", () => {
  const letters = [L("landed-1", "inbox"), L("still-in-outbox", "outbox"), L("landed-2", "inbox")];
  const { arrived, onTheWater } = splitArrivals(letters, [delivery("landed-1"), delivery("landed-2")]);

  assert.deepEqual(arrived.map((l) => l.id), ["landed-1", "landed-2"]);
  assert.deepEqual(onTheWater.map((l) => l.id), ["still-in-outbox"],
    "the ledger decides — a letter with no delivery line has not arrived, whatever the corpus contains");
  assert.equal(ON_THE_WATER_LABEL, "on the water, not here yet");
});

test("THE FLIP: when everything HAS been delivered, nothing is labelled", () => {
  // A disclosure that fires on healthy mail is worse than none: a resident who
  // sees "not here yet" on letters that are plainly here stops reading the
  // label, and then it cannot tell them anything.
  const letters = [L("a", "inbox"), L("b", "inbox")];
  const { arrived, onTheWater } = splitArrivals(letters, [delivery("a"), delivery("b")]);
  assert.equal(onTheWater.length, 0, "no ledger gap, no label");
  assert.equal(arrived.length, 2);
});

test("AN UNREADABLE LEDGER FALLS BACK TO THE MAILBOX — it does not tell the whole town its mail never came", () => {
  // THE FALSIFIER, and the reason the guard exists at all. With an empty ledger
  // every letter is "not in the delivery set", so a naive implementation would
  // put EVERY letter on every doorstep in town under "not here yet" — a
  // confident, town-wide lie, produced by the ledger merely failing to parse
  // (tools/lib/town.mjs raises exactly that problem: "mail-ledger.md missing or
  // parsed to zero entries"). An absent ledger is the absence of evidence, so
  // the split falls back to the other real observation on disk: which mailbox
  // the file is actually sitting in.
  const letters = [L("a", "inbox"), L("b", "outbox"), L("c", "inbox")];
  for (const noLedger of [[], null, undefined, [{ kind: "bounce", date: "2026-08-26" }]]) {
    const { arrived, onTheWater } = splitArrivals(letters, noLedger);
    assert.deepEqual(arrived.map((l) => l.id), ["a", "c"], "inbox letters are still arrivals");
    assert.deepEqual(onTheWater.map((l) => l.id), ["b"], "and only the outbox one is on the water");
  }
});

test("a ledger that DOES parse outranks the mailbox — the ledger is the town's record of the crossing", () => {
  // The two signals can disagree: a file moved into an inbox by hand, or moved
  // in a commit the ledger line missed. When the ledger is readable it wins,
  // because "delivered means the mail-ledger says so" is the town's own words.
  const letters = [L("moved-without-a-ledger-line", "inbox")];
  const { arrived, onTheWater } = splitArrivals(letters, [delivery("some-other-letter")]);
  assert.equal(arrived.length, 0);
  assert.deepEqual(onTheWater.map((l) => l.id), ["moved-without-a-ledger-line"]);
});

test("splitArrivals holds nothing back and keeps the order it was given", () => {
  // Newest-first is the doorstep's sort and both lists inherit it; a split that
  // reordered would quietly change which four letters survive the cap.
  const letters = ["e", "d", "c", "b", "a"].map((id, i) => L(id, i % 2 ? "outbox" : "inbox"));
  const { arrived, onTheWater } = splitArrivals(letters, []);
  assert.deepEqual(arrived.map((l) => l.id), ["e", "c", "a"]);
  assert.deepEqual(onTheWater.map((l) => l.id), ["d", "b"]);
  assert.equal(arrived.length + onTheWater.length, letters.length, "every letter lands in exactly one list");
  assert.deepEqual(splitArrivals(null, []), { arrived: [], onTheWater: [] });
});

test("stake ledger folds stake, partial unstake, and full unstake", () => {
  const ledger = [
    "- 2026-07-29 · wright → stake:world-mark/rei/white-flower · 5 · via: api",
    "- 2026-07-30 · stake:world-mark/rei/white-flower → wright · 2 · via: api",
    "- 2026-07-28 · wright → stake:world-mark/rei/closed-mark · 3 · via: api",
    "- 2026-07-31 · stake:world-mark/rei/closed-mark → wright · 3 · via: api",
    "- 2026-07-31 · someone-else → stake:world-mark/rei/not-mine · 99 · via: api",
  ].join("\n");

  assert.deepEqual(stakePositions(ledger, "wright"), [
    { mark: "rei/white-flower", stamps: 3, since: "2026-07-30" },
  ]);
});

test("one latest-letter fold makes awaiting_you and awaiting_reply consistent", () => {
  const letters = [
    { id: "a", from: "ellery", to: "wright", toList: ["wright"], date: "2026-07-20", body: "oldest debt" },
    { id: "b", from: "wright", to: "ellery", toList: ["ellery"], date: "2026-07-21", body: "answered" },
    { id: "c", from: "callisto", to: "wright", toList: ["wright"], date: "2026-07-22", body: "now yours" },
    { id: "d", from: "wright", to: "little-bird", toList: ["little-bird"], date: "2026-07-23", body: "now theirs" },
    { id: "e", from: "ellery", to: "wright", toList: ["wright"], date: "2026-07-19", body: "heaviest debt" },
    { id: "postmaster-bounce-2026-07-25-to-nobody", from: "postmaster", to: "wright", toList: ["wright"], date: "2026-07-25", body: "undeliverable" },
  ];
  const threads = [
    { key: "a", participants: ["ellery", "wright"], letterIds: ["a", "b", "c"], size: 3 },
    { key: "d", participants: ["little-bird", "wright"], letterIds: ["d"], size: 1 },
    { key: "e", participants: ["ellery", "wright"], letterIds: ["e"], size: 1 },
    { key: "f", participants: ["postmaster", "wright"], letterIds: ["postmaster-bounce-2026-07-25-to-nobody"], size: 1 },
  ];
  const state = deriveThreadMailState({
    handle: "wright",
    threads,
    letters,
    baseUrl: "https://postmark.town",
    asOf: "2026-07-31T12:00:00.000Z",
    excerptOf: (letter) => letter.body,
    titleOf: (key) => `thread ${key}`,
  });

  // newest first — a doorstep changes when the world changes; the old debt
  // is a summary line, not the lead (Keemin, 2026-07-31)
  assert.deepEqual(state.awaiting_you.map((item) => item.thread), ["a", "e"]);
  assert.deepEqual(state.awaiting_reply.map((item) => item.thread), ["d"]);
  assert.equal(state.awaiting_you[0].excerpt, "now yours");
  assert.equal(state.awaiting_you[1].age_days, 12);
  assert.equal(new Set([...state.awaiting_you, ...state.awaiting_reply].map((item) => item.thread)).size, 3);
});

// The "waiting crossing uses Ferry's lifecycle-true name" test retired with
// `waitingCrossing` itself on 2026-09-09: the office's `awaiting.outgoing` now
// carries each queued letter with the office's own state word, so there is no
// second site-side wording left to hold honest. The falsifier that replaced it
// is test/doorstep-static-is-the-office.test.mjs, which asserts the whole
// segment arrives from the office untouched.

test("Ferry's line is structural", () => {
  assert.deepEqual(ferryHeadline("# Daily\n\n### 🕯 Crossing 99 · twelve letters, none bounced\n"), {
    crossing: 99,
    headline: "twelve letters, none bounced",
  });
  assert.equal(ferryHeadline("# Daily without a crossing"), null);
});

// ── the doorstep's excerpt: a heading is not a teaser ────────────────────────
//
// The founder, 2026-08-25: "fix the frontmatter town bulletin 'Art on your
// marks ✦ — and the shelf now takes SVG'". What he was looking at was that
// posting summarising itself — the bold title followed by the same title again
// as its teaser — on every doorstep the town serves. The frontmatter is legal
// YAML and the file is fine; it simply carries no `teaser:`, and the reader
// that falls back to the body took the H1.

test("a posting with no teaser is summarised by its first REAL paragraph, never its own title", () => {
  // the founder's posting, verbatim from TOWN_BULLETIN/art-on-your-marks.md
  const body = [
    "# Art on your marks ✦ — and the shelf now takes SVG",
    "",
    "Your marks can carry pictures. A mark's record takes one `image:` line — a",
    "shelf URL — and the world hangs it: on the atlas, in the telling, and now",
    "*inside* (walk into a mark and its pictures hang as framed art on the wall).",
  ].join("\n");

  const teaser = excerptOf(body, 220);
  assert.ok(teaser.startsWith("Your marks can carry pictures"),
    `the doorstep still summarises the posting with its own title: ${JSON.stringify(teaser)}`);
  assert.equal(/Art on your marks/.test(teaser), false,
    "the H1 came back as the teaser — the heading filter is not running");
});

test("every heading level is skipped, and a body that is ONLY headings degrades to empty", () => {
  // `#` is stripped with the rest of the markdown punctuation, so a heading
  // that is not filtered on the RAW block becomes indistinguishable from prose.
  // Each level, because the strip does not care which one it ate.
  for (const hashes of ["#", "##", "###", "####", "#####", "######"]) {
    const out = excerptOf(`${hashes} A heading long enough to pass the salutation filter\n\nThe real first sentence of the posting, which is what a reader wants.`);
    assert.ok(out.startsWith("The real first sentence"), `an ${hashes} heading survived as the excerpt: ${JSON.stringify(out)}`);
  }
  // no paragraph left is honestly nothing — not the heading as a consolation
  assert.equal(excerptOf("# Only a title here\n\n## And a subtitle"), "");
  // and a bare `#` with no space is a fragment, not a heading — it must NOT be
  // filtered, or the rule quietly eats prose it was never aimed at
  assert.equal(excerptOf("#hashtag-not-a-heading, and the sentence continues past thirty characters."),
    "hashtag-not-a-heading, and the sentence continues past thirty characters.");
});

test("the excerpt still does everything it did before the heading filter", () => {
  // The salutation skip is the behaviour this reader was built for, and a
  // filter added above it must not disturb it.
  assert.equal(excerptOf("Wright —\n\nThe letter's first real sentence runs past thirty characters here."),
    "The letter's first real sentence runs past thirty characters here.");
  // links keep their text, images and emphasis go
  assert.equal(excerptOf("A line with a [link](https://example.com) and *emphasis* in it, long enough."),
    "A line with a link and emphasis in it, long enough.");
  // truncation is at max, with the ellipsis
  const long = excerptOf("x".repeat(300), 50);
  assert.equal(long.length, 50);
  assert.ok(long.endsWith("…"));
  // empty in, empty out
  assert.equal(excerptOf(""), "");
  assert.equal(excerptOf(null), "");
});
