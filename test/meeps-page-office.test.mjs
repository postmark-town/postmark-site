// The Meeps page asks the page's own office (2026-09-29).
//
// On dev.postmark.town the open-bugs board read "can't be read right now":
// the page took a build-time absolute URL (PUBLIC_POSTMARK_API, else
// https://postmark.town/api), so dev asked PROD's office, which had no /posts
// yet, while dev's own office answered it. The fund page learned this first
// (#197, test/fund-page-office.test.mjs). This page's script is a bundled
// module, so it imports officeBase() (src/lib/auth.mjs) rather than restating
// it; this file pins the read to that resolver and keeps the baked URL out.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { officeBase } from "../src/lib/auth.mjs";
import { BOARD_PATH } from "../src/lib/bug-strip.mjs";

const ROOT = new URL("..", import.meta.url);
const PAGE = readFileSync(new URL("town/pages/meeps/index.astro", ROOT), "utf8");
const SCRIPT = PAGE.slice(PAGE.indexOf("<script>"), PAGE.indexOf("</script>"));

test("the board's read is officeBase() + the bug posts path, from the page's own script", () => {
  assert.match(SCRIPT, /import \{ officeBase \} from "@\/lib\/auth\.mjs";/);
  assert.match(SCRIPT, /fetch\(officeBase\(\) \+ BOARD_PATH,/);
  assert.equal(BOARD_PATH, "/posts?class=bug");
});

test("officeBase() answers the same-origin /api unset, and the operator's base when set", () => {
  const stub = (base) => ({ getItem: (k) => (k === "pm.office.base" ? base : null) });
  assert.equal(officeBase(stub(null)) + BOARD_PATH, "/api/posts?class=bug");
  assert.equal(officeBase(stub("https://dev.postmark.town/api/")) + BOARD_PATH, "https://dev.postmark.town/api/posts?class=bug");
});

test("the page no longer names a build-time office", () => {
  assert.doesNotMatch(PAGE, /PUBLIC_POSTMARK_API/);
  assert.doesNotMatch(PAGE, /https:\/\/postmark\.town\/api/);
});

// The built bundle is what the browser runs: its bug-posts read is relative.
const ASSETS = new URL("dist-town/_astro/", ROOT);
test("the built page's script reads /posts?class=bug through the page's office, not prod's",
  { skip: !existsSync(ASSETS) }, () => {
  const html = readFileSync(new URL("dist-town/meeps/index.html", ROOT), "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]);
  const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const bundled = scripts.map((s) => readFileSync(new URL(s, ASSETS), "utf8")).join("\n");
  // follow one level of imports: a page chunk imports its shared chunks
  const deps = [...bundled.matchAll(/from"\.\/([^"]+\.js)"|import\("\.\/([^"]+\.js)"\)|from "\.\/([^"]+\.js)"/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const all = [inline, bundled, ...deps.filter((d) => readdirSync(ASSETS).includes(d)).map((d) => readFileSync(new URL(d, ASSETS), "utf8"))].join("\n");
  assert.match(all, /pm\.office\.base/, "the built script does not resolve the office from pm.office.base");
  assert.match(all, /\/posts\?class=bug/);
  assert.doesNotMatch(all, /https:\/\/postmark\.town\/api\/posts/, "the built script still asks prod's office for the bug posts");
});
