// record.test.mjs — The Record: the crossings from the world's own tags, the
// five repos, and the seat's landing.
//
//   node --test test/record.test.mjs
//
// The brief's falsifier for this part (the site, reprojected — part 5):
// "/records/crossings/ lists S81 with its counts".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REPOS, RECORD_CARDS, heldFrom, receiptText, isoWeek, releaseLine, crossingRows, newerThan,
} from "../src/lib/record.mjs";
import { fetchCrossings } from "../tools/lib/fetch-town-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── HELD, ONLY WHEN THE RECEIPT SAYS IT WITH A COUNT ─────────────────────────

test("heldFrom reads a stated count and nothing else", () => {
  assert.equal(heldFrom("Lint CLEAN. Nothing held."), 0);
  assert.equal(heldFrom("seven rows crossed; nothing held or quarantined."), 0);
  assert.equal(heldFrom("Two held for the founder."), 2);
  assert.equal(heldFrom("3 marks held at the docket"), 3);
  assert.equal(heldFrom("one mark was held"), 1);
  // a sentence about holding that names no count is not a count
  assert.equal(heldFrom("the Understory is held until the owner answers"), null);
  assert.equal(heldFrom("Vireo's mark newly held"), null);
  assert.equal(heldFrom(""), null);
  assert.equal(heldFrom(null), null);
});

test("receiptText drops only the title line the row already shows", () => {
  assert.equal(receiptText("Settlement S81\n\nBlessed by the Worldkeeper.\n\n\n\nNothing held.", 81), "Blessed by the Worldkeeper.\n\nNothing held.");
  assert.equal(receiptText("S80: seven rows crossed.", 80), "S80: seven rows crossed.");
});

test("isoWeek names the town's train weeks", () => {
  assert.equal(isoWeek("2026-09-25T06:00:24Z"), "2026-w39");
  assert.equal(isoWeek("2026-09-21T00:00:00Z"), "2026-w39");   // Monday
  assert.equal(isoWeek("2026-09-20T23:59:00Z"), "2026-w38");   // Sunday
  assert.equal(isoWeek("2026-01-01T00:00:00Z"), "2026-w01");
  assert.equal(isoWeek("nope"), null);
});

test("releaseLine reads the release notes' own title and week", () => {
  const b = [{ slug: "release-notes", body: "intro\n# Release notes — 2026-w39 · the Post Office sails\n\n## What" }];
  assert.deepEqual(releaseLine(b), { week: "2026-w39", title: "Release notes — 2026-w39 · the Post Office sails" });
  assert.equal(releaseLine([]), null);
  assert.equal(releaseLine([{ slug: "release-notes", body: "# Release notes, undated" }]), null);
});

// ── THE ROWS ────────────────────────────────────────────────────────────────

test("crossingRows: newest first; window from the previous blessing; published and its net change", () => {
  const data = { crossings: [
    { n: 79, tag: "settlement/S79", sha: "3493e94aaaa", blessed_at: "2026-09-24T06:00:27Z", receipt: "S79: nothing held.", published_total: 416 },
    { n: 81, tag: "settlement/S81", sha: "6408352b2eeee", blessed_at: "2026-09-25T06:00:24Z", receipt: "Settlement S81\n\nThree published. Nothing held.", published_total: 423 },
    { n: 80, tag: "settlement/S80", sha: "63ba44cac", blessed_at: "2026-09-24T18:00:31Z", receipt: "S80: crossed.", published_total: 422 },
  ] };
  const bulletin = [{ slug: "release-notes", body: "# Release notes — 2026-w39 · the Post Office sails" }];
  const rows = crossingRows(data, { bulletin });
  assert.deepEqual(rows.map((r) => r.n), [81, 80, 79]);
  const s81 = rows[0];
  assert.equal(s81.windowFrom, "2026-09-24T18:00:31Z");
  assert.equal(s81.published, 423);
  assert.equal(s81.publishedNet, 1);
  assert.equal(s81.held, 0);
  assert.equal(s81.sha, "6408352b2");
  assert.equal(s81.receipt, "Three published. Nothing held.");
  assert.equal(s81.notes, "Release notes — 2026-w39 · the Post Office sails");
  assert.equal(rows[1].held, null, "S80's receipt states no held count");
  assert.equal(rows[2].windowFrom, null, "the oldest has no window start to read");
  assert.equal(rows[2].publishedNet, null);
  assert.equal(rows[2].notes, "Release notes — 2026-w39 · the Post Office sails");
});

test("on the committed snapshot: every settlement once, S81 among them with its counts", () => {
  const rows = crossingRows(DATA("crossings.json"));
  const ns = rows.map((r) => r.n);
  assert.equal(new Set(ns).size, ns.length, "a settlement is listed twice");
  assert.equal(ns[0], Math.max(...ns), "not newest first");
  const s81 = rows.find((r) => r.n === 81);
  assert.ok(s81, "S81 is not in the snapshot");
  assert.ok(Number.isInteger(s81.published), "S81 has no published count");
  assert.equal(s81.held, 0, "S81's receipt says 'Nothing held.'");
});

test("newerThan: the door's settlements past the build, newest first", () => {
  const door = { recent: [{ n: 83, sha: "abcdef1234", date: "2026-09-26T06:00:00Z" }, { n: 81, date: "x" }, { n: 82, sha: null, date: "2026-09-25T18:00:00Z" }] };
  assert.deepEqual(newerThan(81, door).map((r) => r.n), [83, 82]);
  assert.equal(newerThan(81, door)[0].sha, "abcdef123");
  assert.deepEqual(newerThan(90, door), []);
  assert.deepEqual(newerThan(81, null), []);
});

// ── THE INGEST ──────────────────────────────────────────────────────────────

test("fetchCrossings: tags → rows; the published count is reused for an unchanged tag and fetched for a new one", async () => {
  const US = "\u001f", RS = "\u001e";
  const out = [
    ["settlement/S2", "bbb", "2026-09-25T06:00:00Z", "2026-09-25T02:00:00-04:00", "Settlement S2\n\nNothing held."].join(US) + RS,
    ["settlement/S1", "aaa", "2026-09-24T18:00:00Z", "2026-09-24T14:00:00-04:00", "S1: first."].join(US) + RS,
    ["not-a-settlement", "ccc", "", "", ""].join(US) + RS,
  ].join("\n");
  const calls = [];
  const git = (args) => (args[0] === "for-each-ref" ? out : "");
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ published: { a: {}, b: {}, c: {} } }) };
  };
  const previous = { crossings: [{ n: 1, sha: "aaa", published_total: 7 }] };
  const r = await fetchCrossings({ fetchImpl, git, previous });
  assert.deepEqual(r.crossings.map((c) => c.n), [2, 1]);
  assert.equal(r.crossings[1].published_total, 7, "an unchanged tag's count was not reused");
  assert.equal(r.crossings[0].published_total, 3);
  assert.equal(r.crossings[0].blessed_at, "2026-09-25T06:00:00Z");
  assert.equal(r.crossings[0].receipt, "Settlement S2\n\nNothing held.");
  assert.deepEqual(calls, ["https://raw.githubusercontent.com/postmark-town/postmark-world/settlement/S2/WORLD/settlement-publications.json"]);
  await assert.rejects(fetchCrossings({ fetchImpl, git: () => "" }), /no settlement tags/);
});

// ── THE REPOS AND THE CARDS ─────────────────────────────────────────────────

test("five repos, all under postmark-town; every Record card that names a repo names one of them", () => {
  assert.deepEqual(REPOS.map((r) => r.key), ["postmark", "postmark-office", "postmark-site", "postmark-world", "postmark-blueprints"]);
  for (const r of REPOS) assert.equal(r.href, `https://github.com/postmark-town/${r.key}`);
  assert.deepEqual(RECORD_CARDS.map((c) => c.key), ["mail", "crossings", "works", "stamps", "numbers", "repos"]);
  for (const c of RECORD_CARDS) if (c.repo) assert.ok(REPOS.some((r) => r.key === c.repo), `${c.key} names an unknown repo`);
});

// ── THE BUILT PAGES (skipped until built, as POS-177 rules) ──────────────────

const built = (...segs) => existsSync(join(DIST, ...segs, "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");

test("the built crossings page lists S81 with its counts", { skip: !built("records", "crossings") }, () => {
  const page = html("records", "crossings");
  const i = page.indexOf('data-crossing="81"');
  assert.ok(i > 0, "S81 is not on the page");
  const row = page.slice(i, page.indexOf("</li>", i));
  const s81 = crossingRows(DATA("crossings.json")).find((r) => r.n === 81);
  assert.match(row, new RegExp(`data-published[^>]*>${s81.published} \\(\\+?-?\\d+\\)`));
  assert.match(row, /data-held[^>]*>0</);
  const listed = [...page.matchAll(/<li\b[^>]*\bdata-crossing="(\d+)"/g)].map((m) => Number(m[1]));
  assert.equal(listed.length, DATA("crossings.json").crossings.length, "the page does not list every settlement");
});

test("the built Record landing: six cards, each linking its page; the repos page: five", { skip: !built("records") || !built("records", "repos") }, () => {
  const landing = html("records");
  assert.deepEqual([...landing.matchAll(/<article\b[^>]*\bdata-record-card="([^"]+)"/g)].map((m) => m[1]), RECORD_CARDS.map((c) => c.key));
  // read each CARD's own link — the chip row above links the same pages, so a
  // page-wide search would pass with every card's link gone
  for (const c of RECORD_CARDS) {
    const start = landing.indexOf(`data-record-card="${c.key}"`);
    const card = landing.slice(start, landing.indexOf("</article>", start));
    assert.ok(card.includes(`href="${c.href}"`), `${c.key}'s card does not link ${c.href}`);
  }
  const repos = html("records", "repos");
  assert.deepEqual([...repos.matchAll(/<a\b[^>]*\bdata-repo="([^"]+)"/g)].map((m) => m[1]), REPOS.map((r) => r.key));
});

test("every old URL of the record still builds", { skip: !built("records") }, () => {
  for (const segs of [["mail"], ["stamps"], ["works"], ["numbers"], ["mail", "returned"], ["mail", "compose"]]) {
    assert.ok(built(...segs), `/${segs.join("/")}/ stopped building`);
  }
});
