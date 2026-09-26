// mail-pages.test.mjs — The Mail loads in parts (POS-254).
//
//   node --test test/mail-pages.test.mjs
//
// The issue's parts, as falsifiers: /mail/ is page 1 of the conversations,
// newest first, and /mail/page/N/ the rest, each static; every conversation is
// still listed on exactly one page and still has its own page; the explorer's
// old address still forwards; the filter says it covers all the mail.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAIL_PAGE_SIZE, mailPageCount, mailPageSlice, mailPageHref, mailPagerItems,
  mailRuns, newestLettersFirst, officeHandles,
} from "../src/lib/mail.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = (f) => JSON.parse(readFileSync(join(ROOT, "src", "data", "postmark", f), "utf8"));
const DIST = join(ROOT, "dist-town");

// ── THE PAGING ARITHMETIC ────────────────────────────────────────────────────

test("pages: count, slice and address", () => {
  assert.equal(mailPageCount(0, 50), 1);
  assert.equal(mailPageCount(50, 50), 1);
  assert.equal(mailPageCount(51, 50), 2);
  const items = Array.from({ length: 120 }, (_, i) => i);
  assert.deepEqual(mailPageSlice(items, 1, 50), items.slice(0, 50));
  assert.deepEqual(mailPageSlice(items, 3, 50), items.slice(100, 120));
  assert.equal(mailPageHref(1), "/mail/");
  assert.equal(mailPageHref(2), "/mail/page/2/");
  assert.equal(mailPageHref(1, "/mail/office/"), "/mail/office/");
  assert.equal(mailPageHref(4, "/mail/office/"), "/mail/office/page/4/");
});

test("the pager shows the ends, two either side, and a gap where it skips", () => {
  assert.deepEqual(mailPagerItems(1, 1), [1]);
  assert.deepEqual(mailPagerItems(1, 22), [1, 2, 3, "gap", 22]);
  assert.deepEqual(mailPagerItems(10, 22), [1, "gap", 8, 9, 10, 11, 12, "gap", 22]);
  assert.deepEqual(mailPagerItems(22, 22), [1, "gap", 20, 21, 22]);
  assert.deepEqual(mailPagerItems(4, 6), [1, 2, 3, 4, 5, 6]);
});

test("the runs split the town's conversations from the office's, keeping the order", () => {
  const office = new Set(["postmaster"]);
  const threads = [
    { key: "a", participants: ["wright", "rei"] },
    { key: "b", participants: ["postmaster", "wright"] },
    { key: "c", participants: ["carta", "rei"] },
  ];
  const { town, office: off } = mailRuns(threads, office);
  assert.deepEqual(town.map((t) => t.key), ["a", "c"]);
  assert.deepEqual(off.map((t) => t.key), ["b"]);
});

test("a filtered result is newest first on the town's clock", () => {
  const rows = [
    { id: "old", date: "2026-07-01" },
    { id: "late", date: "2026-07-02", delivered: "2026-07-09" },
    { id: "new", date: "2026-07-05" },
  ];
  assert.deepEqual(newestLettersFirst(rows).map((l) => l.id), ["late", "new", "old"]);
});

// ── THE BUILT PAGES (skipped until built, as POS-177 rules) ──────────────────

const built = (...segs) => existsSync(join(DIST, ...segs, "index.html"));
const html = (...segs) => readFileSync(join(DIST, ...segs, "index.html"), "utf8");
const cardKeys = (page) => [...page.matchAll(/<a class="pm-thread-card"[^>]*href="\/mail\/([^"/]+)\/"/g)].map((m) => m[1]);

/** Every page of a run, as built: [segments of page 1, page 2, …]. */
function runPages(base, count) {
  return Array.from({ length: count }, (_, i) => (i === 0 ? base : [...base, "page", String(i + 1)]));
}

test("every conversation is listed on exactly one built page, newest first, and page 1 holds no more than a page",
  { skip: !built("mail") }, () => {
  const threads = DATA("threads.json");
  const { town, office } = mailRuns(threads, officeHandles(DATA("residents.json")));
  for (const [base, run] of [[["mail"], town], [["mail", "office"], office]]) {
    const pages = runPages(base, mailPageCount(run.length));
    const listed = pages.map((segs) => cardKeys(html(...segs)));
    for (const keys of listed) assert.ok(keys.length <= MAIL_PAGE_SIZE, `${base.join("/")}: a page lists ${keys.length}`);
    // in the run's order, which is threads.json's: newest letter first
    assert.deepEqual(listed.flat(), run.map((t) => t.key), `${base.join("/")}: the pages do not list the run in order`);
    // and no page past the last
    assert.equal(built(...base, "page", String(pages.length + 1)), false);
  }
  assert.equal(town.length + office.length, threads.length);
});

test("every conversation's own page still builds (the deep links)", { skip: !built("mail") }, () => {
  const missing = DATA("threads.json").filter((t) => !built("mail", t.key)).map((t) => t.key);
  assert.deepEqual(missing, []);
});

test("the pager links resolve to built pages", { skip: !built("mail") }, () => {
  for (const segs of [["mail"], ["mail", "page", "2"], ["mail", "office"]]) {
    const hrefs = [...html(...segs).matchAll(/<a class="mp-(?:step|page)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0, `${segs.join("/")} has no pager links`);
    for (const h of hrefs) assert.ok(built(...h.split("/").filter(Boolean)), `${segs.join("/")} links to ${h}, which did not build`);
  }
});

test("the filter says it covers all the mail, and the explorer still forwards", { skip: !built("mail") }, () => {
  assert.match(html("mail"), /The filter searches every letter the town has carried, on every page/);
  assert.match(html("mail", "explorer"), /location\.replace\("\/mail\/" \+ location\.search/);
});
