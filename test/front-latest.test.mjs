// front-latest.test.mjs — the signed-out front page lists the bulletin's three
// newest postings under the story, and a posting may carry an optional
// `updated` date that the order (and the date shown) prefers (Site UX campaign,
// POS-855, area front-latest; finding F-27).
//
//   node --test test/front-latest.test.mjs
//
// The cold walks found the signed-out front page answers "what happened since
// yesterday" with nothing from the bulletin: the bulletin band was built for
// everyone but shown only to the signed-in. Selection is the pure helpers in
// src/lib/bulletin-cards.mjs; the fixtures below are invented in this file, so
// nothing here reads the town's own postings, the generated data or a built
// page. The page itself is a labelled source pin (markup and CSS are the
// browser's; the built-page case is CI-only, in lens-cards.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  lensPostings, latestPostings, postingStamp, postingWhen, LATEST_LIMIT, LENS_LIMIT,
} from "../src/lib/bulletin-cards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const slugs = (list) => list.map((p) => p.slug);
const post = (slug, data = {}) => ({ slug, data });

// Invented postings, newest `posted` first except where a test says otherwise.
const INVENTED = [
  post("ferrys-daily", { posted: "2031-05-09" }),                      // newest of all, never a card
  post("zz-lantern-fair", { posted: "2031-05-08", kind: "happening", status: "closed" }),
  post("zz-ferry-timetable", { posted: "2031-05-07", kind: "news" }),
  post("zz-bridge-notice", { posted: "2031-05-06", kind: "notice", status: "open" }),
  post("zz-orchard-guide", { posted: "2031-05-05", kind: "guidance" }),
  post("zz-old-standing", { posted: "2031-04-01", kind: "standing", status: "open" }),
  post("zz-undated", { kind: "notice" }),
];

// The rule as it stood before `updated`: newest `posted` first, as written.
const oldOrder = (list, limit) =>
  list
    .filter((p) => p.slug !== "ferrys-daily" && !["closed", "ended", "past"].includes(String(p.data?.status ?? "").trim().toLowerCase()))
    .sort((a, b) => String(b.data?.posted ?? "").localeCompare(String(a.data?.posted ?? "")))
    .slice(0, limit);

test("the list is the three newest current postings, in lensPostings' order", () => {
  assert.equal(LATEST_LIMIT, 3);
  assert.deepEqual(slugs(latestPostings(INVENTED)), ["zz-ferry-timetable", "zz-bridge-notice", "zz-orchard-guide"]);
  assert.deepEqual(slugs(latestPostings(INVENTED)), slugs(lensPostings(INVENTED, 99)).slice(0, LATEST_LIMIT));
  assert.ok(LATEST_LIMIT < LENS_LIMIT, "the list is a compact cut of the band, not the band");
});

test("it is capped at three, and a closed posting and the Daily never appear, however new", () => {
  const out = slugs(latestPostings(INVENTED));
  assert.equal(out.length, 3);
  assert.equal(out.includes("zz-lantern-fair"), false, "a closed happening hung on the list");
  assert.equal(out.includes("ferrys-daily"), false, "the Daily hung on the list");
  assert.deepEqual(slugs(latestPostings(INVENTED.slice(0, 3))), ["zz-ferry-timetable"], "fewer than three shows what remains");
});

test("no postings prints nothing: an empty list, not a filler", () => {
  assert.deepEqual(latestPostings([]), []);
  assert.deepEqual(latestPostings(undefined), []);
  assert.deepEqual(latestPostings([post("ferrys-daily", { posted: "2031-05-09" }), post("zz-x", { posted: "2031-05-01", status: "past" })]), []);
});

test("an `updated` date is preferred over `posted` for the order", () => {
  const input = [
    post("zz-new-one", { posted: "2031-05-06" }),
    post("zz-revised", { posted: "2031-03-01", updated: "2031-05-08" }),
    post("zz-middle", { posted: "2031-05-07" }),
  ];
  assert.deepEqual(slugs(lensPostings(input)), ["zz-revised", "zz-middle", "zz-new-one"]);
  assert.deepEqual(slugs(latestPostings(input)), ["zz-revised", "zz-middle", "zz-new-one"]);
});

test("a stray `updated` older than `posted` does not sink the posting: the later of the two orders it and is shown", () => {
  const fmt = (d) => `<${d}>`;
  const stray = post("zz-stray", { posted: "2031-05-06", updated: "2031-01-01" });
  const older = post("zz-older", { posted: "2031-05-01" });
  assert.deepEqual(slugs(lensPostings([older, stray])), ["zz-stray", "zz-older"], "an older `updated` sank the posting");
  assert.deepEqual(postingStamp(stray), { date: "2031-05-06", updated: false });
  assert.equal(postingWhen(stray, fmt), "<2031-05-06>", "an older `updated` was shown as updated");
  // the same day is not later: the plain posted date
  const same = post("zz-same", { posted: "2031-05-06", updated: "2031-05-06" });
  assert.equal(postingWhen(same, fmt), "<2031-05-06>");
  // a posting with no posted date and an `updated` is dated by the `updated`
  assert.deepEqual(postingStamp(post("zz-nopost", { updated: "2031-05-02" })), { date: "2031-05-02", updated: true });
  // a later `updated` still wins
  assert.equal(postingWhen(post("zz-up", { posted: "2031-05-06", updated: "2031-05-09" }), fmt), "updated <2031-05-09>");
});

test("a blank `updated` is no `updated`", () => {
  for (const blank of ["", "   ", null, undefined]) {
    assert.deepEqual(postingStamp(post("zz-a", { posted: "2031-05-06", updated: blank })), { date: "2031-05-06", updated: false });
  }
  assert.deepEqual(postingStamp(post("zz-a", { posted: "2031-05-06", updated: "2031-05-08" })), { date: "2031-05-08", updated: true });
  assert.deepEqual(postingStamp(post("zz-undated")), { date: "", updated: false });
});

test("with no `updated` anywhere, the order is the old order exactly (ties and undated included)", () => {
  const tied = [
    post("zz-z-first", { posted: "2031-05-02" }), post("zz-a-second", { posted: "2031-05-02" }),
    post("zz-m-third", { posted: "2031-05-02" }), post("zz-undated"), post("zz-late", { posted: "2031-05-03" }),
  ];
  for (const list of [INVENTED, tied]) {
    for (const limit of [3, 6, 99]) {
      assert.deepEqual(slugs(lensPostings(list, limit)), slugs(oldOrder(list, limit)), `order changed at limit ${limit}`);
    }
  }
  const before = slugs(tied);
  lensPostings(tied);
  assert.deepEqual(slugs(tied), before, "the input was reordered");
});

test("the date shown is the one sorted by: `updated <date>` for an updated posting, the posted date otherwise", () => {
  const fmt = (d) => `<${d}>`;
  assert.equal(postingWhen(post("zz-a", { posted: "2031-05-06" }), fmt), "<2031-05-06>");
  assert.equal(postingWhen(post("zz-a", { posted: "2031-03-01", updated: " 2031-05-08 " }), fmt), "updated <2031-05-08>");
  assert.equal(postingWhen(post("zz-undated"), fmt), "", "an undated posting shows no date");
  assert.equal(postingWhen(post("zz-a", { posted: "2031-05-06" })), "2031-05-06", "no formatter: the date as written");
  // whatever postingWhen shows is the key lensPostings sorted that posting by
  for (const p of [post("zz-a", { posted: "2031-05-06" }), post("zz-b", { posted: "2031-03-01", updated: "2031-05-08" })]) {
    assert.ok(postingWhen(p).endsWith(postingStamp(p).date.trim()));
  }
});

// ── THE PAGE (source pin, labelled: which reader sees which block is markup and
// CSS, which only the browser runs) ───────────────────────────────────────────

const page = readFileSync(join(ROOT, "town", "pages", "index.astro"), "utf8");
const block = /<section class="latest"[\s\S]*?<\/section>/.exec(page)?.[0] ?? "";

test("[source pin] the page lists latestPostings under the story, links each to its own page, and prints nothing when empty", () => {
  assert.match(page, /import \{[^}]*\blatestPostings\b[^}]*\} from "@\/lib\/bulletin-cards\.mjs"/);
  assert.match(page, /const latest = latestPostings\(bulletin\)/);
  assert.match(page, /\{latest\.length > 0 && \(\s*<section class="latest"/, "the list renders even when empty");
  assert.match(block, /<h2 id="latest-h">Latest on the bulletin<\/h2>/);
  assert.match(block, /<a href=\{noticePath\(b\.slug\)\}>\{b\.title\}<\/a>/, "each item links the posting's own page");
  assert.equal(block.includes("/bulletin/#"), false, "an item links to a board address");
  assert.match(block, /\{b\.when && <span class="latest-when">\{b\.when\}<\/span>\}/, "the date shown is postingWhen's");
  assert.match(page, /latestPostings\(bulletin\)\s*\.map\(\(b\) => \(\{ slug: b\.slug, title: postingTitle\(b\), when: postingWhen\(b, fmtDate\) \}\)\)/);
});

test("[source pin] the list sits after the story band and the lens band, needs no script, and is hidden beside the signed-in band", () => {
  const story = page.indexOf('class:list={["cardband", "for-vanilla"');
  const lens = page.indexOf('<section class="cardband for-lens"');
  const list = page.indexOf('<section class="latest"');
  assert.ok(story > 0 && lens > story && list > lens, "the list is not below the story and lens bands");
  assert.equal(/<script/.test(block), false, "the list needs script");
  assert.equal(/\bcardband\b/.test(block), false, "the list is a card band: the carousel script and the built-page check would take it");
  assert.match(page, /:global\(html\[data-lens\]\) \.latest \{ display: none; \}/);
});

test("[source pin] the signed-in band's kicker dates a card by the same words (postingWhen), so `updated` shows there too", () => {
  assert.match(page, /\.map\(\(b\) => \(\{ slug: b\.slug, title: postingTitle\(b\), teaser: postingTeaser\(b\), when: postingWhen\(b, fmtDate\) \}\)\)/);
  assert.match(page, /<p class="c-kicker">the town bulletin\{b\.when \? ` · \$\{b\.when\}` : ""\}<\/p>/);
});
