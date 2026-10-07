// ops-family.test.mjs — no page the site builds links the box's operator pages.
//
//   node --test test/ops-family.test.mjs
//
// THE LAW (POS-395): the box-generated ops pages (the hub and the dashboards)
// answer only to the operators, so nothing the site publishes carries a link to
// them. The graph's strip once linked the whole family to every signed-out
// reader, and a public page links the graph. The strip now renders the
// site-built half only and adds the generated half in the browser for the
// principal (src/components/OpsNav.astro, src/lib/ops-family.mjs).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OPS_GATED, OPS_PUBLIC, isGatedOpsHref, opsNavFor } from "../src/lib/ops-family.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), "utf8");

// every link a tracked site source can write: href attributes, markdown links,
// and absolute postmark.town URLs (the bulletin's data carries those). The
// scan is the site's pages and the town data it builds from (src/data); the
// public/atelier mirror is residents' own mail, which is theirs to write.
const LINKS = [
  /href\s*=\s*["']([^"']+)["']/g,
  /\]\((\/[^)\s]*)\)/g,
  /(https?:\/\/(?:www\.)?postmark\.town\/ops[^\s"'<>)\\]*)/g,
  /["'`](\/ops(?:\/[^"'`\s]*)?)["'`]/g, // a path held in code, as the old strip held its list
];
const linksIn = (text) => LINKS.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));

test("no tracked site source links the generated ops pages", () => {
  const files = execFileSync("git", ["ls-files", "town", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(astro|mjs|js|ts|md|json|html)$/.test(f))
    .filter((f) => f !== "src/lib/ops-family.mjs");
  assert.ok(files.length > 50, `the scan saw the site's sources (${files.length} files)`);
  const offenders = [];
  for (const f of files) {
    for (const href of linksIn(read(f))) if (isGatedOpsHref(href)) offenders.push(`${f}: ${href}`);
  }
  assert.deepEqual(offenders, [], "a site page links a page behind the ops gate");
});

test("the strip's markup is the site-built half; the generated half is the principal's", () => {
  const nav = read("src/components/OpsNav.astro");
  const markup = nav.split("<script>")[0];
  assert.match(markup, /OPS_PUBLIC\.map/, "the server-rendered strip draws the public list");
  assert.doesNotMatch(markup, /OPS_GATED/, "the generated half never reaches the markup");
  assert.match(nav, /me\?\.principal !== true\) return/, "the browser adds it only on /me's principal");
  assert.deepEqual(opsNavFor(), OPS_PUBLIC);
  assert.deepEqual(opsNavFor({ principal: true }), [...OPS_GATED, ...OPS_PUBLIC]);
});

test("the gate's spellings: the generated half is gated, the consoles and the board are not", () => {
  for (const href of ["/ops/", "/ops", "/ops/traffic/", "/ops/traffic", "/ops/traffic/data.json", "/ops/git/?x=1",
    "https://postmark.town/ops/economy/", "https://www.postmark.town/ops/", "/ops/awareness/", "/ops/activity/#top"]) {
    assert.equal(isGatedOpsHref(href), true, href);
  }
  for (const href of ["/ops/graph/", "/ops/desk/", "/ops/sentinel.json", "https://postmark.town/ops/graph/", "/", "/world/"]) {
    assert.equal(isGatedOpsHref(href), false, href);
  }
});

test("the kickers name Ops without linking it", () => {
  for (const page of ["town/pages/ops/graph/index.astro", "town/pages/ops/desk/index.astro"]) {
    const kicker = read(page).match(/<p class="pm-kicker">.*<\/p>/)?.[0] ?? "";
    assert.match(kicker, /· Ops ·/, page);
    assert.doesNotMatch(kicker, /href="\/ops\//, page);
  }
});
